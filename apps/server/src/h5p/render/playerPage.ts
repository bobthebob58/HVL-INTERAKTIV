/**
 * playerPage — the HTML page that runs one H5P activity, rendered without Lumi's unsafe template (D-040).
 *
 * Why: the page embeds the H5P integration object, which holds author-controlled titles and parameters. It must
 *      be script-safe, must not carry who is viewing (the pseudonym or account ID would be readable by any
 *      script in the activity), and must name the page language for screen readers (WCAG 3.1.1).
 * Spec: SEC-008, DATA-002, H5P-005
 * Invariants:
 *   - Every URL, ID and the language are escaped; the integration object goes through `scriptJson`.
 *   - `H5PIntegration.user` is always `{ name: '', mail: '', id: '' }`; the preloaded learner state stays.
 *   - No download link: downloads are a separate, permission-checked route.
 *   - Extra scripts run first and are only same-origin static files (`/static/…js`), e.g. the LTI landing script
 *     that removes the ltik from the address bar (LTI-003).
 * Collaborators: ./scriptJson.ts; ../../http/routes/playerRoutes.ts (the only caller), which gets the model from
 *   the identity renderer that ../H5pPlayerFactory.ts installs.
 * Tests: apps/server/test/h5p/render/playerPage.test.ts
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import type { Locale } from '../../i18n/translate.js';
import { escapeHtml, scriptJson } from './scriptJson.js';

/** The user object H5P sees: nobody in particular. */
export const ANONYMOUS_H5P_USER = Object.freeze({ name: '', mail: '', id: '' });

/** Options of `renderPlayerPage`. */
export interface PlayerPageOptions {
  /** Same-origin static scripts that run before H5P's, e.g. `/static/lti/ltikLanding.js`. */
  readonly firstScripts?: readonly string[];
}

/**
 * Renders the player page for one activity.
 * @param model - Lumi's player model (`H5PPlayer.render` passes it to the renderer).
 * @param language - The page language.
 * @param options - Scripts to run first.
 * @returns A complete HTML document.
 * @throws Error when a first script is not a same-origin static file (a programming error).
 */
export function renderPlayerPage(
  model: IPlayerModel,
  language: Locale,
  options: PlayerPageOptions = {},
): string {
  const first = (options.firstScripts ?? []).map((src) => {
    // SECURITY: only our own static files, never a URL from a request.
    if (!/^\/static\/(?!.*\.\.)[\w/.-]+\.js$/.test(src)) throw new Error(`invalid script path: ${src}`);
    return `<script src="${escapeHtml(src)}"></script>`;
  });
  const integration = { ...(model.integration as object), user: ANONYMOUS_H5P_USER };
  const styles = model.styles.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`);
  const scripts = model.scripts.map((src) => `<script src="${escapeHtml(src)}"></script>`);
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}" class="h5p-iframe">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    ...first,
    ...styles,
    ...scripts,
    `<script>window.H5PIntegration = ${scriptJson(integration)};</script>`,
    '</head>',
    '<body>',
    `<div class="h5p-content" data-content-id="${escapeHtml(String(model.contentId))}"></div>`,
    '</body>',
    '</html>',
  ].join('\n');
}
