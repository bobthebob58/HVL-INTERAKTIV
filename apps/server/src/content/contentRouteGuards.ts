/**
 * contentRouteGuards — builds what guards the writes of the H5P content routes: the save gate and the deleter.
 *
 * Why: a save and a delete of an activity must meet the same publish flow: one validator, one clock and one write
 *      lock (D-074, D-117). Building both here, from the one PublishingDeps object, keeps createApp from handing
 *      them different locks.
 * Spec: PROD-003, H5P-006
 * Invariants:
 *   - Both guards hold `publishing.writeLock`, the lock of the publish API.
 * Collaborators: ./PublishedSaveGate.ts, ./ContentDeleter.ts, ./savedForm.ts, ../server/createApp.ts.
 * Tests: apps/server/test/server/createApp.int.test.ts, apps/server/test/content/deleteRace.int.test.ts
 */
import type { HvlH5PEditor } from '../h5p/HvlH5PEditor.js';
import { ContentDeleter, type ContentDeletion } from './ContentDeleter.js';
import { PublishedSaveGate, type ContentSaveGate } from './PublishedSaveGate.js';
import type { PublishingDeps } from './publishingDeps.js';
import { editorSavedForm } from './savedForm.js';

/** The guards of the content routes. */
export interface ContentRouteGuards {
  /** Runs the publish gate on saves of published activities, under the write lock (D-074). */
  readonly saveGate: ContentSaveGate;
  /** Deletes under the write lock, with an audit event (D-117). */
  readonly deleter: ContentDeletion;
}

/**
 * Builds the save gate and the deleter of the content routes.
 * @param publishing - The publish flow's database, validator, clock and write lock.
 * @param editor - The H5P editor, for what a save will store.
 * @returns The two guards, sharing the write lock.
 */
export function contentRouteGuards(
  publishing: PublishingDeps,
  editor: Pick<HvlH5PEditor, 'libraryManager'>,
): ContentRouteGuards {
  return {
    saveGate: new PublishedSaveGate(publishing, editorSavedForm(editor.libraryManager)),
    deleter: new ContentDeleter(publishing),
  };
}
