/**
 * SubContentPolicy — the save-time rules for nested content that Lumi does not enforce (D-039).
 *
 * Why: authors build activities from sub-content inside containers (QuestionSet, Column, InteractiveBook…).
 *      Lumi silently drops a sub-library a field does not offer, but only outside lists, and never sanitises
 *      text that is a list item. HVL also never allows H5P.DragQuestion (D-006), nor three more types as
 *      sub-content (D-123, ./removeDragQuestion.ts). This policy refuses such content
 *      with a clear message and sanitises what Lumi misses, before Lumi's own enforcer runs.
 * Spec: H5P-002, SEC-008
 * Invariants:
 *   - Every `library` value anywhere names a library its field offers (exact "H5P.Name x.y", as Lumi checks),
 *     and never an excluded type; a `library` value outside any library field (under a key the semantics do not
 *     define) is refused too. Otherwise 403 `hvl:sub-content-not-allowed` names the library.
 *   - Every text, a list item or not, is sanitised by its field's rule: Lumi's for a field with `tags`, plain
 *     text for any other (./lumiTextSanitizer.ts, D-140). The content's metadata, and everything the
 *     "Rights of use" dialog renders in the parameters (metadata, copyright, file paths, alt texts), are cleaned
 *     by ./rightsOfUse.ts; an unsafe file path is refused with 400 `hvl:unsafe-file-path`.
 *   - Once every refusal has had its say, the parameters are fitted to their semantics, last of all: keys no
 *     field list names are removed, and numbers, booleans, selects and file values get their field's type
 *     (./semanticsConformance.ts, D-123). So what is stored holds nothing the semantics do not describe.
 *   - Content nested deeper than ./nestingDepth.ts allows, or past a limit of ./contentBudget.ts, is refused (400)
 *     before anything else runs.
 *   - The parameters and metadata are changed in place; nothing else is. A refused save changes neither.
 * Collaborators: ./paramsWalker.ts, ./nestingDepth.ts, ./contentBudget.ts, ./libraryReferences.ts, ./lumiTextSanitizer.ts, ./rightsOfUse.ts,
 *   ./removeDragQuestion.ts, ./semanticsConformance.ts, ../HvlH5PEditor.ts.
 * Tests: apps/server/test/h5p/semantics/SubContentPolicy.test.ts, apps/server/test/h5p/semantics/rightsOfUse.test.ts,
 *   apps/server/test/h5p/semantics/semanticsConformance.test.ts
 */
import { H5pError, type ILibraryName, type LibraryManager } from '@lumieducation/h5p-server';
import { assertContentBudget } from './contentBudget.js';
import { LumiTextSanitizer } from './lumiTextSanitizer.js';
import { findLibraryReferences } from './libraryReferences.js';
import { assertNestingDepth } from './nestingDepth.js';
import { walkParams, type ParamsVisit } from './paramsWalker.js';
import { sanitizeRightsOfUse } from './rightsOfUse.js';
import { EXCLUDED_SUB_CONTENT, optionMachineName } from './removeDragQuestion.js';
import { semanticsConformance } from './semanticsConformance.js';

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
   * @returns How many keys and values were removed or changed to fit the semantics.
   * @throws H5pError `hvl:sub-content-not-allowed` (403) for a library a field does not offer or that is excluded,
   *   `hvl:unsafe-file-path` (400) for a file path that could leave an HTML attribute, or
   *   `hvl:content-too-deep` and `hvl:content-too-large` (400) for content past the limits.
   */
  async enforce(
    params: Record<string, unknown>,
    metadata: unknown,
    mainLibrary: ILibraryName,
  ): Promise<number> {
    // WHY: Lumi's own walks after ours are recursive; refusing deep content first avoids a stack overflow (500).
    assertNestingDepth(params);
    assertNestingDepth(metadata);
    // SECURITY: every step below, and Lumi after them, reads content of a known largest size and shape (D-126).
    assertContentBudget(params);
    assertContentBudget(metadata);
    this.text.sanitizeMetadata(metadata);
    const reached = new WeakSet<object>();
    const conformance = semanticsConformance();
    await walkParams(
      params,
      mainLibrary,
      (lib) => this.libraryManager.getSemantics(lib),
      (visit) => {
        this.visit(visit, reached);
        return conformance.visit(visit);
      },
      conformance.onFields,
    );
    // SECURITY: Lumi loads every `library` value it finds, also under keys no field defines (D-039).
    for (const { owner, library } of findLibraryReferences(params)) {
      if (!reached.has(owner)) throw notAllowed(optionMachineName(library) ?? library);
    }
    // SECURITY: H5P Core's "Rights of use" dialog also renders values under keys no field defines (D-039).
    // WHY: before the fitting, so an unsafe file path is refused wherever it sits, as before D-123.
    sanitizeRightsOfUse(params, this.text);
    // SECURITY: the player and the editor read keys and value shapes no field describes; they go now (D-123).
    return conformance.apply();
  }

  private visit({ semantics, value, container, key }: ParamsVisit, reached: WeakSet<object>): void {
    if (semantics.type === 'library') {
      if (typeof value !== 'object' || value === null) return;
      const entry = value as Record<string, unknown>;
      if (entry.library === undefined) return; // WHY: the editor leaves empty entries; Lumi removes them.
      // WHY: String() throws on an object from JSON whose `toString` is not a function (500 instead of 403).
      if (typeof entry.library !== 'string')
        throw notAllowed(typeof entry.library === 'object' ? '[object]' : String(entry.library));
      const offered = (semantics.options ?? []).map((o) =>
        typeof o === 'string' ? o : (o as { name?: string })?.name,
      );
      const machineName = optionMachineName(entry.library) ?? entry.library;
      if (EXCLUDED_SUB_CONTENT.has(machineName) || !offered.includes(entry.library))
        throw notAllowed(machineName);
      reached.add(entry);
    } else if (semantics.type === 'text' && (Array.isArray(container) || typeof value === 'string')) {
      // SECURITY: Lumi's enforcer never reaches list items (D-039), and its rule for a field without `tags` keeps
      // links and tables (D-140): every text is cleaned here, before Lumi reads it.
      (container as Record<string | number, unknown>)[key] = this.text.sanitizeText(semantics, value);
    }
  }
}
