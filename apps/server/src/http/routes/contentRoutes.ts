/**
 * contentRoutes — loads, saves, deletes and exports an activity.
 *
 * Why: the editor page (S4) loads an activity's parameters, saves what the author built and can delete it; the
 *      export gives the author a `.h5p` package; «Lagre som ny versjon» saves the edit as a copy (PROD-013, D-093).
 *      All rules (the ten types, the sub-content policy, sanitising, the permission matrix, the learner-state
 *      check) live in HvlH5PEditor, the permission system and the duplicator; the routes only check the shape of
 *      the request and use the actor's account view.
 * Spec: H5P-002, H5P-006, SEC-003, SEC-008, PROD-002, PROD-003, PROD-013
 * Auth: either — the portal session with the CSRF token, or an ltik (Canvas); the copy route is portal only.
 * Invariants:
 *   - Only `author` and `admin` reach save, delete and parameters; export is decided by the permission system.
 *   - A save body is `{ library: string, params: { params: object, metadata: object },
 *     confirmLearnerStateReset?: boolean }`, else 400; a new activity (POST) has no learner state, so there the
 *     flag changes nothing.
 *   - With a save gate (createApp always passes one), a save of an existing activity by someone who may edit runs
 *     through it: under the activity's write lock, a published activity meets the publish gate on what the editor
 *     will store; an error without an acknowledgement younger than 14 days is 409 `hvl:published-save-blocked` with
 *     the findings, and nothing is saved (D-074). When another save or a publish holds the lock for longer than its
 *     30-second wait, the answer is 409 `hvl:content-changed` and nothing is saved; the editor then shows its "try
 *     again" text, which keeps the author's unsaved work.
 *   - Then the editor's learner-state check (D-093): a structural edit while anyone but the saver has saved
 *     progress is 409 `hvl:learner-state-reset-needed` (no counts) and nothing is saved, unless the body says
 *     `confirmLearnerStateReset: true`; a structural save that goes through deletes the activity's learner state
 *     and raises `H5PContent.version`; a text-only save keeps both. The 409 has H5P's error shape
 *     `{ success: false, errorCode, httpStatusCode: 409, message }`; from Canvas (an ltik) its message offers reset
 *     or cancel only (../../learningDesign/safeEditing/resetNeededWording.ts). The editor page's save choice
 *     (`editorSaveChoice.js`, its texts from ../../learningDesign/safeEditing/saveChoiceMessages.ts) answers it by
 *     sending the same PUT body again with `confirmLearnerStateReset: true`, or, in the portal, by posting
 *     `JSON.parse(content.params)` to the copy route.
 *   - `POST /content/:contentId/copy` with `{ params: object, metadata: object, library?: string }` (what H5P's
 *     editor gives as `content.params`, and its `content.library`) saves the edit as a new private draft linked to
 *     the activity, which stays untouched, and answers 201 `{ contentId }`; the copy keeps the source's library
 *     unless `library` is an installed minor version of it (D-093 amendment, S5 W4); a `library` that is not a
 *     string is 400. Portal only: an ltik is 401 `hvl:unauthenticated` (D-098), a portal learner 403; the
 *     duplicator's refusals pass through (404 `hvl:activity-unavailable`, 403 `hvl:duplicate-not-allowed`, the
 *     editor's 4xx, 500 `hvl:duplicate-failed`).
 *   - The export is always a download (`attachment`, `nosniff`) named after the content ID, never a title, and
 *     the response ends only when Lumi's zip stream has been written completely.
 * Collaborators: ../../h5p/HvlH5PEditor.ts, ../requestBodies.ts, Lumi's H5PAjaxEndpoint,
 *   ../../content/PublishedSaveGate.ts, ../../learningDesign/collaboration/ContentDuplicator.ts,
 *   ../../learningDesign/http/studioPrincipal.ts.
 * Tests: apps/server/test/http/contentSave.int.test.ts, apps/server/test/content/publishedSave.int.test.ts,
 *   apps/server/test/content/saveRace.int.test.ts, apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveAsCopy.int.test.ts
 */
import { ContentPermission, type ContentParameters, type IContentMetadata } from '@lumieducation/h5p-server';
import { finished } from 'node:stream/promises';
import { Router, type RequestHandler } from 'express';
import type { ContentSaveGate } from '../../content/PublishedSaveGate.js';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import type { ContentDuplicator } from '../../learningDesign/collaboration/ContentDuplicator.js';
import { requirePortalAuthor } from '../../learningDesign/http/studioPrincipal.js';
import type { SaveChoice } from '../../learningDesign/safeEditing/LearnerStateGate.js';
import { inWordsOfSaver } from '../../learningDesign/safeEditing/resetNeededWording.js';
import { HttpError } from '../HttpError.js';
import { requireActor, requireRole } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { jsonBody } from '../requestBodies.js';
import { pathParam } from '../routeParams.js';

interface EditedContent {
  readonly params: ContentParameters;
  readonly metadata: IContentMetadata;
}

