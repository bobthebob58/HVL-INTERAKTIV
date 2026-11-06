/**
 * canvasTokenEndpoint — the mock Canvas's OAuth 2.0 token endpoint for LTI Advantage services
 * (`POST /login/oauth2/token`, client credentials with a JWT client assertion) and the bearer-token check of its
 * AGS and NRPS services.
 *
 * Why: D-104's grade worker requests its own token with an assertion signed by the tool key ltijs stores (LTI-012),
 *      and ltijs requests one for NRPS (LTI-008). The tool's tokens, scopes and errors must meet a platform that
 *      grants and refuses them as Canvas does, without TeCopp's Canvas (D-049).
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - Only `grant_type=client_credentials` with `client_assertion_type=…:jwt-bearer` is served; the assertion is
 *     checked by ./canvasClientAssertion.mjs. A `client_id`, when sent, must be the developer key's (the mock's own
 *     rule: Canvas reads the client from the assertion's `sub`).
 *   - Errors are OAuth 2.0 JSON as Canvas answers them: `unsupported_grant_type` (400,
 *     C:`app/controllers/oauth2_provider_controller.rb:203`), `invalid_request` (400) for every assertion problem and
 *     `invalid_scope` (400) (C:`lib/canvas/oauth/grant_types/client_credentials.rb:72-79`), `invalid_client` (401)
 *     for another `client_id`. `error_description` lists the mock's problem codes. A test can inject any code,
 *     `invalid_grant` included, as a fault.
 *   - The requested scopes must be a non-empty subset of the platform's scopes (default: exactly the developer
 *     key's three, docs/reference/canvas-lti13-developer-key.json); a broader request is refused, not narrowed
 *     (C:`lib/canvas/oauth/provider.rb:126-132`).
 *   - A token is random, opaque, kept in memory and lives `expires_in` = 3600 s, as Canvas's
 *     (C:`lib/canvas/oauth/client_credentials_provider.rb:40,64`); services accept it only before then, and only for
 *     a request its scopes allow. Otherwise they answer 401, as Canvas's LTI services do for a missing, invalid or
 *     expired token and for a missing scope (C:`app/controllers/lti/ims/concerns/lti_services.rb:61-79`).
 *   - Every request is recorded with its outcome and problem codes, never with the token itself.
 * Collaborators: ./canvasClientAssertion.mjs, ./canvasFaults.mjs, ./canvasServices.mjs, ./canvasServiceHttp.mjs,
 *   ./httpRouter.mjs.
 * Tests: tools/mock-platform/test/canvasTokenEndpoint.test.mjs
 */
import { randomBytes } from 'node:crypto';
import { createAssertionVerifier } from './canvasClientAssertion.mjs';
import { applyFault } from './canvasFaults.mjs';
import { bearerTokenOf, sendServiceError } from './canvasServiceHttp.mjs';
import { readForm, sendJson } from './httpRouter.mjs';

/** Seconds an access token lives (`expires_in`). */
export const ACCESS_TOKEN_LIFETIME_SECONDS = 3600;
const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/**
 * Creates the token service of one mock Canvas.
 * @param {{clientId: string, toolUrl: string, tokenEndpoint: string, scopes: readonly string[]}} platform - The
 *   mock Canvas and the scopes its developer key grants.
 * @param {{take: Function}} faults - The fault queues (./canvasFaults.mjs); target `token`.
 * @returns {{requests: object[], handle: Function, authorize: Function, revokeAll: Function}} `handle(req, res)`
 *   serves the endpoint; `authorize(req, res, anyOf)` returns the grant of a request's bearer token that holds one
 *   of the scopes `anyOf`, or answers 401 and returns undefined; `revokeAll()` forgets every token.
 */
export function createTokenService(platform, faults) {
  const verifyAssertion = createAssertionVerifier(platform);
  const tokens = new Map();
  const requests = [];

  async function grant(form) {
    const scopes = (form.get('scope') ?? '').split(/\s+/).filter(Boolean);
    const refuse = (status, error, problems = []) => ({ status, error, problems, scopes });
    if (form.get('grant_type') !== 'client_credentials') return refuse(400, 'unsupported_grant_type');
    const assertion = form.get('client_assertion');
    if (form.get('client_assertion_type') !== ASSERTION_TYPE || !assertion)
      return refuse(400, 'invalid_request');
    if (form.has('client_id') && form.get('client_id') !== platform.clientId) {
      return refuse(401, 'invalid_client', ['unknown-client']);
    }
    const verified = await verifyAssertion(assertion);
    if (!verified.ok) return refuse(400, 'invalid_request', verified.problems);
    if (scopes.length === 0 || scopes.some((scope) => !platform.scopes.includes(scope))) {
      return refuse(400, 'invalid_scope');
    }
    return { status: 200, problems: [], scopes };
  }

  async function handle(req, res) {
    const receivedAt = new Date().toISOString();
    const fault = faults.take('token');
    if (await applyFault(res, fault)) {
      return void requests.push({
        ok: false,
        status: fault.status,
        error: fault.error,
        problems: [],
        scopes: [],
        fault: true,
        receivedAt,
      });
    }
    const outcome = await grant(await readForm(req));
    requests.push({ ok: outcome.status === 200, ...outcome, fault: false, receivedAt });
    if (outcome.status !== 200) {
      const description =
        outcome.problems.length > 0 ? outcome.problems.join(' ') : 'refused by the mock Canvas';
      return sendJson(res, outcome.status, { error: outcome.error, error_description: description });
    }
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + ACCESS_TOKEN_LIFETIME_SECONDS * 1000;
    tokens.set(accessToken, { scopes: outcome.scopes, expiresAt });
    sendJson(res, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
      scope: outcome.scopes.join(' '),
    });
  }

  function authorize(req, res, anyOf) {
    const token = bearerTokenOf(req);
    const found = token === undefined ? undefined : tokens.get(token);
    if (!found || found.expiresAt <= Date.now()) {
      sendServiceError(res, 401, token === undefined ? 'Missing access token' : 'Invalid access token');
      return undefined;
    }
    if (!anyOf.some((scope) => found.scopes.includes(scope))) {
      sendServiceError(res, 401, 'Insufficient permissions');
      return undefined;
    }
    return found;
  }

  return { requests, handle, authorize, revokeAll: () => tokens.clear() };
}
