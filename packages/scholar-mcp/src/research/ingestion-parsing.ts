import { resolve } from 'node:path';
import type { ParsedReference, SectionChunk } from './types.js';
import { makeStableId, normalizeWhitespace, parseYear } from './utils.js';

export interface ParseOutput {
  parserName: string;
  parserVersion: string;
  confidence: number;
  title: string | null;
  abstract: string | null;
  fullText: string;
  sections: SectionChunk[];
  references: ParsedReference[];
}

export const DOI_REGEX = /10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i;
export const PDF_LINK_REGEX = /href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i;

export const toAbsolutePath = (value: string): string =>
  value.startsWith('/') ? value : resolve(process.cwd(), value);

const splitLines = (text: string): string[] => text.split(/\r?\n/).map((line) => line.trim());

const isLikelyHeading = (line: string): boolean =>
  /^(abstract|introduction|background|related work|method(?:s)?|materials|results|discussion|conclusion|limitations|references)\b/i.test(
    line.trim()
  );

export const splitIntoSections = (text: string): SectionChunk[] => {
  const lines = splitLines(text).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const sections: SectionChunk[] = [];
  let currentHeading = 'Body';
  let currentLines: string[] = [];

  const pushCurrent = () => {
    const sectionText = normalizeWhitespace(currentLines.join(' '));
    if (sectionText.length === 0) {
      return;
    }

    sections.push({
      id: makeStableId([currentHeading, sectionText.slice(0, 120)], 'section'),
      heading: currentHeading,
      text: sectionText,
      pageStart: null,
      pageEnd: null
    });
  };

  for (const line of lines) {
    if (isLikelyHeading(line) && currentLines.length > 0) {
      pushCurrent();
      currentHeading = line;
      currentLines = [];
      continue;
    }

    if (isLikelyHeading(line) && currentLines.length === 0) {
      currentHeading = line;
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    pushCurrent();
  }

  return sections;
};

export const extractReferences = (text: string): ParsedReference[] => {
  const lines = splitLines(text);
  const referencesStart = lines.findIndex((line) => /^references$/i.test(line));
  const sourceLines = referencesStart >= 0 ? lines.slice(referencesStart + 1) : lines.slice(-120);

  return sourceLines
    .filter((line) => line.length > 30)
    .slice(0, 60)
    .map((line) => {
      const doi = line.match(DOI_REGEX)?.[0]?.toLowerCase() ?? null;
      const year = parseYear(line);
      return {
        rawText: line,
        doi,
        title: null,
        year,
        authors: []
      } satisfies ParsedReference;
    });
};

export const extractTitleAndAbstract = (text: string): { title: string | null; abstract: string | null } => {
  const lines = splitLines(text).filter((line) => line.length > 0);
  const title = lines[0] ?? null;

  let abstract: string | null = null;
  const abstractIndex = lines.findIndex((line) => /^abstract$/i.test(line) || /^abstract[:\s]/i.test(line));
  if (abstractIndex >= 0) {
    abstract = normalizeWhitespace(lines.slice(abstractIndex, abstractIndex + 6).join(' '));
  }

  return {
    title,
    abstract
  };
};

export const parseGrobidXml = (xml: string): ParseOutput => {
  const title = xml.match(/<title[^>]*type="main"[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  const body = xml.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  const text = normalizeWhitespace(body.replace(/<[^>]+>/g, ' '));

  const references = [...xml.matchAll(/<biblStruct[\s\S]*?<\/biblStruct>/gim)]
    .slice(0, 120)
    .map((entry) => {
      const raw = normalizeWhitespace(entry[0].replace(/<[^>]+>/g, ' '));
      const doi = entry[0].match(DOI_REGEX)?.[0]?.toLowerCase() ?? null;
      const refTitle = entry[0].match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
      return {
        rawText: raw,
        doi,
        title: refTitle ? normalizeWhitespace(refTitle.replace(/<[^>]+>/g, ' ')) : null,
        year: parseYear(raw),
        authors: []
      } satisfies ParsedReference;
    });

  const normalizedTitle = title ? normalizeWhitespace(title.replace(/<[^>]+>/g, ' ')) : null;
  const sections = splitIntoSections(text);

  return {
    parserName: 'grobid',
    parserVersion: 'service',
    confidence: text.length > 0 ? 0.85 : 0.65,
    title: normalizedTitle,
    abstract: null,
    fullText: text,
    sections,
    references
  };
};

export const resolveUrlCandidate = (candidate: string, baseUrl: string): string | null => {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
};
