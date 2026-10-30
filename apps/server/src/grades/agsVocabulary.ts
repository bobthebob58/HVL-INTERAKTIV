/**
 * agsVocabulary — the LTI Advantage scopes and media types the grade worker's AGS client uses.
 *
 * Why: D-104's client requests its own client-credentials token with the developer key's two AGS scopes and posts
 *      scores in AGS 2.0's score media type; Canvas checks both, so they are written once, as the IMS specs name them.
 * Spec: LTI-012
 * Invariants:
 *   - The scopes are exactly LTI-012's: `score` to post, `lineitem.readonly` to confirm a deleted line item.
 *   - The values are the IMS URIs and media types, never shortened.
 * Collaborators: ./AgsAccessTokens.ts, ./AgsScoreClient.ts, ./agsClientAssertion.ts.
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts (against the mock Canvas, which checks them).
 */

const AGS_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/';

/** The AGS scopes the grade worker asks for (LTI-012). */
export const AGS_SCOPES = Object.freeze({
  score: `${AGS_SCOPE}score`,
  lineItemReadonly: `${AGS_SCOPE}lineitem.readonly`,
});

/** The scopes of one token, space-separated as OAuth 2 sends them. */
export const AGS_TOKEN_SCOPE = `${AGS_SCOPES.score} ${AGS_SCOPES.lineItemReadonly}`;

/** AGS 2.0's media types. */
export const AGS_MEDIA_TYPES = Object.freeze({
  score: 'application/vnd.ims.lis.v1.score+json',
  lineItem: 'application/vnd.ims.lis.v2.lineitem+json',
});

/** OAuth 2's client-assertion type for a signed JWT (RFC 7523), which LTI 1.3's client credentials use. */
export const JWT_BEARER_ASSERTION = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
