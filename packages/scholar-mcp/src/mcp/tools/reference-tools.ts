import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { manualWorkSchema, toToolError, type ToolRegistrar } from '../tool-helpers.js';

export const registerReferenceListTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'build_reference_list',
    {
      title: 'Build Reference List',
      description: 'Generate CSL-formatted bibliography and BibTeX entries from manuscript context or explicit works.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      },
      inputSchema: {
        style: z.enum(['apa', 'ieee', 'chicago', 'vancouver']).default('apa'),
        locale: z.string().default('en-US'),
        manuscript_text: z.string().optional(),
        works: z.array(manualWorkSchema).optional()
      }
    },
    async ({ style, locale, manuscript_text, works }): Promise<CallToolResult> => {
      try {
        if ((!manuscript_text || manuscript_text.trim().length === 0) && (!works || works.length === 0)) {
          throw new Error('Provide either manuscript_text or works.');
        }

        const normalizedWorks = (works ?? []).map((work) => ({
          title: work.title,
          abstract: work.abstract ?? null,
          year: work.year ?? null,
          venue: work.venue ?? null,
          doi: work.doi ?? null,
          url: work.url ?? null,
          paperId: work.doi ?? work.url ?? work.title,
          citationCount: work.citation_count ?? 0,
          influentialCitationCount: 0,
          referenceCount: 0,
          authors: (work.authors ?? []).map((name) => ({ name })),
          openAccess: {
            isOpenAccess: false,
            pdfUrl: null,
            license: null
          },
          externalIds: {},
          fieldsOfStudy: [],
          score: 0.5,
          provenance: []
        }));

        const result = await researchService.buildReferenceList({
          style,
          locale,
          manuscriptText: manuscript_text,
          works: normalizedWorks
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.warn('Reference list build failed', {
          tool: 'build_reference_list',
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};
