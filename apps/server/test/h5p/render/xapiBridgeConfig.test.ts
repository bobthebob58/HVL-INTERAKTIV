/**
 * Tests for the xAPI bridge's place on the player page: only a learner's page carries the bridge's scripts, its
 * configuration (endpoint, activity, version, the request's own token; no identity) and `reportingIsEnabled`; anyone
 * else's page carries none of them, also not in `H5PIntegration.core.scripts`, which H5P copies into its iframes.
 *
 * Spec: LTI-010, H5P-009
 */
import type { IPlayerModel } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { renderPlayerPage } from '../../../src/h5p/render/playerPage.js';
import {
  playerModelFor,
  renderedContentVersion,
  XAPI_BRIDGE_CONFIG_ID,
  XAPI_BRIDGE_ENDPOINT,
  xapiBridgeConfig,
} from '../../../src/h5p/render/xapiBridgeConfig.js';
import { inlineScriptTags, integrationFromPage } from '../../support/playerIntegration.js';
import { testActor } from '../../support/testActors.js';

const CID = '0192f0c4-0000-7000-8000-000000000042';
const BRIDGE = [
  '/h5p/theme/xapiStatements.js?version=a',
  '/h5p/theme/xapiBatching.js?version=b',
  '/h5p/theme/xapiBridge.js?version=c',
];
const THEME = '/h5p/theme/reducedMotion.js?version=d';
const LTIK = 'eyJ.ltik.value';

const model = (
  stateUrl = `/h5p/contentUserData/:contentId/:dataType/:subContentId?ltik=x&contentVersion=3`,
) =>
  ({
    contentId: CID,
    styles: [],
    scripts: ['/h5p/core/js/h5p.js', THEME, ...BRIDGE, '/h5p/libraries/H5P.MultiChoice-1.16/js/mc.js'],
    integration: {
      ajax: { contentUserData: stateUrl },
      core: { scripts: ['/h5p/core/js/h5p.js', THEME, ...BRIDGE], styles: [] },
      contents: { [`cid-${CID}`]: { library: 'H5P.MultiChoice 1.16' } },
      user: { name: '', mail: '', id: '' },
    },
  }) as unknown as IPlayerModel;

const configBlock = (html: string): unknown => {
  const match = new RegExp(
    `<script type="application/json" id="${XAPI_BRIDGE_CONFIG_ID}">(.*?)</script>`,
  ).exec(html);
  return match ? JSON.parse(match[1] ?? '') : null;
};

describe('[LTI-010] the bridge on the player page', () => {
  it('[LTI-010] a learner in Canvas gets the bridge, its configuration with the ltik, and reporting', () => {
    // Arrange
    const learner = testActor('learner', {
      urlToken: { name: 'ltik', value: LTIK },
      learnerKey: 'secret-key',
    });
    // Act
    const html = renderPlayerPage(model(), 'nn', { xapiBridge: xapiBridgeConfig(model(), learner) });
    // Assert
    expect(configBlock(html)).toEqual({
      endpoint: XAPI_BRIDGE_ENDPOINT,
      contentId: CID,
      contentVersion: 3,
      token: { name: 'ltik', value: LTIK },
    });
    for (const src of BRIDGE) expect(html).toContain(`<script src="${src}"></script>`);
    const integration = integrationFromPage<{ reportingIsEnabled?: boolean; core: { scripts: string[] } }>(
      html,
    );
    expect(integration?.reportingIsEnabled).toBe(true);
    expect(integration?.core.scripts).toEqual(expect.arrayContaining(BRIDGE));
    expect(inlineScriptTags(html)).toEqual([]);
    expect(html).not.toContain('secret-key');
  });

  it('[LTI-010] a learner in the portal gets the CSRF token; the configuration comes before every script', () => {
    // Arrange
    const learner = testActor('learner', { urlToken: { name: 'csrf', value: 'csrf-1' } });
    // Act
    const html = renderPlayerPage(model(), 'nn', { xapiBridge: xapiBridgeConfig(model(), learner) });
    // Assert
    expect(configBlock(html)).toMatchObject({ token: { name: 'csrf', value: 'csrf-1' } });
    expect(html.indexOf(`id="${XAPI_BRIDGE_CONFIG_ID}"`)).toBeLessThan(html.indexOf('<script src='));
  });

  it.each(['author', 'admin'] as const)(
    '[H5P-009] an %s gets no bridge script, no configuration and no reporting, also not for H5P iframes',
    (role) => {
      // Arrange
      const viewer = testActor(role, { urlToken: { name: 'csrf', value: 'csrf-2' } });
      // Act
      const html = renderPlayerPage(model(), 'nn', { xapiBridge: xapiBridgeConfig(model(), viewer) });
      // Assert
      expect(xapiBridgeConfig(model(), viewer)).toBeUndefined();
      expect(configBlock(html)).toBeNull();
      expect(html).not.toMatch(/xapi(Bridge|Statements|Batching)\.js/);
      const integration = integrationFromPage<{ reportingIsEnabled?: boolean }>(html);
      expect(integration?.reportingIsEnabled).toBeUndefined();
      expect(html).toContain(`<script src="${THEME}"></script>`);
    },
  );

  it('[H5P-009] without the option the page fails closed: no bridge, whoever renders it', () => {
    const html = renderPlayerPage(model(), 'nn');
    expect(html).not.toMatch(/xapi(Bridge|Statements|Batching)\.js/);
    expect(configBlock(html)).toBeNull();
  });

  it('[LTI-010] a learner page without a version, or without a token, is handled without guessing', () => {
    // Arrange
    const learner = testActor('learner');
    // Act and assert: no version in the state URL, no bridge; no token, a configuration without one
    expect(xapiBridgeConfig(model('/h5p/contentUserData/x?ltik=y'), learner)).toBeUndefined();
    expect(renderedContentVersion(model('/h5p/contentUserData/x?contentVersion=0'))).toBeUndefined();
    expect(renderedContentVersion(model('/h5p/contentUserData/x?a=1&contentVersion=12'))).toBe(12);
    expect(xapiBridgeConfig(model(), learner)?.token).toBeNull();
  });

  it('[H5P-009] leaves the model it is given unchanged', () => {
    // Arrange
    const given = model();
    const before = JSON.stringify(given);
    // Act
    playerModelFor(given, undefined);
    playerModelFor(given, xapiBridgeConfig(given, testActor('learner')));
    // Assert
    expect(JSON.stringify(given)).toBe(before);
  });
});
