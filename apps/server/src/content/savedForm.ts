/**
 * savedForm — what a save of an activity will store: the editor's own cleaning steps, run on copies of the request.
 *
 * Why: the save gate must judge what learners will see, not what the request says (D-074). The editor changes the
 *      parameters before it writes them: HVL's sub-content policy cleans list items and alt texts, and Lumi's
 *      semantics enforcer sanitises every text field, which drops `<script>`, `<style>`, `<textarea>` and `<option>`
 *      together with their content. An alt text of `<style>Kart</style>` reads as "Kart" in the request but is
 *      stored empty, so a gate that read the request passed an image without alt text (PROD-003, UD-021).
 * Spec: PROD-003, UD-022
 * Invariants:
 *   - The steps and their order are the editor's (../h5p/HvlH5PEditor.ts): `SubContentPolicy.enforce`, then Lumi's
 *     `SemanticsEnforcer.enforceSemanticStructure`. They change copies; the request itself is never touched.
 *   - A request the editor refuses before it writes anything (a main library outside the ten, or not installed)
 *     gives `undefined`; the editor then answers it. A refusal inside the steps (disallowed sub-content, an unsafe
 *     file path) is thrown as the editor would throw it.
 *   - The metadata is cleaned as on save, without the defaults Lumi adds to h5p.json (e.g. `language: 'en'`). Only
 *     V-LANG, a warning, reads it today, so this can only add a warning, and warnings never block.
 *   - `publishedSaveRealTypes.int.test.ts` compares the saved form with what the editor stores; a new cleaning step
 *     in the editor's save must be added here too, or that test fails for the content it changes.
 * Collaborators: ./PublishedSaveGate.ts, ../h5p/semantics/SubContentPolicy.ts, ../h5p/lumiInternals.ts,
 *   ../h5p/HvlTop10ContentTypeFilter.ts, ../server/createApp.ts.
 * Tests: apps/server/test/content/publishedSaveRealTypes.int.test.ts, apps/server/test/content/publishedSave.int.test.ts
 */
import { LibraryName, type LibraryManager } from '@lumieducation/h5p-server';
import { isAuthorableType } from '../h5p/HvlTop10ContentTypeFilter.js';
import { SemanticsEnforcer } from '../h5p/lumiInternals.js';
import { SubContentPolicy } from '../h5p/semantics/SubContentPolicy.js';

/** What a save submits, as the validator reads it. */
export interface SubmittedContent {
  /** The library's ubername, e.g. `H5P.MultiChoice 1.16`. */
  readonly mainLibrary: string;
  readonly params: unknown;
  readonly metadata: unknown;
}

/** Computes what a save will store, or `undefined` when the editor refuses the save before writing. */
export type SavedForm = (submitted: SubmittedContent) => Promise<SubmittedContent | undefined>;

const libraryOf = (ubername: string): LibraryName | undefined => {
  try {
    const name = LibraryName.fromUberName(ubername, { useWhitespace: true });
    return isAuthorableType(name.machineName) ? name : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Builds the saved form from the editor's library manager, so the steps read the same semantics as the save.
 * @param libraryManager - The editor's library manager (`HvlH5PEditor.libraryManager`).
 * @returns The function the save gate validates through.
 */
export function editorSavedForm(libraryManager: LibraryManager): SavedForm {
  const policy = new SubContentPolicy(libraryManager);
  const enforcer = new SemanticsEnforcer(libraryManager);
  return async ({ mainLibrary, params, metadata }) => {
    const main = libraryOf(mainLibrary);
    if (!main || !(await libraryManager.libraryExists(main))) return undefined;
    const saved = { mainLibrary, params: structuredClone(params), metadata: structuredClone(metadata) };
    await policy.enforce(saved.params as Record<string, unknown>, saved.metadata, main);
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/ContentStorer.ts
    // (addOrUpdateContent) runs this on every save before it writes the parameters.
    await enforcer.enforceSemanticStructure(saved.params, main);
    return saved;
  };
}
