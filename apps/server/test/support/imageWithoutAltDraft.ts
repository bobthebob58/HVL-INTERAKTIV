/**
 * imageWithoutAltDraft — saves a draft H5P.MultiChoice whose image has no alternative text, through the H5P editor
 * as an author's browser would: the image is uploaded first (temporary storage, with the upload sanitisers), then
 * the activity is saved with the real libraries.
 *
 * Why: the publish flow (PROD-003, UD-022) needs an activity with a validator *error*. The real MultiChoice example
 *      (D-078) has none, and an image without alt text (V-IMG-ALT) is the most common one. Saving through the editor
 *      runs the same checks as an author's save: the sub-content policy, the library check and the file copy.
 * Spec: PROD-003, UD-021, UD-022
 * Invariants:
 *   - The image is our own `diagram.png` (tools/h5p-libraries/examples/assets/README.md); `alt` is empty and the
 *     image is not marked decorative, so V-IMG-ALT reports `IMAGE_ALT_PATH`.
 *   - The activity states its language, so no V-LANG warning is added; it belongs to `ownerAccountId`.
 *   - The temporary upload folder is removed again; the activity is removed with its owner (./appTestbed.ts).
 * Collaborators: ../../src/h5p/HvlH5PEditor.ts, ../../src/http/multipartUpload.ts, ./realWebApp.ts, ./testActors.ts.
 * Tests: apps/server/e2e/publishWithReason.e2e.test.ts
 */
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { testActor } from './testActors.js';

/** The image, one of the real examples' own assets. */
const DIAGRAM = fileURLToPath(
  new URL('../../../../tools/h5p-libraries/examples/assets/diagram.png', import.meta.url),
);

/** Where V-IMG-ALT points for the MultiChoice's media image (validation/contentPath.ts spelling). */
export const IMAGE_ALT_PATH = 'media.type.params.alt';

/** The question text of the draft. */
const QUESTION = '<p>Kva fase i læringsdesignet viser biletet med samtale og problemløysing?</p>';

/** One answer option with no feedback of its own. */
const answer = (text: string, correct: boolean) => ({
  text: `<div>${text}</div>`,
  correct,
  tipsAndFeedback: { tip: '', chosenFeedback: '', notChosenFeedback: '' },
});

/**
 * Uploads the diagram into the author's temporary storage, as the editor's image field does.
 * @param editor - The H5P editor of the running app.
 * @param user - The author.
 * @returns The image field's value, with the `#tmp` path the save copies from.
 */
async function uploadDiagram(editor: HvlH5PEditor, user: ReturnType<typeof asAccountUser>) {
  const folder = mkdtempSync(join(tmpdir(), 'hvl-e2e-image-'));
  try {
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/H5PEditor.ts
    // (saveContentFile): with sanitisers configured, Lumi refuses a file that is not on disk (`tempFilePath`), as
    // ../../src/http/multipartUpload.ts leaves it.
    const tempFilePath = join(folder, 'diagram.png');
    copyFileSync(DIAGRAM, tempFilePath);
    const field: ISemanticsEntry = { name: 'file', type: 'image', label: 'Bilete' };
    const file = {
      name: 'diagram.png',
      mimetype: 'image/png',
      size: statSync(tempFilePath).size,
      tempFilePath,
    };
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/H5PAjaxEndpoint.ts
    // (postAjax, action `files`): the d.ts types the ID as a string, but saveContentFile always writes to temporary
    // storage, and Lumi's own AJAX upload passes undefined.
    return await editor.saveContentFile(undefined as unknown as string, field, file, user);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * Saves the draft.
 * @param editor - The H5P editor of the running app (`tb.runtime.editor`).
 * @param ownerAccountId - The author's account, who owns the draft.
 * @param title - The activity's title.
 * @returns The new activity's ID.
 */
export async function saveImageWithoutAltDraft(
  editor: HvlH5PEditor,
  ownerAccountId: string,
  title: string,
): Promise<string> {
  const user = asAccountUser(testActor('author', { accountId: ownerAccountId }));
  const uploaded = await uploadDiagram(editor, user);
  const image = {
    file: { path: uploaded.path, mime: uploaded.mime, width: uploaded.width, height: uploaded.height },
    decorative: false,
    alt: '',
  };
  const params = {
    media: {
      type: {
        library: 'H5P.Image 1.1',
        params: image,
        subContentId: randomUUID(),
        metadata: { title: 'Bilete' },
      },
      disableImageZooming: false,
    },
    question: QUESTION,
    answers: [answer('Under samlinga', true), answer('Før samlinga', false), answer('Etter samlinga', false)],
    behaviour: { enableRetry: true, enableSolutionsButton: true, singlePoint: false, randomAnswers: false },
  };
  const metadata = { title, license: 'U', defaultLanguage: 'nn' } as unknown as IContentMetadata;
  return editor.saveOrUpdateContent(undefined, params, metadata, 'H5P.MultiChoice 1.16', user);
}