interface SaveRequest extends EditedContent {
  readonly library: string;
  readonly choice: SaveChoice;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `{ params, metadata }` as H5P's editor gives them, else 400. */
const editedContent = (value: unknown): EditedContent => {
  if (!isObject(value) || !isObject(value.params) || !isObject(value.metadata)) {
    throw new HttpError(400, 'error.badRequest');
  }
  return { params: value.params, metadata: value.metadata as unknown as IContentMetadata };
};

const saveRequest = (body: unknown): SaveRequest => {
  if (!isObject(body) || typeof body.library !== 'string') throw new HttpError(400, 'error.badRequest');
  const confirm = body.confirmLearnerStateReset;
  if (confirm !== undefined && typeof confirm !== 'boolean') throw new HttpError(400, 'error.badRequest');
  const choice = { confirmLearnerStateReset: confirm === true };
  return { library: body.library, ...editedContent(body.params), choice };
};

/** The H5P routes' dependencies, with the publish gate for saves (D-074). */
export interface ContentRouteDeps extends H5pRouteDeps {
  /** Runs the publish gate on saves of published activities; absent in H5P-only tests. */
  readonly saveGate?: ContentSaveGate;
  /** Saves «Lagre som ny versjon» as a copy (createApp passes the studio's duplicator); absent, no copy route. */
  readonly duplicator?: Pick<ContentDuplicator, 'saveAsCopy'>;
}

/**
 * Builds the content routes.
 * @param deps - Editor, AJAX endpoint, permission system and, from createApp, the save gate and the duplicator.
 * @returns A router for `/params/:contentId`, `/content`, `/content/:contentId`, `/content/:contentId/copy` and
 *   `/download/:contentId`.
 */
export function contentRoutes(deps: ContentRouteDeps): Router {
  const router = Router();
  const authorsOnly = requireRole('author', 'admin');

  router.get('/params/:contentId', authorsOnly, async (req, res) => {
    const user = asAccountUser(requireActor(res));
    res.json(await deps.ajax.getContentParameters(pathParam(req, 'contentId'), user));
  });

  router.post('/content', authorsOnly, ...jsonBody, async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const { library, params, metadata } = saveRequest(req.body);
    const contentId = await deps.editor.saveOrUpdateContent(undefined, params, metadata, library, user);
    res.status(201).json({ contentId });
  });

  router.put('/content/:contentId', authorsOnly, ...jsonBody, async (req, res) => {
    const actor = requireActor(res);
    const user = asAccountUser(actor);
    const { library, params, metadata, choice } = saveRequest(req.body);
    const id = pathParam(req, 'contentId');
    // WHY: Canvas has no «Lagre som ny versjon» (D-098), so its 409 does not offer one.
    const write = () =>
      deps.editor
        .saveOrUpdateContent(id, params, metadata, library, user, choice)
        .catch((error: unknown) => Promise.reject(inWordsOfSaver(error, actor)));
    const gate = deps.saveGate;
    // WHY: only someone who may edit learns the gate's findings or holds the lock; anyone else meets the editor's 403.
    const mayEdit =
      gate !== undefined && (await deps.permissions.checkForContent(user, ContentPermission.Edit, id));
    const submitted = { mainLibrary: library, params, metadata, locale: actor.locale };
    const contentId = gate && mayEdit ? await gate.save(id, submitted, write) : await write();
    res.json({ contentId });
  });

  const duplicator = deps.duplicator;
  // SECURITY: «Lagre som ny versjon» is a portal action; in Canvas the dialog offers reset or cancel (D-098). The
  // check runs before the body is read; the CSRF token was checked by the authentication middleware.
  const portalAuthorsOnly: RequestHandler = (_req, res, next) => {
    requirePortalAuthor(res);
    next();
  };
  if (duplicator) {
    router.post('/content/:contentId/copy', portalAuthorsOnly, ...jsonBody, async (req, res) => {
      const { params, metadata } = editedContent(req.body);
      const library: unknown = (req.body as Record<string, unknown>).library;
      if (library !== undefined && typeof library !== 'string') throw new HttpError(400, 'error.badRequest');
      const id = pathParam(req, 'contentId');
      const { contentId } = await duplicator.saveAsCopy(id, params, metadata, requireActor(res), library);
      res.status(201).json({ contentId });
    });
  }

  router.delete('/content/:contentId', authorsOnly, async (req, res) => {
    await deps.editor.deleteContent(pathParam(req, 'contentId'), asAccountUser(requireActor(res)));
    res.status(204).end();
  });

  router.get('/download/:contentId', async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const contentId = pathParam(req, 'contentId');
    // WHY: the ID is a UUID (checked by the permission system); a title could carry header-breaking characters.
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(contentId)}.h5p"`,
      'X-Content-Type-Options': 'nosniff',
    });
    await deps.ajax.getDownload(contentId, user, res);
    // WHY: Lumi starts piping the zip into `res` and returns before it is written; the pipe ends the response,
    // so ending it here would cut the package. A client that disconnects early is not a server fault.
    await finished(res).catch(() => undefined);
  });
  return router;
}
