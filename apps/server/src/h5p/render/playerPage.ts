/**
 * playerPage — the HTML page that runs one H5P activity, rendered without Lumi's unsafe template (D-040).
 *
 * Why: the page embeds the H5P integration object, which holds author-controlled titles and parameters. It must
 *      be script-safe, must not carry who is viewing (the pseudonym or account ID would be readable by any
 *      script in the activity), and must name the page language for screen readers (WCAG 3.1.1). For a learner it
 *      also carries the xAPI bridge and its configuration (LTI-010, D-102); for anyone else neither.
 * Spec: SEC-008, DATA-002, H5P-005, H5P-009, DATA-011, LTI-010
 * Invariants:
 *   - Every URL, ID and the language are escaped; the integration object goes through `scriptJson`.
 *   - `H5PIntegration.user` is always `{ name: '', mail: '', id: '' }`; the preloaded learner state stays.
 *   - No download link: downloads are a separate, permission-checked route.
 *   - Extra scripts run first and are only same-origin static files (`/static/…js`), e.g. the LTI landing script
 *     that removes the ltik from the address bar (LTI-003).
 *   - The content container carries the activity's own language as `lang` when it states one (UD-010); the page's
 *     `lang` is the UI locale.
 *   - No inline script: the integration object is an inert JSON block that ./client/h5pIntegration.js reads, so the
 *     page works under a `script-src` without `'unsafe-inline'` (D-070, DATA-011). So is the bridge's configuration.
 *   - Fails closed: without the `xapiBridge` option the page has neither the bridge's scripts nor its configuration
 *     nor `reportingIsEnabled` (./xapiBridgeConfig.ts, D-102, D-115).
 * SPEC-DEVIATION: D-070 — the page's own <script>/<link> tags carry no integrity or nonce (H5P-009):
 *   same-origin files allowed by 'self' (amendment of 2026-10-24).
 * Collaborators: ./scriptJson.ts, ./xapiBridgeConfig.ts; ../../http/routes/playerRoutes.ts and
 *   ../../lti/play/ltiPlayRoutes.ts (the callers), which get the model from the identity renderer that
 *   ../H5pPlayerFactory.ts installs; ./editorPage.ts (firstScriptTags).
 * Tests: apps/server/test/h5p/render/playerPage.test.ts, apps/server/test/h5p/render/xapiBridgeConfig.test.ts
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import type { Locale } from '../../i18n/translate.js';
import { escapeHtml, scriptJson } from './scriptJson.js';
import { playerModelFor, XAPI_BRIDGE_CONFIG_ID, type XapiBridgeConfig } from './xapiBridgeConfig.js';

/** Where the H5P router serves ./client/h5pIntegration.js. */
export const H5P_INTEGRATION_SCRIPT = '/h5p/boot/h5pIntegration.js';

/** The user object H5P sees: nobody in particular. */
export const ANONYMOUS_H5P_USER = Object.freeze({ name: '', mail: '', id: '' });

/**
 * Script tags for same-origin static scripts that run before H5P's, e.g. the LTI landing script.
 * @param srcs - Paths under `/static/`; none by default.
 * @returns One `<script src>` tag per path, in order.
 * @throws Error when a path is not a same-origin static script (a programming error).
 */
export const firstScriptTags = (srcs: readonly string[] = []): string[] =>
  srcs.map((src) => {
    // SECURITY: only our own static files, never a URL from a request.
    if (!/^\/static\/(?!.*\.\.)[\w/.-]+\.js$/.test(src)) throw new Error(`invalid script path: ${src}`);
    return `<script src="${escapeHtml(src)}"></script>`;
  });

/** Options of `renderPlayerPage`. */
export interface PlayerPageOptions {
  /** Same-origin static scripts that run before H5P's, e.g. `/static/lti/ltikLanding.js`. */
  readonly firstScripts?: readonly string[];
  /** The activity's own language tag (../../validation/activityLanguage.ts), for the content container. */
  readonly contentLanguage?: string;
  /** The xAPI bridge's configuration, for a learner only (./xapiBridgeConfig.ts); without it, no bridge. */
  readonly xapiBridge?: XapiBridgeConfig | undefined;
}

/**
 * Renders the player page for one activity.
 * @param model - Lumi's player model (`H5PPlayer.render` passes it to the renderer).
 * @param language - The page language.
 * @param options - Scripts to run first, the content's language and, for a learner, the xAPI bridge's configuration.
 * @returns A complete HTML document.
 * @throws Error when a first script is not a same-origin static file (a programming error).
 */
export function renderPlayerPage(
  model: IPlayerModel,
  language: Locale,
  options: PlayerPageOptions = {},
): string {
  const first = firstScriptTags(options.firstScripts);
  const shown = playerModelFor(model, options.xapiBridge);
  const integration = { ...(shown.integration as object), user: ANONYMOUS_H5P_USER };
  const styles = shown.styles.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`);
  const scripts = shown.scripts.map((src) => `<script src="${escapeHtml(src)}"></script>`);
  const bridge = options.xapiBridge
    ? [
        `<script type="application/json" id="${XAPI_BRIDGE_CONFIG_ID}">${scriptJson(options.xapiBridge)}</script>`,
      ]
    : [];
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}" class="h5p-iframe">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    ...first,
    `<script type="application/json" id="h5p-integration">${scriptJson(integration)}</script>`,
    ...bridge,
    `<script src="${H5P_INTEGRATION_SCRIPT}"></script>`,
    ...styles,
    ...scripts,
    '</head>',
    '<body>',
    `<div class="h5p-content" data-content-id="${escapeHtml(String(model.contentId))}"${
      options.contentLanguage ? ` lang="${escapeHtml(options.contentLanguage)}"` : ''
    }></div>`,
    '</body>',
    '</html>',
  ].join('\n');
}
