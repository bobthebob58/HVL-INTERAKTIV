/**
 * guideContent — the guide's part of the studio content: loads `content/laeringsdesign/guide.{nn,nb,en}.md` into one
 * closed node tree per language, with the references each cites (D-083).
 *
 * Why: the guide page's text lives in files ALU edits without code (PED-002, D-082). `loadStudioContent` calls this
 *      loader with the loaded references; the public guide route (../http/studioContentRoutes.ts) hands the web app
 *      only the tree, which it renders without HTML.
 * Spec: PED-002, PED-001
 * Invariants:
 *   - The guide is optional until it is written: all three files absent is "no guide yet" (`documents` undefined;
 *     the page shows the phase matrix and the catalogue alone). One or two present is a problem naming each missing
 *     file.
 *   - Every problem names the file and, where it has one, the line (`ContentProblem`; Markdown has no key path).
 *   - Cited keys are checked with `unresolvedCitationProblems`; a key nn cites is reported once, in nn's file.
 *   - The three languages have the same headings, markers and citations in the same order (./guideParity.ts); each
 *     marker stands once in each.
 *   - A guide's references are the ones it cites, each once, in first-citation order.
 *   - Its part of the `npm run content:check` summary comes from `describeGuideContent`.
 * SPEC-DEVIATION: D-083 — PED-002 names `guide.{nn,nb,en}.mdx`; the guide is CommonMark (`.md`) read into a closed
 *   node tree, never compiled to code.
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./guideMarkdownTree.ts,
 *   ./guideParity.ts, ./referencesContent.ts, ./studioContentContext.ts, ../http/studioContentAnswers.ts.
 * Tests: apps/server/test/learningDesign/content/guideContent.test.ts,
 *   apps/server/test/learningDesign/content/realGuideContent.test.ts,
 *   apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import { readFileSync } from 'node:fs';
import type { GuideBlockNode } from '@hvl-interaktiv/api-contract';
import type { Locale } from '../../i18n/translate.js';
import { contentDisplayPath, type ContentProblem } from './contentProblem.js';
import { CONTENT_LANGUAGES } from './contentText.js';
import { buildGuideTree, type GuideOutline } from './guideMarkdownTree.js';
import { guideMarkerProblems, guideParityProblems } from './guideParity.js';
import { findReference, unresolvedCitationProblems, type StudioReference } from './referencesContent.js';
import { studioContentFile, type StudioContentContext } from './studioContentContext.js';
import { contentLoadFailed, type ContentLoadResult } from './yamlContentFile.js';

/** The guide's file in one language, relative to the content folder. */
export const guideFileOf = (language: Locale): string => `laeringsdesign/guide.${language}.md`;

/** The guide in one language. */
export interface GuideDocument {
  /** The closed node tree (D-083). */
  readonly nodes: readonly GuideBlockNode[];
  /** The references it cites, each once, in first-citation order. */
  readonly references: readonly StudioReference[];
  /** Its headings, markers and citations, with their lines. */
  readonly outline: GuideOutline;
}

/** The loaded guide. */
export interface GuideContent {
  /** The guide in each language, or undefined while no guide file exists yet. */
  readonly documents?: Readonly<Record<Locale, GuideDocument>>;
}

type GuideFile =
  | { readonly language: Locale; readonly file: string; readonly state: 'absent' }
  | { readonly language: Locale; readonly file: string; readonly state: 'unreadable'; readonly code: string }
  | { readonly language: Locale; readonly file: string; readonly state: 'read'; readonly source: string };

function readGuideFile(context: StudioContentContext, language: Locale): GuideFile {
  const path = studioContentFile(context, guideFileOf(language));
  const file = contentDisplayPath(path);
  try {
    return { language, file, state: 'read', source: readFileSync(path, 'utf8') };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    return code === 'ENOENT'
      ? { language, file, state: 'absent' }
      : { language, file, state: 'unreadable', code };
  }
}

const missingProblem = (file: GuideFile, present: readonly GuideFile[]): ContentProblem => ({
  file: file.file,
  message:
    `is missing: ${present.map((other) => other.file.split('/').pop()).join(' and ')} ` +
    `${present.length === 1 ? 'exists' : 'exist'}, and the guide is written in nn, nb and en (or in none yet)`,
});

const citedReferences = (context: StudioContentContext, outline: GuideOutline): StudioReference[] =>
  [...new Set(outline.citations.map(({ key }) => key))].flatMap((key) => {
    const reference = context.references && findReference(context.references, key);
    return reference ? [reference] : [];
  });

/**
 * Loads and checks the guide.
 * @param context - The content folder and the loaded references.
 * @returns The guide (no documents while no file exists), or every problem in its files.
 * @spec PED-002
 */
export function loadGuideContent(context: StudioContentContext): ContentLoadResult<GuideContent> {
  const files = CONTENT_LANGUAGES.map((language) => readGuideFile(context, language));
  const present = files.filter((file) => file.state !== 'absent');
  if (present.length === 0) return { ok: true, value: {} };
  const problems: ContentProblem[] = [];
  for (const file of files) {
    if (file.state === 'absent') problems.push(missingProblem(file, present));
    if (file.state === 'unreadable')
      problems.push({ file: file.file, message: `cannot read the file (${file.code})` });
  }
  const parsed = files.flatMap((file) => {
    if (file.state !== 'read') return [];
    const tree = buildGuideTree(file.source, 'guide');
    problems.push(...tree.problems.map((problem) => ({ file: file.file, ...problem })));
    if (tree.problems.length === 0 && tree.nodes.length === 0)
      problems.push({ file: file.file, message: 'is empty; write the guide, or remove all three files' });
    return [{ ...file, tree, outline: tree.outline }];
  });
  if (problems.length > 0) return contentLoadFailed(problems);
  // WHY: with no problem so far, all three files were read, in the order nn, nb, en.
  const [reference, ...others] = parsed;
  if (!reference) return contentLoadFailed(problems);
  const nnKeys = new Set(reference.outline.citations.map(({ key }) => key));
  for (const guide of parsed) {
    problems.push(...guideMarkerProblems(guide));
    // WHY: a key nn cites is reported once, in nn's file; nb and en add only the keys nn lacks.
    const own = guide.outline.citations.filter(({ key }) => guide === reference || !nnKeys.has(key));
    problems.push(...unresolvedCitationProblems(context.references, guide.file, own));
  }
  // WHY: a missing or repeated marker would also show as a parity difference; one problem per mistake is enough.
  if (problems.length === 0) problems.push(...guideParityProblems(reference, others));
  if (problems.length > 0) return contentLoadFailed(problems);
  const documents: Partial<Record<Locale, GuideDocument>> = {};
  for (const { language, tree, outline } of parsed)
    documents[language] = { nodes: tree.nodes, references: citedReferences(context, outline), outline };
  // WHY: with no problem, `parsed` holds all three languages, so every key is set.
  return { ok: true, value: { documents: documents as Record<Locale, GuideDocument> } };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param guide - The loaded guide.
 * @returns e.g. `guide in nn, nb and en (9 sections, 14 citations)`, or `no guide yet` while no file exists.
 * @spec PED-002
 */
export function describeGuideContent(guide: GuideContent): string | undefined {
  const outline = guide.documents?.nn.outline;
  if (!outline) return 'no guide yet';
  const sections = outline.headings.filter(({ level }) => level === 2).length;
  const citations = outline.citations.length;
  return (
    `guide in nn, nb and en (${sections} section${sections === 1 ? '' : 's'}, ` +
    `${citations} citation${citations === 1 ? '' : 's'})`
  );
}
