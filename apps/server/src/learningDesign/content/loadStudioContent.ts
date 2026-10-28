/**
 * loadStudioContent — the one entry point that loads the læringsdesign studio's content from `content/`: the phases,
 * the references, the guide, the patterns and the portfolio template and criteria, checked and frozen.
 *
 * Why: the studio's texts and patterns are files ALU edits without code (PED-001, PED-002, PED-011, MAPPE-002). The
 *      server loads them once, synchronously, before it listens, and a bad file stops the start with every problem
 *      named (D-082); `npm run content:check` runs the same function without a server.
 * Spec: PED-001
 * Invariants:
 *   - Every section is loaded even when an earlier one fails, so one error lists every problem in every file.
 *   - The returned object and everything in it is frozen; it is built only when no section has a problem.
 *   - Reads files only under `root` (and what `inputs` names); contacts no service, no database and no network.
 * Collaborators: ./phasesContent.ts, ./referencesContent.ts, ./guideContent.ts (W1), ./patternContent.ts (W2),
 *   ./mappeContent.ts (W6), ./StudioContentError.ts, ./runContentCheck.ts; the server's start-up wiring.
 * Tests: apps/server/test/learningDesign/content/loadStudioContent.test.ts,
 *   apps/server/test/learningDesign/content/phasesContent.test.ts
 */
import { join, resolve } from 'node:path';
import { REPOSITORY_ROOT } from './contentProblem.js';
import { deepFreeze } from './deepFreeze.js';
import { loadGuideContent, type GuideContent } from './guideContent.js';
import { loadMappeContent, type MappeContent } from './mappeContent.js';
import { loadPatternContent, type PatternContent } from './patternContent.js';
import { loadPhasesContent, type PhasesContent } from './phasesContent.js';
import { loadReferencesContent, type ReferencesContent } from './referencesContent.js';
import { StudioContentError } from './StudioContentError.js';
import type { StudioContentContext, StudioContentInputs } from './studioContentContext.js';
import type { ContentLoadResult } from './yamlContentFile.js';

/** The repository's content folder, the default root. */
export const STUDIO_CONTENT_ROOT = join(REPOSITORY_ROOT, 'content');

/** Everything the studio shows from `content/`, loaded and frozen. */
export interface StudioContent {
  /** `laeringsdesign/phases.yaml`: review status, the *samling* anchor and the three phases. */
  readonly phases: PhasesContent;
  /** `laeringsdesign/references.yaml`: the full references cited as `[@key]`. */
  readonly references: ReferencesContent;
  /** `laeringsdesign/guide.{nn,nb,en}.md` (guide workstream W1). */
  readonly guide: GuideContent;
  /** `laeringsdesign/patterns/<id>/` (pattern workstream W2). */
  readonly patterns: PatternContent;
  /** `mappe/template.*.md` and `mappe/criteria.*.yaml` (portfolio workstream W6). */
  readonly mappe: MappeContent;
}

const valueOf = <T>(result: ContentLoadResult<T>): T | undefined => (result.ok ? result.value : undefined);
const problemsOf = (results: readonly ContentLoadResult<unknown>[]) =>
  results.flatMap((result) => (result.ok ? [] : result.problems));

/**
 * Loads and checks the studio content.
 * @param root - The content folder; defaults to the repository's `content/`. Tests pass a fixture folder.
 * @param inputs - Further inputs for the section loaders (see `StudioContentInputs`); none by default.
 * @returns The frozen content.
 * @throws StudioContentError listing every problem in every file, each with its file, line and key.
 * @spec PED-001
 */
export function loadStudioContent(
  root: string = STUDIO_CONTENT_ROOT,
  inputs: StudioContentInputs = {},
): StudioContent {
  const base = resolve(root);
  const phases = loadPhasesContent(base);
  const references = loadReferencesContent(base);
  const context: StudioContentContext = {
    ...inputs,
    root: base,
    phases: valueOf(phases),
    references: valueOf(references),
  };
  const guide = loadGuideContent(context);
  const patterns = loadPatternContent(context);
  const mappe = loadMappeContent(context);
  if (phases.ok && references.ok && guide.ok && patterns.ok && mappe.ok) {
    return deepFreeze({
      phases: phases.value,
      references: references.value,
      guide: guide.value,
      patterns: patterns.value,
      mappe: mappe.value,
    });
  }
  throw new StudioContentError(problemsOf([phases, references, guide, patterns, mappe]));
}
