/**
 * skeletonCreationFlow — the creation step probe P1 tests, as W2's pattern instantiation will run it: semantics
 * defaults, fresh `subContentId`s and a save through HvlH5PEditor as the author; plus the probe's readings of the
 * stored activity (validator findings, what an unchanged editor save changed).
 *
 * Why: the probe's test file stays readable when the steps it repeats for every skeleton live here (D-084, D-085).
 * Spec: PED-010, PROD-001
 * Invariants: the validator runs with the production rules and no captioned media origins; V-PLACEHOLDER findings
 *   (D-086) are left out, as the one error a created activity may have.
 * Collaborators: ../../../src/learningDesign/patterns/semanticDefaults.ts, ../../../src/learningDesign/patterns/subContentIds.ts,
 *   ../../../src/h5p/HvlH5PEditor.ts, ../../../src/validation/validateContent.ts, ./skeletonCreationDiff.ts.
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */
import type { IContentMetadata, IUser } from '@lumieducation/h5p-server';
import { loadValidationContext } from '../../../src/config/validationContext.js';
import type { HvlH5PEditor } from '../../../src/h5p/HvlH5PEditor.js';
import {
  withSemanticDefaults,
  type ActivityLanguage,
} from '../../../src/learningDesign/patterns/semanticDefaults.js';
import { withFreshSubContentIds } from '../../../src/learningDesign/patterns/subContentIds.js';
import type { Finding, ValidationInput, ValidationMetadata } from '../../../src/validation/types.js';
import { createContentValidator } from '../../../src/validation/validateContent.js';
import { diffParams, distinctPaths, subContentIdsOf } from './skeletonCreationDiff.js';
import { EDITOR_METADATA_FIELDS } from './skeletonCreationExpected.js';
import type { EditorSave } from './skeletonCreationPages.js';
import type { ProbeSkeleton } from './skeletonCreationSkeletons.js';

/** A stored activity as the editor's `getContent` returns it. */
type StoredContent = Awaited<ReturnType<HvlH5PEditor['getContent']>>;

/** One activity created from a skeleton. */
export interface Created {
  readonly skeleton: ProbeSkeleton;
  readonly id: string;
  /** The parameters as created (defaults and IDs applied), before Lumi stored them. */
  readonly params: Record<string, unknown>;
}

/**
 * Completes a skeleton: semantics defaults in `language`, then fresh IDs.
 * @param editor - The server's editor (its library manager gives semantics and language files).
 * @param skeleton - The skeleton.
 * @param language - The activity's language.
 * @returns The parameters to save.
 */
export async function completeSkeleton(
  editor: HvlH5PEditor,
  skeleton: ProbeSkeleton,
  language: ActivityLanguage,
): Promise<Record<string, unknown>> {
  return withFreshSubContentIds(
    await withSemanticDefaults(skeleton.params, skeleton.library, editor.libraryManager, language),
  );
}

/**
 * Creates a Nynorsk draft from a skeleton through the editor's save path.
 * @param editor - The server's editor.
 * @param skeleton - The skeleton.
 * @param user - The author (account view).
 * @returns The created activity.
 */
export async function createFromSkeleton(
  editor: HvlH5PEditor,
  skeleton: ProbeSkeleton,
  user: IUser,
): Promise<Created> {
  const params = await completeSkeleton(editor, skeleton, 'nn');
  const metadata = { title: skeleton.pattern, defaultLanguage: 'nn', license: 'U' } as IContentMetadata;
  // WHY: a copy, because the save path changes the parameters in place (sub-content policy, Lumi's sanitiser).
  const id = await editor.saveOrUpdateContent(
    undefined,
    structuredClone(params),
    metadata,
    skeleton.library,
    user,
  );
  return { skeleton, id, params };
}

const validate = createContentValidator(loadValidationContext({ CAPTIONED_MEDIA_ORIGINS: [] }));

/**
 * The validator's findings on the stored activity, without V-PLACEHOLDER.
 * @param editor - The server's editor.
 * @param created - The activity.
 * @param user - The author.
 * @returns Findings in Nynorsk.
 */
export async function storedFindings(
  editor: HvlH5PEditor,
  created: Created,
  user: IUser,
): Promise<Finding[]> {
  const { h5p, params } = await editor.getContent(created.id, user);
  // WHY: h5p.json as stored is the metadata the publish gate validates; Lumi's type has no index signature.
  const metadata = h5p as unknown as ValidationMetadata;
  const input: ValidationInput = {
    mainLibrary: created.skeleton.library,
    params: params.params,
    metadata,
    locale: 'nn',
  };
  return validate(input).filter((f) => f.ruleId !== 'V-PLACEHOLDER');
}

// WHY: sorted, because the editor may write an object's keys in another order, which reorders the paths.
const idsKey = (params: unknown): string => JSON.stringify(Object.entries(subContentIdsOf(params)).sort());

const isEditorMetadata = (path: string): boolean =>
  EDITOR_METADATA_FIELDS.has(/\.metadata\.(\w+)$/.exec(path)?.[1] ?? '');

/** What an unchanged editor save did to a stored activity. */
export interface EditorSaveReport {
  /** Status, status text, problems and refused outside frames of the save. */
  readonly save: readonly unknown[];
  /** Whether the editor sent and stored exactly the `subContentId`s it was given. */
  readonly sameIds: boolean;
  /** Parameter fields the save added, collapsed, without the cosmetic sub-content metadata. */
  readonly added: string[];
  /** Parameter fields it removed or changed. */
  readonly removedOrChanged: string[];
  /** h5p.json's defaultLanguage, language, license and extraTitle after the save. */
  readonly metadata: readonly unknown[];
}

/**
 * Compares an activity before and after an unchanged editor save.
 * @param save - The save, from `saveUnchangedInEditor`.
 * @param before - The stored parameters before the save.
 * @param stored - The stored activity after it (`getContent`).
 * @returns The report.
 */
export function editorSaveReport(save: EditorSave, before: unknown, stored: StoredContent): EditorSaveReport {
  const after = stored.params.params;
  const diff = diffParams(before, after);
  const ids = idsKey(before);
  // WHY: Lumi's type lacks `extraTitle`, which H5P's editor writes into h5p.json.
  const { defaultLanguage, language, license, extraTitle } = stored.h5p as {
    extraTitle?: string;
  } & typeof stored.h5p;
  return {
    save: [save.status, save.statusText, save.problems, save.refusedFrames],
    sameIds: idsKey(save.params) === ids && idsKey(after) === ids,
    added: distinctPaths(diff.added.filter((p) => !isEditorMetadata(p))),
    removedOrChanged: [...diff.removed, ...diff.changed].filter((p) => !isEditorMetadata(p)),
    metadata: [defaultLanguage, language, license, extraTitle],
  };
}
