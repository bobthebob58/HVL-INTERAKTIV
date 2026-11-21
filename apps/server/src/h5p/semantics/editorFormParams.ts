/**
 * editorFormParams — cleans content on its way to H5P's editor: what an author opens for editing, and what an
 * uploaded package holds.
 *
 * Why: the editor builds its form from the parameters it is handed. It reads them key by key, and it writes a text
 *      field's value straight into `value="…"`, because H5P's own server software hands it text in the form PHP's
 *      `htmlspecialchars` gives (`&quot;` for a double quote). Lumi hands over the stored row as it is, with a plain
 *      `"` in text, so a text with a quote was cut off at the quote and the rest read as part of the page; and an
 *      uploaded package's content reached the editor with no cleaning at all (D-124).
 * Spec: SEC-008, SEC-005, H5P-006
 * Invariants:
 *   - The parameters are fitted to their semantics (./semanticsConformance.ts), every text field is cleaned as on
 *     save (./lumiTextSanitizer.ts), and what the "Rights of use" dialog renders is cleaned and an unsafe file path
 *     refused (./rightsOfUse.ts), as `SubContentPolicy.enforce` and Lumi's enforcer do together on a save.
 *   - No sub-content is refused here: a package or a stored activity with a type the save refuses still opens, so
 *     the author can take the piece out; the save decides.
 *   - In every text field that is not rich text (`widget: 'html'`), and in every string of a `metadata` or
 *     `copyright` object and of the content's own metadata, `"` is `&quot;` and `'` is `&#039;`: the form the editor
 *     writes itself (`H5PEditor.htmlspecialchars`). A save reads both forms alike, so what is stored does not change.
 *   - Content that cannot be read as its semantics describe is refused with 400 (./paramsWalker.ts,
 *     ./nestingDepth.ts). Everything is changed in place.
 * Collaborators: ./semanticsConformance.ts, ./paramsWalker.ts, ./lumiTextSanitizer.ts, ./rightsOfUse.ts,
 *   ./nestingDepth.ts, ../editorFormReads.ts (hands it what the editor reads).
 * Tests: apps/server/test/h5p/semantics/editorFormParams.test.ts,
 *   apps/server/test/h5p/semantics/editorFormParams.int.test.ts
 */
import type { ILibraryName, LibraryManager } from '@lumieducation/h5p-server';
import { LumiTextSanitizer } from './lumiTextSanitizer.js';
import { assertNestingDepth } from './nestingDepth.js';
import { walkParams, type ParamsVisit } from './paramsWalker.js';
import { sanitizeRightsOfUse } from './rightsOfUse.js';
import { semanticsConformance } from './semanticsConformance.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Text in the form the editor writes into `value="…"`.
 * @param text - Cleaned text, with a plain `"` or `'`.
 * @returns The text with `"` as `&quot;` and `'` as `&#039;`.
 */
export function editorText(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Writes every string inside a value in the editor's form, in place; iterative, so depth cannot overflow. */
function quoteStrings(root: Record<string, unknown> | unknown[]): void {
  const pending: (Record<string, unknown> | unknown[])[] = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const holder = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(holder)) {
      if (typeof value === 'string') holder[key] = editorText(value);
      else if (typeof value === 'object' && value !== null) pending.push(value as Record<string, unknown>);
    }
  }
}

/** Writes the strings of every `metadata` and `copyright` object in the parameters in the editor's form. */
function quoteRightsOfUse(params: Record<string, unknown>): void {
  const pending: unknown[] = [params];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (typeof node !== 'object' || node === null) continue;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'metadata' || key === 'copyright') && isObject(value)) quoteStrings(value);
      else pending.push(value);
    }
  }
}

/** Cleans content for the editor's form. */
export class EditorFormParams {
  private readonly text: LumiTextSanitizer;

  /**
   * @param libraryManager - The editor's library manager.
   */
  constructor(private readonly libraryManager: LibraryManager) {
    this.text = new LumiTextSanitizer(libraryManager);
  }

  /**
   * Cleans one piece of content, in place.
   * @param params - Content parameters (content.json).
   * @param metadata - Content metadata (h5p.json).
   * @param mainLibrary - The content's main library.
   * @throws H5pError 400 `hvl:invalid-params`, `hvl:content-too-deep` or `hvl:unsafe-file-path`.
   * @spec SEC-008
   */
  async clean(params: unknown, metadata: unknown, mainLibrary: ILibraryName): Promise<void> {
    assertNestingDepth(metadata);
    this.text.sanitizeMetadata(metadata);
    if (isObject(metadata)) quoteStrings(metadata);
    if (!isObject(params)) return;
    assertNestingDepth(params);
    const conformance = semanticsConformance();
    await walkParams(
      params,
      mainLibrary,
      (library) => this.libraryManager.getSemantics(library),
      (visit) => {
        this.cleanText(visit);
        return conformance.visit(visit);
      },
      conformance.onFields,
    );
    conformance.apply();
    sanitizeRightsOfUse(params, this.text);
    // WHY: last, because every cleaning pass above gives back a plain quote.
    quoteRightsOfUse(params);
  }

  private cleanText({ semantics, value, container, key }: ParamsVisit): void {
    if (semantics.type !== 'text' || typeof value !== 'string') return;
    const clean = this.text.sanitizeText(semantics, value);
    // WHY: rich text reaches CKEditor as HTML, where a quote inside an attribute must stay a quote.
    (container as Record<string | number, unknown>)[key] =
      semantics.widget === 'html' ? clean : editorText(clean);
  }
}
