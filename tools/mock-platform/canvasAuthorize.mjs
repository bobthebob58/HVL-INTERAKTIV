/**
 * canvasAuthorize — checks an LTI 1.3 OIDC authentication request the way Canvas's `authorize_redirect` does, and
 * keeps the pending logins (one per third-party-initiated login) that such a request must name.
 *
 * Why: LTI-001 requires the tool's login step to send exactly what an LTI platform accepts. If the mock accepted any
 *      request, a wrong `redirect_uri`, scope or response mode would pass our tests and fail in Canvas.
 * Spec: LTI-001
 * Invariants:
 *   - Required: client_id, login_hint, lti_message_hint, nonce, prompt=none, redirect_uri (= <toolUrl>/lti/launch),
 *     response_mode=form_post, response_type=id_token, scope=openid, state. `id_token_signed_response_alg` and
 *     `lti_deployment_id` are optional but must match (RS256, the launch's deployment) when present.
 *   - Errors use OIDC error codes with Canvas's descriptions, e.g. `launch_no_longer_valid`.
 *   - A pending login expires after its time to live; its `lti_message_hint` is consumed by the first request that
 *     passes every check, synchronously, so two concurrent requests can never both succeed.
 * Collaborators: ./mockCanvas.mjs.
 * Tests: tools/mock-platform/test/canvasAuthorize.test.mjs
 */
import { randomBytes } from 'node:crypto';

/** Parameters every authentication request must carry. */
export const REQUIRED_AUTH_PARAMS = Object.freeze([
  'client_id',
  'login_hint',
  'lti_message_hint',
  'nonce',
  'prompt',
  'redirect_uri',
  'response_mode',
  'response_type',
  'scope',
  'state',
]);
const FIXED = [
  ['response_type', 'id_token', 'unsupported_response_type'],
  ['response_mode', 'form_post', 'invalid_request_object'],
  ['scope', 'openid', 'invalid_scope'],
  ['prompt', 'none', 'invalid_request_object'],
];
/** Canvas's description for an unknown, expired or used `lti_message_hint`. */
export const LAUNCH_GONE = 'The launch has either expired or already been consumed';

/**
 * Turns the forms a caller may have into plain parameters.
 * @param {Record<string, string> | URLSearchParams | URL | string} input - An object, form fields, or the full
 *   authentication URL (e.g. ltijs's redirect target).
 * @returns {Record<string, string>} The parameters.
 */
export function authParams(input) {
  if (typeof input === 'string' || input instanceof URL)
    return Object.fromEntries(new URL(input).searchParams);
  if (input instanceof URLSearchParams) return Object.fromEntries(input);
  return { ...input };
}

/**
 * Checks the static part of an authentication request.
 * @param {Record<string, string>} params - From `authParams`.
 * @param {{clientId: string, redirectUri: string}} expected - The developer key's client ID and redirect URI.
 * @returns {{error: string, error_description: string, state?: string} | undefined} The first problem, if any.
 */
export function checkAuthRequest(params, expected) {
  const fail = (error, description) => refusal(params, error, description);
  const missing = REQUIRED_AUTH_PARAMS.filter(
    (name) => typeof params[name] !== 'string' || params[name] === '',
  );
  if (missing.length > 0) {
    return fail('invalid_request_object', `The following parameters are missing: ${missing.join(', ')}`);
  }
  if (params.client_id !== expected.clientId) return fail('unauthorized_client', 'Client not authorized');
  if (params.redirect_uri !== expected.redirectUri)
    return fail('invalid_request_object', 'Invalid redirect_uri');
  for (const [name, value, error] of FIXED) {
    if (params[name] !== value) return fail(error, `${name} must be ${value}`);
  }
  const alg = params.id_token_signed_response_alg;
  if (alg !== undefined && alg !== 'RS256')
    return fail('invalid_request_object', 'Only RS256 ID tokens are signed');
  return undefined;
}

const refusal = (params, error, description) => ({
  error,
  error_description: description,
  ...(typeof params.state === 'string' && params.state !== '' && { state: params.state }),
});

/**
 * Creates the store of pending logins.
 * @param {number} ttlSeconds - How long a login initiation stays usable.
 * @returns {{add: Function, take: Function}} `add(launch)` returns `{hint, loginHint}`; `take(params)` returns
 *   `{launch}` and consumes the hint, or a refusal.
 */
export function createPendingLogins(ttlSeconds) {
  const pending = new Map();
  const prune = (now) => {
    for (const [hint, entry] of pending) if (entry.expiresAt <= now) pending.delete(hint);
  };
  return {
    add(launch) {
      prune(Date.now());
      const hint = randomBytes(24).toString('base64url');
      const loginHint = launch.user.sub;
      pending.set(hint, { launch, loginHint, expiresAt: Date.now() + ttlSeconds * 1000 });
      return { hint, loginHint };
    },
    take(params) {
      const entry = pending.get(params.lti_message_hint);
      if (!entry || entry.expiresAt <= Date.now())
        return refusal(params, 'launch_no_longer_valid', LAUNCH_GONE);
      if (params.login_hint !== entry.loginHint)
        return refusal(params, 'login_required', 'The user is not logged in');
      const deployment = params.lti_deployment_id;
      if (deployment !== undefined && deployment !== entry.launch.deploymentId) {
        return refusal(params, 'invalid_request_object', 'lti_deployment_id does not match the launch');
      }
      pending.delete(params.lti_message_hint);
      return { launch: entry.launch };
    },
  };
}
