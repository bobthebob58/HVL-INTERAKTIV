/**
 * guideContent — the guide's slot in the studio content: will load `content/laeringsdesign/guide.{nn,nb,en}.md` into
 * one closed node tree per language (D-083).
 *
 * Why: the guide page's text lives in files ALU edits without code (PED-002, D-082). `loadStudioContent` calls this
 *      loader with the loaded references, so the guide workstream (W1) fills in only this module and its own files.
 * Spec: PED-002
 * Invariants:
 *   - Its part of the `npm run content:check` summary comes from `describeGuideContent` here, so no workstream
 *     edits ./runContentCheck.ts for it; undefined leaves the part out.
 *   - For now it reads no file and returns the empty guide, so the studio content loads before the guide exists.
 *   - When filled in: every problem names the file and the line (`ContentProblem`); cited keys are checked with
 *     `unresolvedCitationProblems` from ./referencesContent.ts; the three languages have the same headings, markers
 *     and citations in the same order (D-082).
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./studioContentContext.ts,
 *   ./referencesContent.ts.
 * Tests: apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import type { StudioContentContext } from './studioContentContext.js';
import type { ContentLoadResult } from './yamlContentFile.js';

/** The loaded guide; empty until the guide workstream defines its shape (one node tree per language, D-083). */
export type GuideContent = Readonly<Record<string, never>>;

const EMPTY_GUIDE: GuideContent = Object.freeze({});

/**
 * Loads and checks the guide.
 * @param _context - The content folder and the loaded references.
 * @returns The guide, or every problem in its files.
 * @spec PED-002
 */
export function loadGuideContent(_context: StudioContentContext): ContentLoadResult<GuideContent> {
  return { ok: true, value: EMPTY_GUIDE };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param _guide - The loaded content of this section.
 * @returns A short phrase, e.g. `guide in nn, nb and en (9 sections, 14 citations)`; undefined while the
 *   section has no files.
 * @spec PED-002
 */
export function describeGuideContent(_guide: GuideContent): string | undefined {
  return undefined;
}
