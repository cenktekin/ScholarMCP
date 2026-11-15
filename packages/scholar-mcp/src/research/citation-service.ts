import { Cite } from '@citation-js/core';
import '@citation-js/plugin-csl';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-doi';
import type { CanonicalWork, CitationCandidate, CitationStyle, ReferenceEntry } from './types.js';
import { clamp, tokenizeForRanking, overlapScore } from './utils.js';
import type { LiteratureService } from './literature-service.js';
import {
  buildCompletenessDiagnostic,
  buildInlineSuggestion,
  extractQuery,
  findDuplicateReferences,
  formatSingleReference,
  normalizeStyle,
  parseAuthorYearCitations,
  parseNumericInlineCitations,
  type ReferenceCompletenessDiagnostic
} from './citation-formatting.js';

export type { ReferenceCompletenessDiagnostic } from './citation-formatting.js';

export interface SuggestCitationsInput {
  manuscriptText: string;
  cursorContext?: string;
  style: CitationStyle;
  k: number;
  recencyBias: number;
}

export interface SuggestedCitationsResult {
  queryUsed: string;
  suggestions: CitationCandidate[];
  inlineSuggestion: string;
}

export interface BuildReferenceListInput {
  style: CitationStyle;
  locale?: string;
  works?: CanonicalWork[];
  manuscriptText?: string;
}

export interface ReferenceListResult {
  style: CitationStyle;
  locale: string;
  references: ReferenceEntry[];
  bibliographyText: string;
  bibtex: string;
}

export interface CitationValidationResult {
  inlineCitationCount: number;
  referenceCount: number;
  missingReferences: string[];
  uncitedReferences: string[];
  styleWarnings: string[];
  duplicateReferences: string[];
  completenessDiagnostics: ReferenceCompletenessDiagnostic[];
  normalizationSuggestions: string[];
}

export class CitationService {
  constructor(private readonly literatureService: LiteratureService) {}

