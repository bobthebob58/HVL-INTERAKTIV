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
 * Collaborators: ../multipartUpload.ts, ../requestBodies.ts, ../h5pLocals.ts, Lumi's H5PAjaxEndpoint.
 * Tests: apps/server/test/http/ajax.int.test.ts, apps/server/test/http/editorUpload.int.test.ts
 */
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { MAX_FILE_SIZE } from '../../h5p/H5pConfigFactory.js';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import { isLocale, t, type Locale } from '../../i18n/translate.js';
import { HttpError } from '../HttpError.js';
import { requireActor, requireRole } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { readMultipart } from '../multipartUpload.js';
import { formBody } from '../requestBodies.js';

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
    const upload = await readMultipart(req, {
      fileField: action === 'files' ? 'file' : 'h5p',
      maxFileSize: MAX_FILE_SIZE,
    });
    try {
      if (!upload.file) throw new HttpError(400, 'error.badRequest');
      if (action === 'files') {
        // WHY: Lumi reports any sanitiser failure as "upload-validation-error"; running them first keeps our reason.
        for (const sanitizer of deps.fileSanitizers) await sanitizer.sanitize(upload.file.tempFilePath);
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
