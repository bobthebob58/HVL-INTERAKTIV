/**
 * mockPlatform — starts the mock Feide and the mock Canvas together and returns the tool environment variables that
 * point at them; it also re-exports the constants tests build launches, logins and service calls with. The mock
 * Canvas's AGS and NRPS controls are `canvas.tokens`, `canvas.ags` and `canvas.nrps`.
 *
 * Why: the server's integration tests, the end-to-end tests and `node tools/mock-platform/cli.mjs` all need both
 *      mocks and the same environment (D-049); one entry point keeps them consistent.
 * Spec: LTI-001, LTI-008, LTI-012, AUTH-001
 * Invariants:
 *   - `env` holds exactly FEIDE_ISSUER, FEIDE_GROUPS_API_URL, FEIDE_CLIENT_ID, FEIDE_CLIENT_SECRET, CANVAS_ORIGINS
 *     and LTI_PLATFORMS, the last as JSON in the `LtiPlatformConfig` shape of apps/server/src/config/envParsers.ts.
 *   - The tool URL is checked before anything starts; when one mock fails to start, the other is closed first.
 *   - `close()` closes both mocks and may be called more than once.
 * Collaborators: ./mockFeide.mjs, ./mockCanvas.mjs, ./canvasServices.mjs, ./cli.mjs, ./mockPlatform.d.mts (types
 *   for TypeScript callers).
 * Tests: tools/mock-platform/test/mockPlatform.test.mjs
 */
import { startMockCanvas, toolBaseUrl } from './mockCanvas.mjs';
import { startMockFeide } from './mockFeide.mjs';

export { startMockFeide } from './mockFeide.mjs';
export { FEIDE_DEMO_USERS, FEIDE_ID_CLAIM, USERID_SEC_CLAIM } from './feideUsers.mjs';
export { startMockCanvas } from './mockCanvas.mjs';
export {
  CANVAS_USERS,
  LTI_CLAIM,
  LTI_MEDIA_TYPE,
  LTI_ROLE,
  LTI_SCOPE,
  MESSAGE_TYPE,
} from './ltiVocabulary.mjs';
export { MOCK_CANVAS_SCOPES } from './canvasServices.mjs';
export { LAUNCH_GONE } from './canvasAuthorize.mjs';
export { STORAGE_TARGET } from './platformStorageFrame.mjs';

/**
 * The tool environment variables that point at running mocks.
 * @param {{issuer: string, groupsApiUrl: string, clientId: string, clientSecret: string}} feide - A mock Feide.
 * @param {{origin: string, platformConfig: object}} canvas - A mock Canvas.
 * @returns {Record<string, string>} The six variables (see the header).
 */
const mockPlatformEnv = (feide, canvas) => ({
  FEIDE_ISSUER: feide.issuer,
  FEIDE_GROUPS_API_URL: feide.groupsApiUrl,
  FEIDE_CLIENT_ID: feide.clientId,
  FEIDE_CLIENT_SECRET: feide.clientSecret,
  CANVAS_ORIGINS: canvas.origin,
  LTI_PLATFORMS: JSON.stringify([canvas.platformConfig]),
});

/**
 * Starts the mock Feide and the mock Canvas.
 * @param {{toolUrl: string, canvasPort?: number, feidePort?: number}} options - The tool's base URL (it serves
 *   `/lti/login`, `/lti/launch` and `/lti/keys`); ports default to 0, a free port.
 * @returns {Promise<{canvas: object, feide: object, env: Record<string, string>, close: () => Promise<void>}>}
 *   The running mocks (see ./mockPlatform.d.mts).
 * @throws {TypeError} When `toolUrl` is not an http(s) URL.
 */
export async function startMockPlatform(options) {
  const toolUrl = toolBaseUrl(options?.toolUrl);
  const { canvasPort = 0, feidePort = 0 } = options;
  const feide = await startMockFeide({ port: feidePort });
  let canvas;
  try {
    canvas = await startMockCanvas({ toolUrl, port: canvasPort });
  } catch (error) {
    await feide.close();
    throw error;
  }
  const close = async () => {
    await Promise.all([canvas.close(), feide.close()]);
  };
  return { canvas, feide, env: mockPlatformEnv(feide, canvas), close };
}
