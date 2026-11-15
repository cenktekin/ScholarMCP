import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { toToolError, type ToolRegistrar } from '../tool-helpers.js';

export const registerIngestPaperFulltextTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'ingest_paper_fulltext',
    {
      title: 'Ingest Full-Text Paper',
      description:
        'Resolve and ingest a full-text PDF from DOI/URL/local file, then parse into a structured document using GROBID/simple fallback pipeline.',
      annotations: {
        readOnlyHint: false,
        openWorldHint: true
      },
      inputSchema: {
        doi: z.string().optional().describe('DOI (recommended for OA PDF discovery).'),
        paper_url: z.string().url().optional().describe('Landing page URL for the paper.'),
        pdf_url: z.string().url().optional().describe('Direct PDF URL.'),
        local_pdf_path: z.string().optional().describe('Local absolute or workspace-relative PDF path.'),
        parse_mode: z.enum(['auto', 'grobid', 'simple']).default('auto'),
        ocr_enabled: z.boolean().default(true).describe('Reserved for OCR-capable parser modes.')
      }
    },
    async ({ doi, paper_url, pdf_url, local_pdf_path, parse_mode, ocr_enabled }): Promise<CallToolResult> => {
      try {
        if (!doi && !paper_url && !pdf_url && !local_pdf_path) {
          throw new Error('Provide at least one source: doi, paper_url, pdf_url, or local_pdf_path.');
        }

        const job = researchService.ingestPaperFullText({
          doi,
          paperUrl: paper_url,
          pdfUrl: pdf_url,
          localPdfPath: local_pdf_path,
          parseMode: parse_mode,
          ocrEnabled: ocr_enabled
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(job, null, 2) }],
          structuredContent: job as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.warn('Full-text ingestion start failed', {
          tool: 'ingest_paper_fulltext',
          doi,
          paper_url,
          pdf_url,
          local_pdf_path,
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};

export const registerIngestionStatusTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'get_ingestion_status',
    {
      title: 'Get Full-Text Ingestion Status',
      description: 'Get the status of a previously started ingest_paper_fulltext job.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      },
      inputSchema: {
        job_id: z.string().min(1).describe('Ingestion job id returned by ingest_paper_fulltext.')
      }
    },
    async ({ job_id }): Promise<CallToolResult> => {
      try {
        const job = researchService.getIngestionStatus(job_id);
        const payload: Record<string, unknown> = {
          ...job
        };

        if (job.status === 'succeeded') {
          const document = researchService.getParsedDocument(job.documentId);
          payload.document_summary = {
            documentId: document.documentId,
            title: document.title,
            abstract: document.abstract,
            parser: document.parser,
            sections: document.sections.length,
            references: document.references.length,
            createdAt: document.createdAt
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload
        };
      } catch (error) {
        logger.warn('Ingestion status lookup failed', {
          tool: 'get_ingestion_status',
          job_id,
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};

export const registerExtractGranularDetailsTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'extract_granular_paper_details',
    {
      title: 'Extract Granular Paper Details',
      description:
        'Extract claims, methods, limitations, datasets, metrics, and section-aware summaries from a parsed document.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      },
      inputSchema: {
        document_id: z.string().min(1),
        sections: z.array(z.string().min(1)).optional(),
        include_references: z.boolean().default(true)
      }
    },
    async ({ document_id, sections, include_references }): Promise<CallToolResult> => {
      try {
        const result = researchService.extractGranularPaperDetails(document_id, {
          sections,
          includeReferences: include_references
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.warn('Granular extraction failed', {
          tool: 'extract_granular_paper_details',
          document_id,
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};
