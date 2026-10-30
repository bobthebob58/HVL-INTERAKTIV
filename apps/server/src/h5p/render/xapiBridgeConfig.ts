/**
 * xapiBridgeConfig — decides, per request, whether the player page carries the xAPI bridge: its configuration for a
 * learner, and for anyone else a model without the bridge's scripts.
 *
 * Why: D-102 loads the bridge only for a learner principal, so previews in the portal and teachers' plays in Canvas are
 *      never sent; the server's own check stays as well. Lumi lists the bridge with the player's global scripts
 *      (../h5pAssets.ts), for every page, so the page removes it here; without its configuration the script would do
 *      nothing anyway (D-115). The learner's page also gets H5P's `reportingIsEnabled`, which shows InteractiveBook's
 *      «Send inn rapport» and so sends its root result (D-115, Q18), and only theirs: an author's preview must not
 *      offer to submit anything (trap (e) of step 3).
 * Spec: LTI-010, H5P-009, LTI-003
 * Invariants:
 *   - A configuration exists only for an actor whose role is `learner` and a model that carries the activity's
 *     version in its learner-state URL (D-093); it names the endpoint, the activity's ID and version and the request's
 *     token, and nothing about the person (D-115).
 *   - The token is the request's own (the ltik in Canvas, the CSRF token in the portal), which the page already holds
 *     in H5P's AJAX URLs (D-058); the bridge sends it only in a header (LTI-003, D-102).
 *   - Without a configuration the bridge's scripts are gone from the page's list and from `H5PIntegration.core.scripts`
 *     (which H5P copies into its own iframes), and `reportingIsEnabled` is not set.
 *   - Pure: the model given is never changed.
 * SPEC-DEVIATION: D-102 — the bridge runs in the player document, not inside H5P's iframe (H5P-009).
 * Collaborators: ./playerPage.ts (renders the block), ../h5pAssets.ts (`isXapiBridgeUrl`),
 *   ../../learningDesign/safeEditing/contentVersionOnPages.ts (the version in the state URL),
 *   ../../http/routes/playerRoutes.ts and ../../lti/play/ltiPlayRoutes.ts (the callers),
 *   packages/hvl-h5p-theme/src/xapiBridge.js (the reader).
 * Tests: apps/server/test/h5p/render/xapiBridgeConfig.test.ts, apps/server/test/h5p/xapiBridge.browser.int.test.ts
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import { CONTENT_VERSION_PARAM } from '../../learningDesign/safeEditing/contentVersionOnPages.js';
import { isXapiBridgeUrl } from '../h5pAssets.js';
import type { HvlH5pActor, UrlToken } from '../HvlH5pUser.js';

/** Where the bridge posts its batches (`POST /api/h5p/xapi`, LTI-011). */
export const XAPI_BRIDGE_ENDPOINT = '/api/h5p/xapi';
/** The `id` of the inert JSON block the bridge reads its configuration from. */
export const XAPI_BRIDGE_CONFIG_ID = 'hvl-xapi-bridge';

/** What the player page tells the bridge (D-102, D-115). */
export interface XapiBridgeConfig {
  /** A same-origin path; the bridge refuses anything else. */
  readonly endpoint: string;
  /** The activity every statement is about. */
  readonly contentId: string;
  /** The version the page was rendered with (D-093), named once per batch. */
  readonly contentVersion: number;
  /** The request's own token, for a header of the bridge's requests; null when the request carried none. */
  readonly token: UrlToken | null;
}

const VERSION = /^[1-9]\d{0,8}$/;

/**
 * The activity version a rendered model carries in its learner-state URL.
 * @param model - The model of ../H5pPlayerFactory.ts, whose render stamps the version (D-093).
 * @returns The version, or undefined when the URL has none.
 */
export function renderedContentVersion(model: IPlayerModel): number | undefined {
  // WHY: the version the page's state writes carry is the one its statements must name, so it is read from there.
  const url = (model as { integration?: { ajax?: { contentUserData?: unknown } } }).integration?.ajax
    ?.contentUserData;
  if (typeof url !== 'string') return undefined;
  const value = new URLSearchParams(url.split('?')[1] ?? '').get(CONTENT_VERSION_PARAM);
  return value !== null && VERSION.test(value) ? Number(value) : undefined;
}

/**
 * The bridge's configuration for this page, if it gets one.
 * @param model - The rendered model.
 * @param actor - Who views the page.
 * @returns The configuration for a learner on a versioned page; undefined for anyone else, so the page has no bridge.
 * @spec LTI-010
 */
export function xapiBridgeConfig(model: IPlayerModel, actor: HvlH5pActor): XapiBridgeConfig | undefined {
  // PRIVACY: an author's or teacher's play never leaves the page as xAPI statements, so it is never stored as
  // learning data (DATA-012) nor reaches insight or a gradebook (D-102).
  if (actor.role !== 'learner') return undefined;
  const contentVersion = renderedContentVersion(model);
  if (contentVersion === undefined) return undefined;
  return {
    endpoint: XAPI_BRIDGE_ENDPOINT,
    contentId: String(model.contentId),
    contentVersion,
    token: actor.urlToken ? { name: actor.urlToken.name, value: actor.urlToken.value } : null,
  };
}

/**
 * The model as this viewer's page shows it: with `reportingIsEnabled` for a learner, without the bridge's scripts for
 * anyone else.
 * @param model - The rendered model.
 * @param bridge - The configuration from `xapiBridgeConfig`, or undefined.
 * @returns A copy; the model given is unchanged.
 * @spec H5P-009
 */
export function playerModelFor(model: IPlayerModel, bridge: XapiBridgeConfig | undefined): IPlayerModel {
  if (bridge) return { ...model, integration: { ...model.integration, reportingIsEnabled: true } };
  const keep = (urls: readonly string[]) => urls.filter((url) => !isXapiBridgeUrl(url));
  const core = model.integration.core;
  // SECURITY: also out of `core.scripts`, which H5P copies into its own iframes, so no document gets the bridge.
  const integration = core
    ? { ...model.integration, core: { ...core, scripts: keep(core.scripts ?? []) } }
    : model.integration;
  return { ...model, scripts: keep(model.scripts), integration };
}
