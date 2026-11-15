import type { AppConfig } from '../config.js';
import { Logger } from '../core/logger.js';
import { ScholarService } from '../scholar/scholar-service.js';
import type { CanonicalWork } from './types.js';
import { normalizeDoi, normalizeWhitespace, parseYear } from './utils.js';
import { ResearchHttpClient } from './http-client.js';
import { ResearchProviderError } from './errors.js';
import type { ProviderWork } from './providers/openalex-client.js';
import { OpenAlexClient } from './providers/openalex-client.js';
import { CrossrefClient } from './providers/crossref-client.js';
import { SemanticScholarClient } from './providers/semantic-scholar-client.js';
import { DEFAULT_SOURCES, cloneResult, providerWeight, type LiteratureSearchInput } from './literature-ranking.js';
import { mergeProviderWorks } from './literature-merge.js';

export type { LiteratureSearchInput } from './literature-ranking.js';

export interface LiteratureSearchResult {
  query: string;
  totalResults: number;
  results: CanonicalWork[];
  providerErrors: Array<{ provider: string; message: string }>;
}

interface CachedSearchResult {
  expiresAt: number;
  value: LiteratureSearchResult;
}

export class LiteratureService {
  private readonly httpClient: ResearchHttpClient;
  private readonly openAlexClient: OpenAlexClient;
  private readonly crossrefClient: CrossrefClient;
  private readonly semanticScholarClient: SemanticScholarClient;
  private readonly searchCache = new Map<string, CachedSearchResult>();

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly scholarService: ScholarService
  ) {
    this.httpClient = new ResearchHttpClient(config);
    this.openAlexClient = new OpenAlexClient(config, this.httpClient);
    this.crossrefClient = new CrossrefClient(config, this.httpClient);
    this.semanticScholarClient = new SemanticScholarClient(config, this.httpClient);
  }

  async searchGraph(input: LiteratureSearchInput): Promise<LiteratureSearchResult> {
    const requestedSources = new Set(input.sources ?? DEFAULT_SOURCES);
    const cacheKey = this.createCacheKey(input, requestedSources);
    const cached = this.getCache(cacheKey);
    if (cached) {
      this.logger.debug('Returning literature graph result from cache', {
        query: input.query,
        sources: [...requestedSources],
        limit: input.limit
      });
      return cached;
    }

    const providerErrors: Array<{ provider: string; message: string }> = [];
    const providerLimit = Math.max(
      input.limit,
      Math.ceil(input.limit * this.config.researchGraphProviderResultMultiplier)
    );

    const providerPromises: Array<Promise<ProviderWork[]>> = [];

    if (requestedSources.has('openalex')) {
      providerPromises.push(
        this.openAlexClient.searchWorks(input.query, providerLimit).catch((error) => {
          providerErrors.push({ provider: 'openalex', message: error instanceof Error ? error.message : String(error) });
          return [];
        })
      );
    }

    if (requestedSources.has('crossref')) {
      providerPromises.push(
        this.crossrefClient.searchWorks(input.query, providerLimit).catch((error) => {
          providerErrors.push({ provider: 'crossref', message: error instanceof Error ? error.message : String(error) });
          return [];
        })
      );
    }

    if (requestedSources.has('semantic_scholar')) {
      providerPromises.push(
        this.semanticScholarClient.searchWorks(input.query, providerLimit).catch((error) => {
          providerErrors.push({
            provider: 'semantic_scholar',
            message: error instanceof Error ? error.message : String(error)
          });
          return [];
        })
      );
    }

    if (requestedSources.has('scholar_scrape')) {
      providerPromises.push(
        this.searchWithScholarScrape(input.query, providerLimit).catch((error) => {
          providerErrors.push({ provider: 'scholar_scrape', message: error instanceof Error ? error.message : String(error) });
          return [];
        })
      );
    }

    const providerResults = (await Promise.all(providerPromises)).flat();

    const ranked = mergeProviderWorks({
      works: providerResults,
      yearRange: input.yearRange,
      fieldsOfStudy: input.fieldsOfStudy,
      limit: input.limit,
      requestedSources,
      fuzzyTitleThreshold: this.config.researchGraphFuzzyTitleThreshold
    });

    const result: LiteratureSearchResult = {
      query: input.query,
      totalResults: ranked.length,
      results: ranked,
      providerErrors
    };

    this.setCache(cacheKey, result);

    this.logger.debug('Literature graph search complete', {
      query: input.query,
      providers: [...requestedSources],
      providerLimit,
      mergedCount: ranked.length,
      providerErrors
    });

    return cloneResult(result);
  }

  async resolveByDoi(doi: string): Promise<CanonicalWork | null> {
    const normalized = normalizeDoi(doi);
    if (!normalized) {
      return null;
    }

    try {
      const openAlexExact = await this.openAlexClient.getWorkByDoi(normalized);
      if (openAlexExact) {
        return {
          title: openAlexExact.title,
          abstract: openAlexExact.abstract,
          year: openAlexExact.year,
          venue: openAlexExact.venue,
          doi: openAlexExact.doi,
          url: openAlexExact.url,
          paperId: openAlexExact.providerId,
          citationCount: openAlexExact.citationCount,
          influentialCitationCount: openAlexExact.influentialCitationCount,
          referenceCount: openAlexExact.referenceCount,
          authors: openAlexExact.authors,
          openAccess: {
            isOpenAccess: openAlexExact.openAccess.isOpenAccess,
            pdfUrl: openAlexExact.openAccess.pdfUrl,
            license: openAlexExact.openAccess.license
          },
          externalIds: openAlexExact.externalIds,
          fieldsOfStudy: openAlexExact.fieldsOfStudy,
          score: openAlexExact.score,
          provenance: [
            {
              provider: 'openalex',
              sourceUrl: openAlexExact.sourceUrl,
              fetchedAt: new Date().toISOString(),
              confidence: providerWeight.openalex
            }
          ]
        };
      }
    } catch (error) {
      if (!(error instanceof ResearchProviderError) || error.status !== 404) {
        this.logger.warn('OpenAlex DOI resolve failed', {
          doi: normalized,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const result = await this.searchGraph({
      query: normalized,
      limit: 50,
      sources: ['openalex', 'crossref', 'semantic_scholar']
    });

    return (
      result.results.find((item) => normalizeDoi(item.doi) === normalized) ??
      result.results.find((item) => normalizeDoi(item.externalIds.doi) === normalized) ??
      result.results[0] ??
      null
    );
  }

  private createCacheKey(input: LiteratureSearchInput, sources: Set<string>): string {
    const normalizedFields = (input.fieldsOfStudy ?? []).map((field) => field.trim().toLowerCase()).sort();
    const normalizedSources = [...sources].sort();
    const normalizedYearRange = input.yearRange ? `${input.yearRange[0]}:${input.yearRange[1]}` : 'none';

    return JSON.stringify({
      query: normalizeWhitespace(input.query).toLowerCase(),
      limit: input.limit,
      yearRange: normalizedYearRange,
      fields: normalizedFields,
      sources: normalizedSources
    });
  }

  private getCache(cacheKey: string): LiteratureSearchResult | null {
    if (this.config.researchGraphCacheTtlMs <= 0) {
      return null;
    }

    const cached = this.searchCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return cloneResult(cached.value);
  }

  private setCache(cacheKey: string, value: LiteratureSearchResult): void {
    if (this.config.researchGraphCacheTtlMs <= 0) {
      return;
    }

    const now = Date.now();
    for (const [key, cached] of this.searchCache.entries()) {
      if (cached.expiresAt <= now) {
        this.searchCache.delete(key);
      }
    }

    this.searchCache.set(cacheKey, {
      value: cloneResult(value),
      expiresAt: now + this.config.researchGraphCacheTtlMs
    });

    while (this.searchCache.size > this.config.researchGraphMaxCacheEntries) {
      const oldestKey = this.searchCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.searchCache.delete(oldestKey);
    }
  }

  private async searchWithScholarScrape(query: string, limit: number): Promise<ProviderWork[]> {
    const result = await this.scholarService.searchKeywords({
      query,
      numResults: limit,
      start: 0,
      language: this.config.scholarLanguage
    });

    return result.papers.map((paper) => ({
      provider: 'scholar_scrape',
      providerId: paper.url ?? `scholar:${paper.title}`,
      title: paper.title,
      abstract: paper.abstract || null,
      year: parseYear(paper.year),
      venue: null,
      doi: null,
      url: paper.url,
      citationCount: paper.citedByCount,
      influentialCitationCount: 0,
      referenceCount: 0,
      authors: paper.authorsLine
        .split(',')
        .map((name) => ({ name: name.trim() }))
        .filter((author) => author.name.length > 0),
      openAccess: {
        isOpenAccess: Boolean(paper.pdfUrl),
        pdfUrl: paper.pdfUrl,
        license: null
      },
      externalIds: {},
      fieldsOfStudy: [],
      score: 0.4,
      sourceUrl: result.requestedUrl
    }));
  }
}
