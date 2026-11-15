import { promises as fs } from 'node:fs';
import { basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import type { Logger } from '../core/logger.js';
import { IngestionError } from './errors.js';
import { normalizeWhitespace } from './utils.js';
import {
  PDF_LINK_REGEX,
  extractReferences,
  extractTitleAndAbstract,
  parseGrobidXml,
  resolveUrlCandidate,
  splitIntoSections,
  type ParseOutput
} from './ingestion-parsing.js';

export interface PdfSource {
  localPdfPath: string | null;
  pdfUrl: string | null;
}

const DOWNLOAD_HEADERS = {
  accept: 'application/pdf,*/*',
  'user-agent': 'ScholarMCP/1.0 (+https://github.com/lstudlo/ScholarMCP)'
};

const LANDING_PAGE_HEADERS = {
  accept: 'text/html,application/pdf,*/*',
  'user-agent': 'ScholarMCP/1.0 (+https://github.com/lstudlo/ScholarMCP)'
};

const META_PDF_PATTERNS = [
  /<meta[^>]+name=["']citation_pdf_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']citation_pdf_url["'][^>]*>/i,
  /<meta[^>]+property=["']og:pdf["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:pdf["'][^>]*>/i
];

const LINK_PDF_PATTERNS = [
  /<link[^>]+type=["']application\/pdf["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/pdf["'][^>]*>/i
];

export const obtainPdfFile = async (
  source: PdfSource
): Promise<{ filePath: string; cleanup: () => Promise<void> }> => {
  if (source.localPdfPath) {
    return {
      filePath: source.localPdfPath,
      cleanup: async () => undefined
    };
  }

  if (!source.pdfUrl) {
    throw new IngestionError('Missing PDF URL after source resolution.');
  }

  const response = await fetch(source.pdfUrl, { headers: DOWNLOAD_HEADERS });

  if (!response.ok) {
    throw new IngestionError(`Failed to download PDF. HTTP ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const buffer = Buffer.from(bytes);
  const looksLikePdf = buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF';
  if (!contentType.includes('application/pdf') && !looksLikePdf) {
    throw new IngestionError(`Downloaded content is not a PDF (content-type: ${contentType || 'unknown'}).`);
  }

  const tempPath = resolve(tmpdir(), `scholar-mcp-${Date.now()}-${randomUUID()}.pdf`);
  await fs.writeFile(tempPath, buffer);

  return {
    filePath: tempPath,
    cleanup: async () => {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  };
};

export const parseWithSimplePdf = async (filePath: string): Promise<ParseOutput> => {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = normalizeWhitespace(parsed.text ?? '');

  if (!text) {
    throw new IngestionError('Simple PDF parser returned empty text.');
  }

  const sections = splitIntoSections(parsed.text ?? '');
  const references = extractReferences(parsed.text ?? '');
  const { title, abstract } = extractTitleAndAbstract(parsed.text ?? '');

  return {
    parserName: 'pdf-parse',
    parserVersion: '2.x',
    confidence: 0.62,
    title,
    abstract,
    fullText: text,
    sections,
    references
  };
};

export const parseWithGrobid = async (filePath: string, grobidUrl: string | null): Promise<ParseOutput> => {
  if (!grobidUrl) {
    throw new IngestionError('GROBID URL is not configured.');
  }

  const url = new URL('/api/processFulltextDocument', grobidUrl);
  const buffer = await fs.readFile(filePath);
  const formData = new FormData();
  formData.set('input', new Blob([buffer], { type: 'application/pdf' }), basename(filePath));
  formData.set('consolidateHeader', '1');
  formData.set('consolidateCitations', '1');

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new IngestionError(`GROBID returned HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parseGrobidXml(xml);
  if (!parsed.fullText) {
    throw new IngestionError('GROBID response did not include extractable body text.');
  }

  return parsed;
};

export const resolvePdfUrlFromLandingPages = async (
  urls: Array<string | null | undefined>,
  logger: Logger
): Promise<string | null> => {
  const seen = new Set<string>();
  for (const candidate of urls) {
    if (!candidate) {
      continue;
    }

    const normalized = candidate.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    try {
      const discovered = await resolvePdfUrlFromLandingPage(normalized);
      if (discovered) {
        return discovered;
      }
    } catch (error) {
      logger.debug('Landing page PDF discovery failed', {
        paperUrl: normalized,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return null;
};

const resolvePdfUrlFromLandingPage = async (paperUrl: string): Promise<string | null> => {
  const response = await fetch(paperUrl, { headers: LANDING_PAGE_HEADERS });

  if (!response.ok) {
    return null;
  }

  const finalUrl = response.url || paperUrl;
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/pdf')) {
    return finalUrl;
  }

  const html = await response.text();
  if (!html) {
    return null;
  }

  for (const pattern of [...META_PDF_PATTERNS, ...LINK_PDF_PATTERNS]) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const resolved = resolveUrlCandidate(match[1], finalUrl);
      if (resolved) {
        return resolved;
      }
    }
  }

  const anchorMatch = html.match(PDF_LINK_REGEX);
  if (anchorMatch?.[1]) {
    return resolveUrlCandidate(anchorMatch[1], finalUrl);
  }

  return null;
};
