import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { Logger } from '../core/logger.js';
import type { ResearchService } from '../research/research-service.js';
import { ScholarError } from '../scholar/errors.js';
import type { ScholarService } from '../scholar/scholar-service.js';
import type { ScholarPaperResult } from '../scholar/types.js';

export interface McpToolContext {
  config: AppConfig;
  service: ScholarService;
  researchService: ResearchService;
  logger: Logger;
}

export type ToolRegistrar = (server: McpServer, context: McpToolContext) => void;

export const paperToLegacyShape = (paper: ScholarPaperResult) => ({
  Title: paper.title,
  Authors: paper.authorsLine,
  Abstract: paper.abstract,
  URL: paper.url,
  Year: paper.year,
  CitedBy: paper.citedByCount,
  CitedByURL: paper.citedByUrl,
  RelatedArticlesURL: paper.relatedArticlesUrl,
  Versions: paper.versionsCount,
  VersionsURL: paper.versionsUrl,
  PDFURL: paper.pdfUrl
});

export const toToolError = (error: unknown): CallToolResult => {
  const fallbackMessage = 'Unknown ScholarMCP error.';

  if (error instanceof ScholarError) {
    return {
      isError: true,
      content: [{ type: 'text', text: error.message }],
      structuredContent: {
        error: error.name,
        message: error.message,
        details: error.details
      }
    };
  }

  if (error instanceof Error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error.message }],
      structuredContent: {
        error: error.name,
        message: error.message
      }
    };
  }

  return {
    isError: true,
    content: [{ type: 'text', text: fallbackMessage }],
    structuredContent: {
      error: 'UnknownError',
      message: fallbackMessage
    }
  };
};

export const manualWorkSchema = z.object({
  title: z.string().min(1),
  abstract: z.string().optional(),
  year: z.number().int().optional(),
  venue: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  citation_count: z.number().int().optional(),
  authors: z.array(z.string()).optional()
});
