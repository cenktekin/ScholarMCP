import type { ProviderWork } from './providers/openalex-client.js';
import { normalizeWhitespace, tokenizeForRanking } from './utils.js';

export interface LiteratureSearchInput {
  query: string;
  yearRange?: [number, number];
  fieldsOfStudy?: string[];
  limit: number;
  sources?: Array<'openalex' | 'crossref' | 'semantic_scholar' | 'scholar_scrape'>;
}

export const providerWeight: Record<ProviderWork['provider'], number> = {
  openalex: 1,
  crossref: 0.9,
  semantic_scholar: 1.1,
  scholar_scrape: 0.7
};

export const DEFAULT_SOURCES: LiteratureSearchInput['sources'] = ['openalex', 'crossref', 'semantic_scholar'];

export const scoreFromCitations = (citations: number): number => {
  if (citations <= 0) {
    return 0;
  }

  return Math.min(1, Math.log10(citations + 1) / 4);
};

export const normalizeTitleKey = (title: string): string =>
  normalizeWhitespace(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');

export const tokenSetFromTitle = (title: string): Set<string> => new Set(tokenizeForRanking(title));

export const setJaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }

  return overlap / (a.size + b.size - overlap);
};

export const mergeFields = (current: string[], incoming: string[]): string[] => {
  const set = new Set(current);
  for (const value of incoming) {
    if (value) {
      set.add(value);
    }
  }

  return [...set];
};

export const isWithinYearRange = (year: number | null, range?: [number, number]): boolean => {
  if (!range || !year) {
    return true;
  }

  return year >= range[0] && year <= range[1];
};

export const matchesFieldOfStudy = (work: ProviderWork, requestedFields?: string[]): boolean => {
  if (!requestedFields || requestedFields.length === 0) {
    return true;
  }

  const normalized = new Set(work.fieldsOfStudy.map((field) => field.trim().toLowerCase()));
  return requestedFields.some((field) => normalized.has(field.trim().toLowerCase()));
};

export const yearsCompatible = (a: number | null, b: number | null): boolean => !a || !b || Math.abs(a - b) <= 2;

export const normalizeAuthorName = (name: string): string =>
  normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');

export const sharesAuthorSignal = (
  left: Array<{ name: string; authorId?: string | null }>,
  right: Array<{ name: string; authorId?: string | null }>
): boolean => {
  if (left.length === 0 || right.length === 0) {
    return true;
  }

  const leftIds = new Set(left.map((author) => author.authorId).filter((id): id is string => Boolean(id)));
  if (leftIds.size > 0 && right.some((author) => author.authorId && leftIds.has(author.authorId))) {
    return true;
  }

  const leftNames = new Set(left.map((author) => normalizeAuthorName(author.name)).filter((name) => name.length > 0));
  return right.some((author) => leftNames.has(normalizeAuthorName(author.name)));
};

export const cloneResult = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
};
