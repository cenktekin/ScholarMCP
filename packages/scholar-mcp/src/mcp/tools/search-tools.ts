import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { paperToLegacyShape, toToolError, type ToolRegistrar } from '../tool-helpers.js';

export const registerSearchLiteratureGraphTool: ToolRegistrar = (server, { logger, researchService }) => {
  server.registerTool(
    'search_literature_graph',
    {
      title: 'Search Federated Literature Graph',
      description:
        'Search multiple scholarly metadata providers (OpenAlex, Crossref, Semantic Scholar, optional Scholar scrape) and return canonicalized paper records.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      },
      inputSchema: {
        query: z.string().min(1).describe('Research query string.'),
        year_range: z
          .object({ start: z.number().int(), end: z.number().int() })
          .refine(({ start, end }) => start <= end, {
            message: 'year_range.start must be less than or equal to year_range.end'
          })
          .optional()
          .describe('Optional publication year range as {start, end}.'),
        fields_of_study: z.array(z.string().min(1)).optional().describe('Optional field-of-study filters.'),
        limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of merged results.'),
        sources: z
          .array(z.enum(['openalex', 'crossref', 'semantic_scholar', 'scholar_scrape']))
          .optional()
          .describe('Optional source allow-list.')
      }
    },
    async (args): Promise<CallToolResult> => {
      try {
        const normalizedYearRange = args.year_range
          ? [args.year_range.start, args.year_range.end] as [number, number]
          : undefined;

        const result = await researchService.searchLiteratureGraph({
          query: args.query,
          yearRange: normalizedYearRange,
          fieldsOfStudy: args.fields_of_study,
          limit: args.limit,
          sources: args.sources
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>
        };
      } catch (error) {
        logger.warn('Federated literature search failed', {
          tool: 'search_literature_graph',
          query: args.query,
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};

export const registerScholarKeywordSearchTool: ToolRegistrar = (server, { config, logger, service }) => {
  server.registerTool(
    'search_google_scholar_key_words',
    {
      title: 'Search Google Scholar by Keywords',
      description: 'Search Google Scholar using keywords and return paper metadata.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      },
      inputSchema: {
        query: z.string().min(1).describe('Search query string'),
        num_results: z.number().int().min(1).max(20).default(5).describe('Number of results to return'),
        start: z.number().int().min(0).default(0).describe('Offset for pagination (0, 10, 20, ...)'),
        language: z.string().default(config.scholarLanguage).describe('Google Scholar language code (e.g., en)')
      }
    },
    async ({ query, num_results, start, language }): Promise<CallToolResult> => {
      try {
        const result = await service.searchKeywords({
          query,
          numResults: num_results,
          start,
          language
        });

        const legacyResults = result.papers.map(paperToLegacyShape);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: result.query,
                  total_results_text: result.totalResultsText,
                  next_page_start: result.nextPageStart,
                  results: legacyResults
                },
                null,
                2
              )
            }
          ],
          structuredContent: {
            query: result.query,
            totalResultsText: result.totalResultsText,
            nextPageStart: result.nextPageStart,
            results: legacyResults
          }
        };
      } catch (error) {
        logger.warn('Keyword search tool failed', {
          tool: 'search_google_scholar_key_words',
          query,
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};

export const registerScholarAdvancedSearchTool: ToolRegistrar = (server, { config, logger, service }) => {
  server.registerTool(
    'search_google_scholar_advanced',
    {
      title: 'Search Google Scholar with Advanced Filters',
      description:
        'Search Google Scholar using keyword, author, year-range, phrase, and exclusion filters.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      },
      inputSchema: {
        query: z.string().min(1).describe('General search query'),
        author: z.string().optional().describe('Author filter value'),
        year_range: z
          .object({ start: z.number().int(), end: z.number().int() })
          .refine(({ start, end }) => start <= end, {
            message: 'year_range.start must be less than or equal to year_range.end'
          })
          .optional()
          .describe('Year range as { start, end }'),
        exact_phrase: z.string().optional().describe('Exact phrase that must appear in results'),
        exclude_words: z.string().optional().describe('Words that should be excluded from results'),
        title_only: z.boolean().default(false).describe('Restrict search terms to title only'),
        num_results: z.number().int().min(1).max(20).default(5),
        start: z.number().int().min(0).default(0),
        language: z.string().default(config.scholarLanguage)
      }
    },
    async (args): Promise<CallToolResult> => {
      try {
        const normalizedYearRange = args.year_range
          ? [args.year_range.start, args.year_range.end] as [number, number]
          : undefined;

        const result = await service.searchAdvanced({
          query: args.query,
          author: args.author,
          yearRange: normalizedYearRange,
          exactPhrase: args.exact_phrase,
          excludeWords: args.exclude_words,
          titleOnly: args.title_only,
          numResults: args.num_results,
          start: args.start,
          language: args.language
        });

        const legacyResults = result.papers.map(paperToLegacyShape);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: result.query,
                  total_results_text: result.totalResultsText,
                  next_page_start: result.nextPageStart,
                  results: legacyResults
                },
                null,
                2
              )
            }
          ],
          structuredContent: {
            query: result.query,
            totalResultsText: result.totalResultsText,
            nextPageStart: result.nextPageStart,
            results: legacyResults
          }
        };
      } catch (error) {
        logger.warn('Advanced search tool failed', {
          tool: 'search_google_scholar_advanced',
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};

export const registerAuthorInfoTool: ToolRegistrar = (server, { config, logger, service }) => {
  server.registerTool(
    'get_author_info',
    {
      title: 'Get Author Info',
      description: 'Retrieve a Google Scholar author profile and top publications by author name.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      },
      inputSchema: {
        author_name: z.string().min(1).describe('Full author name to resolve in Google Scholar'),
        max_publications: z.number().int().min(1).max(20).default(5),
        language: z.string().default(config.scholarLanguage)
      }
    },
    async ({ author_name, max_publications, language }): Promise<CallToolResult> => {
      try {
        const author = await service.getAuthorInfo(author_name, max_publications, language);

        const pythonCompatibilityPayload = {
          name: author.authorName,
          affiliation: author.affiliation,
          interests: author.interests,
          citedby: author.metrics.citationsAll ?? 0,
          author_id: author.authorId,
          profile_url: author.profileUrl,
          verified_email: author.verifiedEmail,
          homepage: author.homepageUrl,
          metrics: {
            citations_all: author.metrics.citationsAll,
            citations_since_2021: author.metrics.citationsSince,
            h_index_all: author.metrics.hIndexAll,
            h_index_since_2021: author.metrics.hIndexSince,
            i10_index_all: author.metrics.i10IndexAll,
            i10_index_since_2021: author.metrics.i10IndexSince
          },
          publications: author.publications.map((publication) => ({
            title: publication.title,
            year: publication.year,
            citations: publication.citations,
            authors: publication.authors,
            venue: publication.venue,
            url: publication.detailUrl
          }))
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(pythonCompatibilityPayload, null, 2) }],
          structuredContent: pythonCompatibilityPayload
        };
      } catch (error) {
        logger.warn('Author info tool failed', {
          tool: 'get_author_info',
          author_name,
          error: error instanceof Error ? error.message : String(error)
        });
        return toToolError(error);
      }
    }
  );
};
