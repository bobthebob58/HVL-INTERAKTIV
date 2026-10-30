/**
 * editorSave — presses «Lagre» on the portal's editor page (the **Rediger** tab) until its save request has been
 * answered, and hands back that answer.
 *
 * Why: H5P resizes its editor iframe while the form fills in, which moves «Lagre»; a click that lands while it moves
 *      sends nothing (../../test/learningDesign/safeEditing/saveChoiceBench.ts). A flow needs the save's answer (200,
 *      or the 409 that opens the save choice, PROD-013), so it repeats a click that sent nothing, never one that did.
 * Spec: NFR-004, PROD-013
 * Invariants:
 *   - Only `PUT /h5p/content/<id>` of this activity counts; at most five clicks.
 * Collaborators: ./portalFrames.ts (the editor frame), apps/server/src/h5p/render/client/editorPage.js (the button).
 * Tests: apps/server/e2e/patternToPublish.e2e.test.ts, apps/server/e2e/safeEditReset.e2e.test.ts
 */
import type { Frame, Page, Response } from 'playwright-core';

/**
 * Presses «Lagre» in the editor frame until its save request is answered.
 * @param page - The page that frames the editor (its responses are watched).
 * @param editor - The editor page's frame (`/h5p/edit/<id>`).
 * @param contentId - The activity being saved.
 * @returns The save's answer.
 * @throws Error when five clicks sent no save request.
 */
export async function pressEditorSave(page: Page, editor: Frame, contentId: string): Promise<Response> {
  const isSave = (r: Response) =>
    r.request().method() === 'PUT' && new URL(r.url()).pathname === `/h5p/content/${contentId}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const answered = page.waitForResponse(isSave, { timeout: 10_000 }).catch(() => undefined);
    await editor.click('#hvl-editor-save', { timeout: 5_000 }).catch(() => undefined);
    const response = await answered;
    if (response) return response;
  }
  throw new Error('«Lagre» sent no save request');
}
