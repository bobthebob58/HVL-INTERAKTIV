/**
 * filesOriginFixtures — an activity with an image and a scripted SVG stored as they are, signed URLs for both kinds of
 * grant, and requests addressed to the files origin or the app origin of an app test bed.
 *
 * Why: the `SEC-004` tests need files the sanitiser never saw (a crafted SVG must be inert because of how it is
 *      served, not only because the upload path cleans it) and need to say which origin a request is for. Node does
 *      not resolve `files.localhost`, so a request names the files host in its `Host` header (D-110 amendment of
 *      2026-11-05).
 * Spec: SEC-004
 * Invariants:
 *   - Files are written through the content storage (`addFile`), so they are registered files of the activity, as
 *     an editor save or a package import leaves them; the SVG is stored without passing the sanitiser.
 *   - The SVG writes `hvli-svg-script-ran` to the console from an inline script and from an `onload` handler, so a
 *     browser test sees at once if either ever runs.
 * Collaborators: ./appTestbed.ts, ./uploadFixtures.ts (`PNG_1X1`, `rawBody`), ../../src/config/filesOrigin.ts.
 * Tests: used by apps/server/test/http/filesOrigin.int.test.ts, apps/server/test/http/editorFiles.int.test.ts and
 *   apps/server/e2e/filesOrigin.e2e.test.ts.
 */
import { Readable } from 'node:stream';
import request from 'supertest';
import { filesOriginOf } from '../../src/config/filesOrigin.js';
import type { ContentFileGrants } from '../../src/h5p/contentFileGrants.js';
import type { AppTestbed } from './appTestbed.js';
import { PNG_1X1, rawBody } from './uploadFixtures.js';

/** What the SVG's script and handler print, if they ever run. */
export const SVG_SCRIPT_MARKER = 'hvli-svg-script-ran';

/** An SVG with an inline script and an event handler, as the sanitiser would never let it through (SEC-001). */
export const SCRIPTED_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" onload="console.log('${SVG_SCRIPT_MARKER}')">` +
    `<script>console.log('${SVG_SCRIPT_MARKER}')</script><rect width="40" height="40" fill="#004357"/></svg>`,
);

/** The registered file names the fixtures store. */
export const STORED = { image: 'images/bilde.png', svg: 'images/teikning.svg' } as const;

/**
 * Stores the PNG and the scripted SVG as registered files of an activity.
 * @param tb - The app test bed.
 * @param contentId - The activity.
 */
export async function storeUserFiles(tb: AppTestbed, contentId: string): Promise<void> {
  const storage = tb.runtime.editor.contentManager.contentStorage;
  await storage.addFile(contentId, STORED.image, Readable.from([PNG_1X1]));
  await storage.addFile(contentId, STORED.svg, Readable.from([SCRIPTED_SVG]));
}

/**
 * A signed file path, as a player or editor page would carry it.
 * @param grants - The grants of the kind wanted (the player's `fileGrants`, the editor's `editorFileGrants`).
 * @param mount - `/h5p/files` (the player's, on the files origin) or `/h5p/editor-files` (the editor's, app origin).
 * @param contentId - The activity the grant is for.
 * @param file - The file name to ask for, which may belong to another activity.
 * @param inPath - The activity named in the path; defaults to `contentId`.
 * @param at - When the grant is issued; the past gives an expired grant.
 * @returns The path, without an origin.
 */
export const signedPath = (
  grants: ContentFileGrants,
  mount: '/h5p/files' | '/h5p/editor-files',
  contentId: string,
  file: string,
  inPath = contentId,
  at = new Date(),
): string => `${mount}/${grants.issueGrant(contentId, at)}/${inPath}/${file}`;

/**
 * The `Host` header of the files origin, e.g. `files.localhost:<port>`.
 * @param tb - The app test bed.
 * @returns The host and port.
 */
export const filesHost = (tb: AppTestbed): string => new URL(filesOriginOf(tb.env)).host;

/**
 * A GET to the files origin of the test bed's app, with the raw body kept.
 * @param tb - The app test bed.
 * @param path - The path.
 * @returns The supertest request, to which headers can still be added.
 */
export const onFilesOrigin = (tb: AppTestbed, path: string) =>
  request(tb.app).get(path).set('Host', filesHost(tb)).buffer(true).parse(rawBody);

/**
 * A GET to the app origin (supertest's own loopback address, never the files host), with the raw body kept.
 * @param tb - The app test bed.
 * @param path - The path.
 * @returns The supertest request.
 */
export const onAppOrigin = (tb: AppTestbed, path: string) =>
  request(tb.app).get(path).buffer(true).parse(rawBody);
