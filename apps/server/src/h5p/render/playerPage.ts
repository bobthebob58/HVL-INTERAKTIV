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
 * Collaborators: ./scriptJson.ts, ../H5pPlayerFactory.ts (`player.setRenderer`).
 * Tests: apps/server/test/h5p/render/playerPage.test.ts
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import type { Locale } from '../../i18n/translate.js';
import { escapeHtml, scriptJson } from './scriptJson.js';

/** The user object H5P sees: nobody in particular. */
export const ANONYMOUS_H5P_USER = Object.freeze({ name: '', mail: '', id: '' });

/**
 * Renders the player page for one activity.
 * @param model - Lumi's player model (`H5PPlayer.render` passes it to the renderer).
 * @param language - The page language.
 * @returns A complete HTML document.
 */
export function renderPlayerPage(model: IPlayerModel, language: Locale): string {
  const integration = { ...(model.integration as object), user: ANONYMOUS_H5P_USER };
  const styles = model.styles.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`);
  const scripts = model.scripts.map((src) => `<script src="${escapeHtml(src)}"></script>`);
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}" class="h5p-iframe">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
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
