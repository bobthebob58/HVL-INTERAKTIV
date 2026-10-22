/**
 * SubContentPolicy — the save-time rules for nested content that Lumi does not enforce (D-039).
 *
 * Why: authors build activities from sub-content inside containers (QuestionSet, Column, InteractiveBook…).
 *      Lumi silently drops a sub-library a field does not offer, but only outside lists, and never sanitises
 *      text that is a list item. HVL also never allows H5P.DragQuestion (D-006). This policy refuses such content
 *      with a clear message and sanitises what Lumi misses, before Lumi's own enforcer runs.
 * Spec: H5P-002, SEC-008
 * Invariants:
 *   - Every `library` value anywhere names a library its field offers (exact "H5P.Name x.y", as Lumi checks),
 *     and never an excluded type; otherwise 403 `hvl:sub-content-not-allowed` names the library.
 *   - Text that is a list item is sanitised with Lumi's rules; metadata titles of the content and of every
 *     sub-content are sanitised as plain text.
 *   - The parameters and metadata are changed in place; nothing else is.
 * Collaborators: ./paramsWalker.ts, ./lumiTextSanitizer.ts, ./removeDragQuestion.ts, ../HvlH5PEditor.ts.
 * Tests: apps/server/test/h5p/semantics/SubContentPolicy.test.ts
 */
import { H5pError, type ILibraryName, type LibraryManager } from '@lumieducation/h5p-server';
import { LumiTextSanitizer } from './lumiTextSanitizer.js';
import { walkParams, type ParamsVisit } from './paramsWalker.js';
import { EXCLUDED_SUB_CONTENT, optionMachineName } from './removeDragQuestion.js';

const notAllowed = (library: string): H5pError =>
  new H5pError('hvl:sub-content-not-allowed', { library }, 403);

/** Refuses disallowed sub-content and sanitises what Lumi's enforcer skips. */
export class SubContentPolicy {
  private readonly text: LumiTextSanitizer;

  /**
   * @param libraryManager - Lumi's library manager; its `getSemantics` already applies our alterations.
   */
  constructor(private readonly libraryManager: LibraryManager) {
    this.text = new LumiTextSanitizer(libraryManager);
  }

  /**
   * Checks and cleans one piece of content before it is saved.
   * @param params - Content parameters (content.json), changed in place.
   * @param metadata - Content metadata (h5p.json), changed in place.
   * @param mainLibrary - The content's main library.
   * @throws H5pError `hvl:sub-content-not-allowed` (403) for a library a field does not offer or that is excluded.
   */
  async enforce(
    params: Record<string, unknown>,
    metadata: unknown,
    mainLibrary: ILibraryName,
  ): Promise<void> {
    this.text.sanitizeMetadata(metadata);
    await walkParams(
      params,
      mainLibrary,
      (lib) => this.libraryManager.getSemantics(lib),
      (visit) => this.visit(visit),
    );
  }

  private visit({ semantics, value, container, key }: ParamsVisit): void {
    if (semantics.type === 'library') {
      if (typeof value !== 'object' || value === null) return;
      const entry = value as Record<string, unknown>;
      if (entry.library === undefined) return; // WHY: the editor leaves empty entries; Lumi removes them.
      if (typeof entry.library !== 'string') throw notAllowed(String(entry.library));
      const offered = (semantics.options ?? []).map((o) =>
        typeof o === 'string' ? o : (o as { name?: string })?.name,
      );
      const machineName = optionMachineName(entry.library) ?? entry.library;
      if (EXCLUDED_SUB_CONTENT.has(machineName) || !offered.includes(entry.library))
        throw notAllowed(machineName);
      this.text.sanitizeMetadata(entry.metadata);
    } else if (semantics.type === 'text' && Array.isArray(container)) {
      // SECURITY: Lumi's enforcer never reaches list items (D-039), so they are sanitised here.
      container[key as number] = this.text.sanitizeText(semantics, value);
    }
  }
}
