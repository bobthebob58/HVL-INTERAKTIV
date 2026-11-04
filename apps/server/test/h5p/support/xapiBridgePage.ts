/**
 * xapiBridgePage — reads what a rendered player page hands the xAPI bridge: its configuration block, its script tags
 * (on the page and in `H5PIntegration.core.scripts`, which H5P copies into its own iframes) and `reportingIsEnabled`.
 *
 * Why: the portal route and the Canvas route each decide per viewer whether the page carries the bridge (D-102); their
 *      tests (LTI-010) read the page the same way, so a change to the page format changes one helper.
 * Spec: LTI-010, H5P-009
 * Invariants: reads only; a page without a configuration block gives `config: null`, never a guess.
 * Collaborators: ../../../src/h5p/render/playerPage.ts, ../../../src/h5p/render/xapiBridgeConfig.ts,
 *   ../../support/playerIntegration.ts.
 * Tests: apps/server/test/http/playerXapiBridge.int.test.ts, apps/server/test/lti/ltiPlayXapiBridge.int.test.ts
 */
import { XAPI_BRIDGE_CONFIG_ID } from '../../../src/h5p/render/xapiBridgeConfig.js';
import { integrationFromPage } from '../../support/playerIntegration.js';

const BRIDGE_SCRIPT = /\/h5p\/theme\/xapi(Statements|Batching|Bridge)\.js\?version=/;
const CONFIG_BLOCK = new RegExp(
  `<script type="application/json" id="${XAPI_BRIDGE_CONFIG_ID}">(.*?)</script>`,
  's',
);

/** What one player page carries of the bridge. */
export interface BridgeOnPage {
  /** The parsed configuration block, or null when the page has none. */
  readonly config: Record<string, unknown> | null;
  /** The bridge's script tags on the page, in order (`xapiStatements`, `xapiBatching`, `xapiBridge`). */
  readonly scripts: string[];
  /** The bridge's URLs in `H5PIntegration.core.scripts`. */
  readonly coreScripts: string[];
  /** `H5PIntegration.reportingIsEnabled`. */
  readonly reporting: unknown;
  /** Whether every bridge script tag comes after every other `/h5p/theme/` script tag. */
  readonly bridgeAfterTheme: boolean;
}

/**
 * Reads the bridge's parts from a rendered player page.
 * @param html - The page's HTML.
 * @returns What the page carries of the bridge.
 */
export function bridgeOnPage(html: string): BridgeOnPage {
  const integration = integrationFromPage<{ reportingIsEnabled?: unknown; core?: { scripts?: string[] } }>(
    html,
  );
  const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1] ?? '');
  const themeTags = tags.filter((src) => src.includes('/h5p/theme/'));
  const scripts = themeTags.filter((src) => BRIDGE_SCRIPT.test(src));
  const firstBridge = themeTags.findIndex((src) => BRIDGE_SCRIPT.test(src));
  const configText = CONFIG_BLOCK.exec(html)?.[1];
  return {
    config: configText === undefined ? null : (JSON.parse(configText) as Record<string, unknown>),
    scripts: scripts.map((src) => /xapi\w+\.js/.exec(src)?.[0] ?? src),
    coreScripts: (integration?.core?.scripts ?? []).filter((src) => BRIDGE_SCRIPT.test(src)),
    reporting: integration?.reportingIsEnabled,
    bridgeAfterTheme: firstBridge < 0 || themeTags.slice(firstBridge).every((src) => BRIDGE_SCRIPT.test(src)),
  };
}
