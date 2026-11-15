import type { CanonicalWork, ProvenanceRecord } from './types.js';
import { normalizeDoi } from './utils.js';
import type { ProviderWork } from './providers/openalex-client.js';
import {
  isWithinYearRange,
  matchesFieldOfStudy,
  mergeFields,
  normalizeTitleKey,
  providerWeight,
  scoreFromCitations,
  setJaccard,
  sharesAuthorSignal,
  tokenSetFromTitle,
  yearsCompatible
} from './literature-ranking.js';

export interface MergeProviderWorksInput {
  works: ProviderWork[];
  yearRange?: [number, number];
  fieldsOfStudy?: string[];
  limit: number;
  requestedSources: Set<string>;
  fuzzyTitleThreshold: number;
}

export const mergeProviderWorks = (input: MergeProviderWorksInput): CanonicalWork[] => {
  const filtered = input.works.filter(
    (work) => isWithinYearRange(work.year, input.yearRange) && matchesFieldOfStudy(work, input.fieldsOfStudy)
  );

  const merged = new Map<string, CanonicalWork>();
  const doiToKey = new Map<string, string>();
  const titleToKeys = new Map<string, Set<string>>();

  const indexTitle = (titleKey: string, key: string): void => {
    const existing = titleToKeys.get(titleKey) ?? new Set<string>();
    existing.add(key);
    titleToKeys.set(titleKey, existing);
  };

  const resolveTargetKey = (work: ProviderWork): string | null => {
    const normalizedDoi = normalizeDoi(work.doi);
    if (normalizedDoi && doiToKey.has(normalizedDoi)) {
      return doiToKey.get(normalizedDoi) ?? null;
    }

    const titleKey = normalizeTitleKey(work.title);
    const exactCandidateKeys = [...(titleToKeys.get(titleKey) ?? [])];
    for (const key of exactCandidateKeys) {
      const candidate = merged.get(key);
      if (!candidate) {
        continue;
      }

      if (yearsCompatible(candidate.year, work.year) && sharesAuthorSignal(candidate.authors, work.authors)) {
        return key;
      }
    }

    const incomingTokens = tokenSetFromTitle(work.title);
    let bestKey: string | null = null;
    let bestSimilarity = 0;

    for (const [key, candidate] of merged.entries()) {
      if (!yearsCompatible(candidate.year, work.year)) {
        continue;
      }

      if (!sharesAuthorSignal(candidate.authors, work.authors)) {
        continue;
      }

      const similarity = setJaccard(tokenSetFromTitle(candidate.title), incomingTokens);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestKey = key;
      }
    }

    if (bestKey && bestSimilarity >= input.fuzzyTitleThreshold) {
      return bestKey;
    }

    return null;
  };

  for (const work of filtered) {
    const targetKey = resolveTargetKey(work);
    const normalizedDoi = normalizeDoi(work.doi);
    const titleKey = normalizeTitleKey(work.title);
    const confidence = providerWeight[work.provider] ?? 0.8;
    const provenance: ProvenanceRecord = {
      provider: work.provider,
      sourceUrl: work.sourceUrl,
      fetchedAt: new Date().toISOString(),
      confidence
    };

    const relevanceScore = 0.6 * work.score + 0.3 * scoreFromCitations(work.citationCount) + 0.1 * confidence;

    if (!targetKey) {
      const generatedKey = normalizedDoi ?? `title:${titleKey}:year:${work.year ?? 'na'}`;

      merged.set(generatedKey, {
        title: work.title,
        abstract: work.abstract,
        year: work.year,
        venue: work.venue,
        doi: normalizedDoi,
        url: work.url,
        paperId: work.providerId,
        citationCount: work.citationCount,
        influentialCitationCount: work.influentialCitationCount,
        referenceCount: work.referenceCount,
        authors: work.authors,
        openAccess: {
          isOpenAccess: work.openAccess.isOpenAccess,
          pdfUrl: work.openAccess.pdfUrl,
          license: work.openAccess.license
        },
        externalIds: work.externalIds,
        fieldsOfStudy: work.fieldsOfStudy,
        score: relevanceScore,
        provenance: [provenance]
      });

      if (normalizedDoi) {
        doiToKey.set(normalizedDoi, generatedKey);
      }
      indexTitle(titleKey, generatedKey);
      continue;
    }

    const existing = merged.get(targetKey);
    if (!existing) {
      continue;
    }

    existing.abstract = existing.abstract ?? work.abstract;
    existing.year = existing.year ?? work.year;
    existing.venue = existing.venue ?? work.venue;
    existing.url = existing.url ?? work.url;
    existing.doi = existing.doi ?? normalizedDoi;
    existing.citationCount = Math.max(existing.citationCount, work.citationCount);
    existing.influentialCitationCount = Math.max(existing.influentialCitationCount, work.influentialCitationCount);
    existing.referenceCount = Math.max(existing.referenceCount, work.referenceCount);
    existing.authors = existing.authors.length > 0 ? existing.authors : work.authors;
    existing.fieldsOfStudy = mergeFields(existing.fieldsOfStudy, work.fieldsOfStudy);
    existing.externalIds = {
      ...existing.externalIds,
      ...work.externalIds
    };
    existing.openAccess = {
      isOpenAccess: existing.openAccess.isOpenAccess || work.openAccess.isOpenAccess,
      pdfUrl: existing.openAccess.pdfUrl ?? work.openAccess.pdfUrl,
      license: existing.openAccess.license ?? work.openAccess.license
    };
    existing.provenance.push(provenance);
    existing.score = Math.max(existing.score, relevanceScore);

    const latestDoi = existing.doi ?? normalizedDoi;
    if (latestDoi) {
      doiToKey.set(latestDoi, targetKey);
    }
    indexTitle(titleKey, targetKey);
  }

  const currentYear = new Date().getFullYear();
  return [...merged.values()]
    .map((work) => {
      const citationScore = scoreFromCitations(work.citationCount);
      const recencyScore = work.year ? 1 / Math.max(1, currentYear - work.year + 1) : 0.15;
      const diversityScore =
        Math.min(1, new Set(work.provenance.map((record) => record.provider)).size / Math.max(1, input.requestedSources.size));
      const blended =
        0.5 * work.score + 0.25 * citationScore + 0.15 * diversityScore + 0.1 * Math.min(1, recencyScore * 2);

      return {
        ...work,
        score: blended
      };
    })
    .sort((a, b) => b.score - a.score || (b.citationCount ?? 0) - (a.citationCount ?? 0))
    .slice(0, input.limit);
};
