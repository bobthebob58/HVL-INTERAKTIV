/**
 * guideParity — the checks between the guide's three languages and within each: every marker exactly once, and the
 * same headings (by level and order), markers and citations (in the same order) in nn, nb and en.
 *
 * Why: the three guides are one text in three languages (D-082). A heading, a marker or a citation that one
 *      language lacks would give its readers another page structure or another reference list, so `content:check`
 *      names the first difference in the language that differs from Nynorsk, which is the reference (D-076).
 * Spec: PED-002, PROD-012
 * Invariants:
 *   - Nynorsk is the reference; a difference is reported in nb's or en's file, at the line of its first differing
 *     entry (or without a line when that language simply has fewer).
 *   - At most one problem per kind (headings, markers, citations) and language, so a long list stays readable.
 *   - Each marker is placed exactly once per language: the page shows the phase matrix and the catalogue once, and
 *     the catalogue's section `id` must be unique.
 * Collaborators: ./guideContent.ts (the caller), ./guideMarkdownTree.ts (`GuideOutline`),
 *   @hvl-interaktiv/api-contract (`GUIDE_MARKER_NAMES`).
 * Tests: apps/server/test/learningDesign/content/guideContent.test.ts
 */
import { GUIDE_MARKER_NAMES } from '@hvl-interaktiv/api-contract';
import type { ContentProblem } from './contentProblem.js';
import type { GuideOutline } from './guideMarkdownTree.js';

/** One language's guide file and its outline. */
export interface GuideOutlineFile {
  /** The display path, e.g. `content/laeringsdesign/guide.nb.md`. */
  readonly file: string;
  readonly outline: GuideOutline;
}

interface Entry {
  readonly label: string;
  readonly line: number;
}

const entriesOf = (outline: GuideOutline) => ({
  headings: outline.headings.map(({ level, line }) => ({ label: '#'.repeat(level), line })),
  markers: outline.markers.map(({ name, line }) => ({ label: `{{${name}}}`, line })),
  citations: outline.citations.map(({ key, line }) => ({ label: `[@${key}]`, line })),
});

const NOUNS = { headings: 'heading', markers: 'marker', citations: 'citation' } as const;

function difference(
  kind: keyof typeof NOUNS,
  own: readonly Entry[],
  reference: readonly Entry[],
  file: string,
  referenceFile: string,
): ContentProblem | undefined {
  const index = own.findIndex((entry, at) => entry.label !== reference[at]?.label);
  const rule = 'the three guides have the same headings (by level), markers and citations, in the same order';
  if (index >= 0) {
    const theirs = reference[index];
    return {
      file,
      line: own[index]?.line,
      message:
        `${NOUNS[kind]} ${index + 1} is ${own[index]?.label} here, but ` +
        (theirs
          ? `${theirs.label} in ${referenceFile} (line ${theirs.line})`
          : `${referenceFile} has no more`) +
        `; ${rule}`,
    };
  }
  if (own.length < reference.length)
    return {
      file,
      message: `has ${own.length} ${NOUNS[kind]}s, but ${referenceFile} has ${reference.length}; ${rule}`,
    };
  return undefined;
}

/**
 * Checks that each marker stands exactly once in a guide file.
 * @param guide - One language's file and outline.
 * @returns A problem per missing or repeated marker.
 * @spec PED-002
 */
export function guideMarkerProblems(guide: GuideOutlineFile): ContentProblem[] {
  return GUIDE_MARKER_NAMES.flatMap((name) => {
    const placed = guide.outline.markers.filter((marker) => marker.name === name);
    if (placed.length === 0)
      return [
        {
          file: guide.file,
          message: `has no {{${name}}} line; put it alone on the line where the page shows it`,
        },
      ];
    return placed.slice(1).map(({ line }) => ({
      file: guide.file,
      line,
      message: `has {{${name}}} a second time (first on line ${placed[0]?.line}); each marker stands once`,
    }));
  });
}

/**
 * Compares the outlines of nb and en with nn's.
 * @param reference - The Nynorsk guide.
 * @param others - The Bokmål and English guides.
 * @returns The first difference of each kind in each language.
 * @spec PED-002
 */
export function guideParityProblems(
  reference: GuideOutlineFile,
  others: readonly GuideOutlineFile[],
): ContentProblem[] {
  const expected = entriesOf(reference.outline);
  const referenceFile = reference.file.split('/').pop() ?? reference.file;
  return others.flatMap((guide) => {
    const own = entriesOf(guide.outline);
    return (Object.keys(NOUNS) as (keyof typeof NOUNS)[]).flatMap((kind) => {
      const problem = difference(kind, own[kind], expected[kind], guide.file, referenceFile);
      return problem ? [problem] : [];
    });
  });
}
