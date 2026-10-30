/**
 * patternActivityBuild — turns one of a pattern's skeletons into the parameters and title of a new activity in the
 * chosen language: tokens filled, the libraries' localised defaults added, fresh `subContentId`s, and every library
 * the result names checked as installed.
 *
 * Why: D-084 and D-085 create an activity from a pattern on the server. The editor would add the defaults and IDs
 *      when an author opens new content; here nothing passes through the editor's form, so the server does it, in
 *      the order probe P1 settled: texts first (so the defaults never overwrite them), defaults next (which may add
 *      sub-content), then IDs (so added sub-content gets one too).
 * Spec: PROD-001, PED-010
 * Invariants:
 *   - Token values are plain text, HTML-escaped in the parameters (sub-content titles included, as H5P's editor
 *     stores text); the activity's title is plain text, stored as written (Lumi checks only that it is one line of
 *     at most 255 characters, and the portal shows it as text); `⟦` and `⟧` stay raw (D-084 amendment).
 *   - Every library the skeleton names is checked before the defaults run, and every library the completed
 *     parameters name after; a missing one is `MissingPatternLibraryError`, never Lumi's own error.
 *   - The skeleton (frozen content) is never changed; the result shares no object with it.
 * Collaborators: ./skeletonTokens.ts, ./semanticDefaults.ts, ./subContentIds.ts, ./patternLibraries.ts,
 *   ../content/patternTokenChecks.ts (`tokenValuesOf`), ./PatternCreator.ts (the caller).
 * Tests: apps/server/test/learningDesign/patterns/patternCreation.int.test.ts
 */
import type { StudioPattern, StudioPatternSkeleton } from '../content/patternContent.js';
import { tokenValuesOf } from '../content/patternTokenChecks.js';
import {
  installedSemanticsSource,
  librariesNamedIn,
  MissingPatternLibraryError,
  missingLibraries,
  type InstalledLibraryLookup,
} from './patternLibraries.js';
import { withSemanticDefaults, type ActivityLanguage, type Params } from './semanticDefaults.js';
import { resolveSkeletonParams, resolveTokens } from './skeletonTokens.js';
import { withFreshSubContentIds } from './subContentIds.js';

/** A new activity, ready for the editor's save path. */
export interface PatternActivity {
  /** The completed parameters (content.json). */
  readonly params: Params;
  /** The activity's title, plain text. */
  readonly title: string;
  /** The main library as `H5P.Name x.y`. */
  readonly library: string;
}

async function assertInstalled(params: unknown, library: string, lookup: InstalledLibraryLookup) {
  const [missing] = await missingLibraries(librariesNamedIn(params, library), lookup);
  if (missing !== undefined) throw new MissingPatternLibraryError(missing);
}

/**
 * Builds a new activity from a skeleton.
 * @param pattern - The pattern (its texts).
 * @param skeleton - One of its skeletons.
 * @param language - The activity's language.
 * @param lookup - Lumi's library manager.
 * @returns The parameters, title and main library.
 * @throws MissingPatternLibraryError when a library the activity needs is not installed.
 * @example const activity = await buildPatternActivity(pattern, skeleton, 'nn', editor.libraryManager);
 * @spec PROD-001
 */
export async function buildPatternActivity(
  pattern: Pick<StudioPattern, 'texts'>,
  skeleton: Pick<StudioPatternSkeleton, 'library' | 'metadataTitle' | 'params'>,
  language: ActivityLanguage,
  lookup: InstalledLibraryLookup,
): Promise<PatternActivity> {
  const values = tokenValuesOf(pattern.texts, language);
  const resolved = resolveSkeletonParams(skeleton.params, values) as Params;
  await assertInstalled(resolved, skeleton.library, lookup);
  const filled = await withSemanticDefaults(
    resolved,
    skeleton.library,
    installedSemanticsSource(lookup),
    language,
  );
  const params = withFreshSubContentIds(filled);
  await assertInstalled(params, skeleton.library, lookup);
  return { params, title: resolveTokens(skeleton.metadataTitle, values, false), library: skeleton.library };
}
