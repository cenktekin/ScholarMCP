import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { Logger } from '../core/logger.js';
import { IngestionError, DocumentNotFoundError, JobNotFoundError } from './errors.js';
import type { CanonicalWork, IngestionJob, ParsedDocument } from './types.js';
import { makeStableId, nowIso } from './utils.js';
import { LiteratureService } from './literature-service.js';
import {
  obtainPdfFile,
  parseWithGrobid,
  parseWithSimplePdf,
  resolvePdfUrlFromLandingPages
} from './ingestion-pdf-source.js';
import { toAbsolutePath, type ParseOutput } from './ingestion-parsing.js';

export type ParseMode = 'auto' | 'grobid' | 'simple';

export interface IngestPaperInput {
  doi?: string;
  paperUrl?: string;
  pdfUrl?: string;
  localPdfPath?: string;
  parseMode?: ParseMode;
  ocrEnabled?: boolean;
}

interface ResolvedIngestionSource {
  doi: string | null;
  paperUrl: string | null;
  pdfUrl: string | null;
  localPdfPath: string | null;
  licenseState: IngestionJob['licenseState'];
  provenanceWork: CanonicalWork | null;
}

export class IngestionService {
  private readonly jobs = new Map<string, IngestionJob>();
  private readonly documents = new Map<string, ParsedDocument>();

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly literatureService: LiteratureService
  ) {}

  enqueueIngestion(input: IngestPaperInput): IngestionJob {
    const sourceSeed = [input.doi ?? null, input.paperUrl ?? null, input.pdfUrl ?? null, input.localPdfPath ?? null];
    const documentId = makeStableId(sourceSeed, 'doc');
    const jobId = makeStableId([...sourceSeed, randomUUID()], 'job');

    const job: IngestionJob = {
      jobId,
      documentId,
      status: 'queued',
      createdAt: nowIso(),
      startedAt: null,
      completedAt: null,
      source: {
        doi: input.doi ?? null,
        paperUrl: input.paperUrl ?? null,
        pdfUrl: input.pdfUrl ?? null,
        localPdfPath: input.localPdfPath ?? null
      },
      parserName: null,
      parserConfidence: null,
      licenseState: 'unknown',
      error: null,
      warnings: [],
      provenance: []
    };

    this.jobs.set(jobId, job);

    void this.processJob(jobId, input).catch((error) => {
      const current = this.jobs.get(jobId);
      if (!current) {
        return;
      }

      current.status = 'failed';
      current.completedAt = nowIso();
      current.error = error instanceof Error ? error.message : String(error);
      this.jobs.set(jobId, current);
    });

    return job;
  }

  getJob(jobId: string): IngestionJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new JobNotFoundError(jobId);
    }

    return job;
  }

  getDocument(documentId: string): ParsedDocument {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    return document;
  }

  private async processJob(jobId: string, input: IngestPaperInput): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'running';
    job.startedAt = nowIso();
    this.jobs.set(jobId, job);

    const resolved = await this.resolveSource(input);
    job.source = {
      doi: resolved.doi,
      paperUrl: resolved.paperUrl,
      pdfUrl: resolved.pdfUrl,
      localPdfPath: resolved.localPdfPath
    };
    job.licenseState = resolved.licenseState;

    const parserMode = input.parseMode ?? 'auto';
    const parseResult = await this.parseSourcePdf(resolved, parserMode);

    const document: ParsedDocument = {
      documentId: job.documentId,
      source: {
        doi: resolved.doi,
        url: resolved.paperUrl ?? resolved.pdfUrl,
        localPath: resolved.localPdfPath
      },
      parser: {
        parserName: parseResult.parserName,
        parserVersion: parseResult.parserVersion,
        confidence: parseResult.confidence
      },
      title: parseResult.title,
      abstract: parseResult.abstract,
      fullText: parseResult.fullText,
      sections: parseResult.sections,
      references: parseResult.references,
      tables: [],
      equations: [],
      figures: [],
      createdAt: nowIso(),
      provenance: [
        {
          provider: resolved.provenanceWork ? 'openalex' : 'scholar_scrape',
          sourceUrl: resolved.paperUrl ?? resolved.pdfUrl,
          fetchedAt: nowIso(),
          confidence: parseResult.confidence,
          notes: `${parseResult.parserName}:${parseResult.parserVersion}`
        }
      ]
    };

    this.documents.set(document.documentId, document);

    job.status = 'succeeded';
    job.completedAt = nowIso();
    job.parserName = parseResult.parserName;
    job.parserConfidence = parseResult.confidence;
    job.provenance = document.provenance;
    this.jobs.set(jobId, job);
  }

  private async resolveSource(input: IngestPaperInput): Promise<ResolvedIngestionSource> {
    if (input.localPdfPath) {
      if (!this.config.researchAllowLocalPdfs) {
        throw new IngestionError('Local PDF ingestion is disabled by configuration.');
      }

      const absolutePath = toAbsolutePath(input.localPdfPath);
      await fs.access(absolutePath);

      return {
        doi: input.doi ?? null,
        paperUrl: input.paperUrl ?? null,
        pdfUrl: input.pdfUrl ?? null,
        localPdfPath: absolutePath,
        licenseState: 'user_provided',
        provenanceWork: null
      };
    }

    if (!this.config.researchAllowRemotePdfs) {
      throw new IngestionError('Remote PDF ingestion is disabled by configuration.');
    }

    let resolvedWork: CanonicalWork | null = null;
    if (input.doi) {
      resolvedWork = await this.literatureService.resolveByDoi(input.doi);
    }

    const paperUrlCandidate = input.paperUrl ?? resolvedWork?.url ?? null;
    const paperUrlPdfCandidate = paperUrlCandidate?.toLowerCase().endsWith('.pdf') ? paperUrlCandidate : null;
    const discoveredPdfFromLanding = await resolvePdfUrlFromLandingPages(
      [paperUrlCandidate, resolvedWork?.url],
      this.logger
    );

    const resolvedPdfUrl =
      input.pdfUrl ??
      resolvedWork?.openAccess.pdfUrl ??
      paperUrlPdfCandidate ??
      discoveredPdfFromLanding;

    if (!resolvedPdfUrl) {
      throw new IngestionError('Unable to resolve a downloadable PDF URL from input.');
    }

    return {
      doi: input.doi ?? resolvedWork?.doi ?? null,
      paperUrl: input.paperUrl ?? resolvedWork?.url ?? null,
      pdfUrl: resolvedPdfUrl,
      localPdfPath: null,
      licenseState: 'open_access',
      provenanceWork: resolvedWork
    };
  }

  private async parseSourcePdf(source: ResolvedIngestionSource, parseMode: ParseMode): Promise<ParseOutput> {
    const { filePath, cleanup } = await obtainPdfFile(source);

    try {
      const modes = this.resolveParserOrder(parseMode);

      for (const mode of modes) {
        try {
          switch (mode) {
            case 'grobid': {
              if (!this.config.researchGrobidUrl) {
                continue;
              }
              return await parseWithGrobid(filePath, this.config.researchGrobidUrl);
            }
            case 'simple': {
              return await parseWithSimplePdf(filePath);
            }
          }
        } catch (error) {
          this.logger.warn('Parser mode failed, trying fallback', {
            mode,
            filePath,
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      throw new IngestionError('All parser strategies failed for this PDF source.');
    } finally {
      await cleanup();
    }
  }

  private resolveParserOrder(parseMode: ParseMode): ParseMode[] {
    if (parseMode === 'auto') {
      return ['grobid', 'simple'];
    }

    if (parseMode === 'grobid') {
      return ['grobid', 'simple'];
    }

    return ['simple'];
  }
}
