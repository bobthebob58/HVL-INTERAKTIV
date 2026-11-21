/**
 * editorFormReads — makes the editor hand H5P's editor form only cleaned content: an activity opened for editing,
 * and the content of an uploaded package.
 *
 * Why: Lumi's `getContent` returns the stored row as it is and `uploadPackage` the package's content.json as it
 *      is; both go straight into the editor's form in the author's browser (D-124). The cleaning is
 *      ./semantics/editorFormParams.ts; this module puts it on the two methods, so no caller can read past it.
 * Spec: SEC-008, SEC-005, H5P-006
 * Invariants:
 *   - `getContent` resolves to the stored content after `EditorFormParams.clean`; the stored row is not changed.
 *   - `uploadPackage` resolves to the package's metadata and parameters after the same cleaning; a package whose
 *     content cannot be cleaned is refused with the cleaning's 400, after HvlH5PEditor's own checks have passed.
 *   - An upload that only installs libraries has no content and is handed on as it is.
 * Collaborators: ./semantics/editorFormParams.ts, ./H5pEditorFactory.ts (installs it), ./HvlH5PEditor.ts (the
 *   upload's checks), ../http/routes/contentRoutes.ts and ../http/routes/ajaxRoutes.ts (the two routes).
 * Tests: apps/server/test/h5p/semantics/editorFormParams.int.test.ts,
 *   apps/server/test/h5p/editorQuotedText.browser.int.test.ts
 */
import {
  LibraryName,
  type H5PEditor,
  type IContentMetadata,
  type ILibraryName,
} from '@lumieducation/h5p-server';
import { EditorFormParams } from './semantics/editorFormParams.js';

/** The main library of a package's h5p.json: its name, in the version the package depends on. */
function mainLibraryOf(metadata: IContentMetadata): ILibraryName | undefined {
  return metadata.preloadedDependencies.find(({ machineName }) => machineName === metadata.mainLibrary);
}

/**
 * Puts the cleaning on the editor's two reads for the form.
 * @param editor - The editor; its `getContent` and `uploadPackage` are replaced on this instance.
 * @spec SEC-008
 */
export function useEditorFormParams(editor: H5PEditor): void {
  const form = new EditorFormParams(editor.libraryManager);
  const getContent = editor.getContent.bind(editor);
  editor.getContent = async (contentId, user) => {
    const content = await getContent(contentId, user);
    const main = LibraryName.fromUberName(content.library, { useWhitespace: true });
    await form.clean(content.params.params, content.params.metadata, main);
    return content;
  };
  const uploadPackage = editor.uploadPackage.bind(editor);
  editor.uploadPackage = async (dataOrPath, user, options) => {
    const result = await uploadPackage(dataOrPath, user, options);
    const main = result.metadata ? mainLibraryOf(result.metadata) : undefined;
    if (main) await form.clean(result.parameters, result.metadata, main);
    return result;
  };
}