  async suggestContextualCitations(input: SuggestCitationsInput): Promise<SuggestedCitationsResult> {
    const query = extractQuery(input.manuscriptText, input.cursorContext);
    const fallbackQuery = query.length > 0 ? query : input.manuscriptText.slice(0, 200);

    const graphResult = await this.literatureService.searchGraph({
      query: fallbackQuery,
      limit: clamp(input.k * 3, input.k, 30),
      sources: ['semantic_scholar', 'openalex', 'crossref']
    });

    const contextTokens = tokenizeForRanking(input.cursorContext ?? input.manuscriptText);
    const currentYear = new Date().getFullYear();

    const scored = graphResult.results
      .map((work) => {
        const text = `${work.title} ${work.abstract ?? ''} ${work.fieldsOfStudy.join(' ')}`;
        const overlap = overlapScore(contextTokens, tokenizeForRanking(text));
        const citationScore = Math.log10(work.citationCount + 1) / 4;
        const recencyScore = work.year ? 1 / Math.max(1, currentYear - work.year + 1) : 0.2;
        const finalScore =
          0.55 * overlap +
          0.3 * Math.min(1, citationScore) +
          0.15 * clamp(recencyScore * Math.max(0, input.recencyBias), 0, 1);

        return {
          work,
          relevanceScore: finalScore,
          rationale: `overlap=${overlap.toFixed(2)}, citations=${work.citationCount}, year=${work.year ?? 'n/a'}`,
          matchedContext: (work.abstract ?? work.title).slice(0, 280)
        } satisfies CitationCandidate;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, input.k);

    return {
      queryUsed: fallbackQuery,
      suggestions: scored,
      inlineSuggestion: buildInlineSuggestion(
        input.style,
        scored.map((candidate) => candidate.work)
      )
    };
  }

  async buildReferenceList(input: BuildReferenceListInput): Promise<ReferenceListResult> {
    const locale = input.locale ?? 'en-US';

    let works = input.works ?? [];
    if (works.length === 0 && input.manuscriptText) {
      const suggestions = await this.suggestContextualCitations({
        manuscriptText: input.manuscriptText,
        style: input.style,
        k: 15,
        recencyBias: 0.6
      });
      works = suggestions.suggestions.map((candidate) => candidate.work);
    }

    const deduped = new Map<string, CanonicalWork>();
    for (const work of works) {
      const key = work.doi ?? work.paperId;
      if (!deduped.has(key)) {
        deduped.set(key, work);
      }
    }

    const entries = [...deduped.values()].map((work) => formatSingleReference(work, input.style, locale));

    const cite = new Cite(entries.map((entry) => entry.csl));
    let bibliographyText = '';
    try {
      bibliographyText = cite
        .format('bibliography', {
          format: 'text',
          template: normalizeStyle(input.style),
          lang: locale
        })
        .trim();
    } catch {
      bibliographyText = entries.map((entry) => entry.formatted).join('\n');
    }

    let bibtex = '';
    try {
      bibtex = cite.format('bibtex').trim();
    } catch {
      bibtex = entries.map((entry) => entry.bibtex).join('\n\n');
    }

    return {
      style: input.style,
      locale,
      references: entries,
      bibliographyText,
      bibtex
    };
  }

  validateManuscriptCitations(
    manuscriptText: string,
    references: ReferenceEntry[],
    options?: { style?: CitationStyle }
  ): CitationValidationResult {
    const numericCitationParse = parseNumericInlineCitations(manuscriptText);
    const numericCitations = numericCitationParse.numbers;
    const authorYearCitations = parseAuthorYearCitations(manuscriptText);

    const placeholders = [...manuscriptText.matchAll(/\[(?:\?|TODO|CITATION)\]/gi)].map((match) => match[0] ?? '');

    const missingReferences = new Set<string>();
    for (const value of numericCitations) {
      if (value < 1 || value > references.length) {
        missingReferences.add(`[${value}]`);
      }
    }

    for (const citation of authorYearCitations) {
      const matched = references.some((entry) => entry.formatted.toLowerCase().includes(citation.author.toLowerCase()));
      if (!matched) {
        missingReferences.add(citation.raw);
      }
    }

    const uncitedReferences = references
      .map((entry, index) => ({
        label: `[${index + 1}] ${entry.formatted}`,
        referenced:
          numericCitations.includes(index + 1) ||
          authorYearCitations.some((citation) => entry.formatted.toLowerCase().includes(citation.author.toLowerCase()))
      }))
      .filter((entry) => !entry.referenced)
      .map((entry) => entry.label);

    const completenessDiagnostics = references.map((reference, index) => buildCompletenessDiagnostic(reference, index));
    const normalizationSuggestions = [...new Set(completenessDiagnostics.flatMap((item) => item.suggestions))];

    const styleWarnings = [...placeholders, ...numericCitationParse.invalidChunks];

    if (references.length === 0) {
      styleWarnings.push('Reference list is empty.');
    }

    if (numericCitations.length > 0 && authorYearCitations.length > 0) {
      styleWarnings.push('Mixed numeric and author-year inline citation patterns detected.');
    }

    const expectedStyle = options?.style;
    if (expectedStyle === 'ieee' || expectedStyle === 'vancouver') {
      if (authorYearCitations.length > 0) {
        styleWarnings.push(`Expected numeric citations for ${expectedStyle.toUpperCase()} style.`);
      }
    }

    if (expectedStyle === 'apa' || expectedStyle === 'chicago') {
      if (numericCitations.length > 0) {
        styleWarnings.push(`Expected author-year citations for ${expectedStyle.toUpperCase()} style.`);
      }
    }

    if (expectedStyle === 'apa') {
      const referencesMissingDoiUrl = completenessDiagnostics.filter((item) => item.missingPersistentIdentifier).length;
      if (referencesMissingDoiUrl > 0) {
        styleWarnings.push(
          `${referencesMissingDoiUrl} reference(s) are missing a DOI/URL, which weakens APA traceability requirements.`
        );
      }
    }

    return {
      inlineCitationCount: numericCitations.length + authorYearCitations.length,
      referenceCount: references.length,
      missingReferences: [...missingReferences],
      uncitedReferences,
      styleWarnings,
      duplicateReferences: findDuplicateReferences(references),
      completenessDiagnostics,
      normalizationSuggestions
    };
  }
}
