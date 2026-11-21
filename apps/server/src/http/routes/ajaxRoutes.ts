/**
 * ajaxRoutes — the H5P editor's AJAX endpoint: content types, library data, translations, uploads.
 *
 * Why: the H5P editor client talks to one `ajax?action=…` URL. Only authors and admins use the editor; the
 *      answers go through Lumi's H5PAjaxEndpoint on our HvlH5PEditor, so the ten-type list, the upload checks
 *      and the Hub refusal apply. Uploads arrive as files that keep their extension (D-043) and are sanitised
 *      first here, so the author learns the actual reason when a file is refused.
 * Spec: H5P-002, H5P-006, SEC-001, SEC-002, SEC-003, SEC-005
 * Invariants:
 *   - Only `author` and `admin` reach these routes (learners get 403).
 *   - The language is the actor's, or a supported `language` query value; never free text.
 *   - Every temporary upload folder is removed after the request, whatever happens.
 *   - An author's file uploads and package imports are counted before the body is read; past a limit the answer is
 *     429 `hvl:rate-limited` with `Retry-After` (../h5pRouteLimits.ts, D-120). An author whose SVG files were
 *     refused as too complex as often as the budget allows gets the same answer for further SVG files, so one
 *     person cannot hold the SVG cleaning worker (D-119).
 *   - Pasted content (`action=filter`) past the limits for one activity is 400 before Lumi reads it
 *     (./contentSaveBodies.ts, D-126).
 * Collaborators: ../multipartUpload.ts, ../requestBodies.ts, ../h5pLocals.ts, ../h5pRouteLimits.ts,
 *   ./contentSaveBodies.ts, Lumi's H5PAjaxEndpoint.
 * Tests: apps/server/test/http/ajax.int.test.ts, apps/server/test/http/editorUpload.int.test.ts,
 *   apps/server/test/http/uploadLimits.int.test.ts, apps/server/test/http/contentBudget.int.test.ts
 */
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { MAX_FILE_SIZE } from '../../h5p/H5pConfigFactory.js';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import { isLocale, t, type Locale } from '../../i18n/translate.js';
import { fileExtension } from '../../security/fileExtension.js';
import { HttpError } from '../HttpError.js';
import { requireActor, requireRole } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { refuseWhenLimited } from '../h5pRouteLimits.js';
import { readMultipart } from '../multipartUpload.js';
import { formBody } from '../requestBodies.js';
import { assertPasteWithinLimits } from './contentSaveBodies.js';

const editorLanguage = (req: Request, res: Response): Locale => {
  const asked = typeof req.query.language === 'string' ? req.query.language : '';
  return isLocale(asked) ? asked : requireActor(res).locale;
};

const queryString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** File and package uploads are multipart and read by ../multipartUpload.ts, never by a form parser. */
const isUpload = (req: Request): boolean =>
  ['files', 'library-upload'].includes(queryString(req.query.action) ?? '');

const unlessUpload = (handlers: RequestHandler[]): RequestHandler[] =>
  handlers.map((handler) => (req, res, next) => (isUpload(req) ? next() : handler(req, res, next)));

/**
 * Runs the sanitisers on an uploaded file before Lumi does, and counts an SVG that was refused as too complex.
 * @param deps - The sanitisers and the limits.
 * @param file - The uploaded file's path.
 * @param accountId - The author.
 * @param res - The response, for `Retry-After`.
 * @throws HttpError 429 `hvl:rate-limited` for an SVG while the author's budget is spent; else what a sanitiser throws.
 */
async function sanitizeFirst(
  deps: H5pRouteDeps,
  file: string,
  accountId: string,
  res: Response,
): Promise<void> {
  const slowSvgs = fileExtension(file) === 'svg' ? deps.limits?.slowSvgs : undefined;
  refuseWhenLimited(await slowSvgs?.check(accountId), res);
  try {
    // WHY: Lumi reports any sanitiser failure as "upload-validation-error"; running them first keeps our reason.
    for (const sanitizer of deps.fileSanitizers) await sanitizer.sanitize(file);
  } catch (error) {
    const key = (error as { messageKey?: unknown } | null)?.messageKey;
    if (key === 'upload.file.svgTooComplex') await slowSvgs?.spend(accountId);
    throw error;
  }
}

/** Messages for the libraries an admin's import installed or updated (Lumi asks for them by these IDs). */
const libraryMessages =
  (locale: Locale) =>
  (id: string, replacements: Record<string, unknown>): string =>
    t(
      id === 'updated-libraries' ? 'h5p.librariesUpdated' : 'h5p.librariesInstalled',
      { count: Number(replacements.count) || 0 },
      locale,
    );

/**
 * Builds the AJAX routes.
 * @param deps - Editor, AJAX endpoint and sanitisers.
 * @returns A router for `GET /ajax` and `POST /ajax`.
 */
export function ajaxRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
  const editorOnly = requireRole('author', 'admin');

  router.get('/ajax', editorOnly, async (req, res) => {
    const { action, machineName, majorVersion, minorVersion } = req.query;
    const user = asAccountUser(requireActor(res));
    const result = await deps.ajax.getAjax(
      queryString(action) ?? '',
      queryString(machineName),
      queryString(majorVersion),
      queryString(minorVersion),
      editorLanguage(req, res),
      user,
    );
    res.json(result);
  });

  router.post('/ajax', editorOnly, ...unlessUpload(formBody('20mb')), async (req, res) => {
    const action = queryString(req.query.action) ?? '';
    const user = asAccountUser(requireActor(res));
    const language = editorLanguage(req, res);
    if (!isUpload(req)) {
      // SECURITY: Lumi cleans pasted content as it comes; it is held to the limits for one activity first (D-126).
      if (action === 'filter') assertPasteWithinLimits(req.body);
      res.json(
        await deps.ajax.postAjax(
          action,
          req.body as never,
          language,
          user,
          undefined,
          queryString(req.query.id),
        ),
      );
      return;
    }
    const isFile = action === 'files';
    const { accountId } = requireActor(res);
    // SECURITY: counted before the body is read, so a request past the limit costs no disk, scan or unpacking.
    refuseWhenLimited(await (isFile ? deps.limits?.uploads : deps.limits?.imports)?.take(accountId), res);
    const upload = await readMultipart(req, {
      fileField: isFile ? 'file' : 'h5p',
      maxFileSize: MAX_FILE_SIZE,
    });
    try {
      if (!upload.file) throw new HttpError(400, 'error.badRequest');
      if (isFile) {
        await sanitizeFirst(deps, upload.file.tempFilePath, accountId, res);
        res.json(await deps.ajax.postAjax('files', upload.fields as never, language, user, upload.file));
      } else {
        const result = await deps.ajax.postAjax(
          'library-upload',
          {} as never,
          language,
          user,
          undefined,
          undefined,
          libraryMessages(language),
          upload.file,
        );
        res.json(result);
      }
    } finally {
      await upload.cleanup();
    }
  });
  return router;
}
