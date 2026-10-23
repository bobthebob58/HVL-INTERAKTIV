/**
 * FeideClient — the OpenID Connect relying party for Feide: authorisation URL, code exchange and logout URL.
 *
 * Why: AUTH-001 requires Authorization Code with PKCE (S256), state and nonce against Feide's discovery document,
 *      and rejection of ID tokens with a wrong `iss`, `aud`, `nonce` or an expired `exp`. openid-client 6 checks the
 *      claims; its ID-token signature check against Feide's JWKS is only on with `enableNonRepudiationChecks`
 *      (pinned in test/auth/upstream/openidClientMock.test.ts), so it is on (D-054).
 * Spec: AUTH-001, AUTH-003, AUTH-004
 * Invariants:
 *   - The scope is always sent explicitly as FEIDE_SCOPE (AUTH-001, AUTH-004); `userid-nin` is never requested.
 *   - The client authenticates with `client_secret_post`, chosen explicitly; the secret is never logged.
 *   - Discovery is lazy and retried after a failure, so a Feide outage at start-up does not stop the server.
 *   - Plain http is allowed only for an http issuer (local mocks); production refuses one (productionChecks).
 * Collaborators: ./completeFeideLogin.ts, ./feideLoginRoutes.ts, ./loginTransactions.ts, ../../config/env.ts.
 * Tests: apps/server/test/auth/feide/FeideClient.test.ts
 */
import * as oidc from 'openid-client';

/** The scopes HVL Interaktiv asks Feide for (spec 02 AUTH-001). */
export const FEIDE_SCOPE = 'openid profile email userid-feide groups-org groups-edu';

/** Seconds openid-client waits for Feide before giving up. */
const FEIDE_TIMEOUT_SECONDS = 10;

/** How this server is registered with Feide. */
export interface FeideSettings {
  /** `FEIDE_ISSUER`. */
  readonly issuer: string;
  /** `FEIDE_CLIENT_ID`. */
  readonly clientId: string;
  /** `FEIDE_CLIENT_SECRET`. */
  readonly clientSecret: string;
  /** `<PUBLIC_BASE_URL>/auth/feide/callback`, registered in the Feide Customer Portal. */
  readonly redirectUri: string;
  /** `<PUBLIC_BASE_URL>/auth/logged-out`, registered as the logout redirect. */
  readonly postLogoutRedirectUri: string;
}

/** The single-use values that bind a login to one browser (stored in a login transaction). */
export interface LoginChecks {
  /** OAuth `state`. */
  readonly state: string;
  /** OIDC `nonce`. */
  readonly nonce: string;
  /** PKCE code verifier. */
  readonly codeVerifier: string;
}

/** What a completed login yields. Held in memory only; the caller stores the ID token encrypted. */
export interface FeideTokens {
  /** The validated ID-token claims. */
  readonly claims: Record<string, unknown>;
  /** The raw ID token, for `id_token_hint` at logout (D-021). */
  readonly idToken: string;
  /** The access token, for the Groups API (AUTH-002). */
  readonly accessToken: string;
}

/** OpenID Connect against Feide. */
export class FeideClient {
  private configuration?: Promise<oidc.Configuration>;

  /**
   * @param settings - Issuer, client and redirect URIs.
   */
  constructor(private readonly settings: FeideSettings) {}

  private config(): Promise<oidc.Configuration> {
    this.configuration ??= oidc
      .discovery(
        new URL(this.settings.issuer),
        this.settings.clientId,
        undefined,
        // WHY: client_secret_basic form-encodes the client ID first (`-` becomes `%2D`); Feide's client IDs are
        // UUIDs, and a server that does not decode the header would reject them. Feide supports both methods.
        oidc.ClientSecretPost(this.settings.clientSecret),
        {
          timeout: FEIDE_TIMEOUT_SECONDS,
          execute: [
            oidc.enableNonRepudiationChecks,
            // SECURITY: only local mocks use http; production refuses an http issuer at start-up.
            ...(new URL(this.settings.issuer).protocol === 'http:' ? [oidc.allowInsecureRequests] : []),
          ],
        },
      )
      .catch((error: unknown) => {
        this.configuration = undefined;
        throw error;
      });
    return this.configuration;
  }

  /**
   * The URL that sends the browser to Feide.
   * @param checks - This login's state, nonce and PKCE verifier.
   * @returns Feide's authorisation URL.
   */
  async authorizationUrl(checks: LoginChecks): Promise<URL> {
    const config = await this.config();
    return oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.settings.redirectUri,
      scope: FEIDE_SCOPE,
      state: checks.state,
      nonce: checks.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(checks.codeVerifier),
      code_challenge_method: 'S256',
    });
  }

  /**
   * Exchanges the callback's code and validates the ID token.
   * @param callbackUrl - The full callback URL Feide redirected to.
   * @param checks - The values stored when this login began.
   * @returns The claims and tokens.
   * @throws openid-client's errors for a wrong state, issuer, audience, nonce, expiry or signature.
   */
  async completeLogin(callbackUrl: URL, checks: LoginChecks): Promise<FeideTokens> {
    const config = await this.config();
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || !tokens.id_token) throw new Error('Feide returned no ID token');
    return { claims: { ...claims }, idToken: tokens.id_token, accessToken: tokens.access_token };
  }

  /**
   * Feide's end-session URL; Feide requires both the hint and the registered redirect (AUTH-003).
   * @param idToken - The ID token of the session that ends.
   * @returns The URL to send the browser to.
   */
  async endSessionUrl(idToken: string): Promise<URL> {
    return oidc.buildEndSessionUrl(await this.config(), {
      id_token_hint: idToken,
      post_logout_redirect_uri: this.settings.postLogoutRedirectUri,
    });
  }
}
