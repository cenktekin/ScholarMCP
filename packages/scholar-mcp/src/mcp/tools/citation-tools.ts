import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { toToolError, type ToolRegistrar } from '../tool-helpers.js';

export const registerContextualCitationTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'suggest_contextual_citations',
    {
      title: 'Suggest Context-Aware Citations',
      description: 'Recommend citations from the federated literature graph based on manuscript context.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      },
      inputSchema: {
        manuscript_text: z.string().min(20),
        cursor_context: z.string().optional(),
        style: z.enum(['apa', 'ieee', 'chicago', 'vancouver']).default('apa'),
        k: z.number().int().min(1).max(30).default(10),
        recency_bias: z.number().min(0).max(1).default(0.5)
      }
    },
    async ({ manuscript_text, cursor_context, style, k, recency_bias }): Promise<CallToolResult> => {
      try {
        const result = await researchService.suggestContextualCitations({
          manuscriptText: manuscript_text,
          cursorContext: cursor_context,
          style,
          k,
          recencyBias: recency_bias
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.warn('Citation suggestion failed', {
          tool: 'suggest_contextual_citations',
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};

export const registerCitationValidationTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'validate_manuscript_citations',
    {
      title: 'Validate Manuscript Citations',
      description: 'Validate inline citations against reference entries and detect missing or uncited references.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      },
      inputSchema: {
        manuscript_text: z.string().min(20),
        style: z.enum(['apa', 'ieee', 'chicago', 'vancouver']).optional(),
        references: z.array(
          z.object({
            id: z.string().optional(),
            formatted: z.string().min(1),
            bibtex: z.string().optional()
          })
        )
      }
    },
    async ({ manuscript_text, references, style }): Promise<CallToolResult> => {
      try {
        const normalizedReferences = references.map((reference, index) => ({
          id: reference.id ?? `ref-${index + 1}`,
          csl: {},
          formatted: reference.formatted,
          bibtex: reference.bibtex ?? '',
          sourceWork: {
            title: reference.formatted,
            abstract: null,
            year: null,
            venue: null,
            doi: null,
            url: null,
            paperId: reference.id ?? `ref-${index + 1}`,
            citationCount: 0,
            influentialCitationCount: 0,
            referenceCount: 0,
            authors: [],
            openAccess: {
              isOpenAccess: false,
              license: null,
              pdfUrl: null
            },
            externalIds: {},
            fieldsOfStudy: [],
            score: 0,
            provenance: []
          }
        }));

        const result = researchService.validateManuscriptCitations(manuscript_text, normalizedReferences, {
          style
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.warn('Citation validation failed', {
          tool: 'validate_manuscript_citations',
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};
