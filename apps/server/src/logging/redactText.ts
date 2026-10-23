/**
 * redactText — masks credentials and contact identifiers inside free text before it is logged.
 *
 * Why: error messages and URLs carry tokens (`?ltik=`, `Authorization: Bearer …`, JWTs, passwords in
 *      connection strings) and e-mail addresses. Key-based redaction cannot see inside a string, so
 *      these well-defined shapes are masked by pattern (DATA-009).
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - Every pattern runs in linear time: each starts only where its token can start (lookbehind) and
 *     every repetition is bounded, so a long base64 or hex string cannot block the event loop.
 *   - Only shapes that are credentials or e-mail addresses are masked. Names and other free-text
 *     personal data cannot be recognised by pattern; callers must not put them in messages.
 *   - The result is still the same kind of text: no quotes, backslashes, commas or braces are consumed,
 *     so JSON escapes and URLs around a match stay intact.
 * Collaborators: ./redactPersonalData.ts (every string value), ./logger.ts (message strings).
 * Tests: apps/server/test/logging/logger.test.ts, apps/server/test/logging/redactText.test.ts
 */

/** Replacement written in place of a redacted value. */
export const REDACTED = '[Redacted]';

const TOKEN = '[A-Za-z0-9._~+/=-]';

/** Patterns in order: URL passwords run before e-mail addresses, since both contain `@`. */
const TEXT_PATTERNS: [RegExp, string][] = [
  // PRIVACY: the ltik may appear anywhere (query string, form body, start of a string) (DATA-009).
  [/(?<![\w-])(ltik=)[^&#\s"'\\]{1,4096}/gi, `$1${REDACTED}`],
  // SECURITY: OAuth/OIDC credentials and passwords in query strings and form bodies.
  [
    /([?&;](?:access_token|id_token|id_token_hint|refresh_token|token|api_?key|password|secret|client_secret|code|login_hint|lti_message_hint|state|nonce|code_verifier|csrf)=)[^&#\s"'\\]{1,4096}/gi,
    `$1${REDACTED}`,
  ],
  // SECURITY: our cookies (`__Host-hvli_sid`, the login transaction) in Cookie and Set-Cookie text (D-057).
  [/(?<![\w-])((?:__Host-)?hvli_[A-Za-z0-9_]{1,32}=)[^;&\s"'\\,]{1,4096}/g, `$1${REDACTED}`],
  // SECURITY: a signed content-file grant is a bearer credential for 12 hours (D-058).
  [/(\/h5p\/files\/)[^/\s"'\\?#]{1,512}/g, `$1${REDACTED}`],
  // WHY: schemes are case-insensitive (RFC 9110 §11.1), so case variants are spelled out rather than using
  // the `i` flag, which would make the mixed-case test below meaningless. The token must look like a
  // credential (a digit or symbol, or mixed case and at least 8 characters), so "basic validation" is kept.
  [
    new RegExp(
      `\\b([Bb][Ee][Aa][Rr][Ee][Rr]|[Bb][Aa][Ss][Ii][Cc]):?\\s+(?=${TOKEN}{0,4096}[0-9._~+/=-]|(?=${TOKEN}{0,4096}[a-z])(?=${TOKEN}{0,4096}[A-Z])${TOKEN}{8})${TOKEN}{1,4096}`,
      'g',
    ),
    `$1 ${REDACTED}`,
  ],
  [/(?<![\w-])eyJ[\w-]{1,4096}\.[\w-]{1,8192}\.[\w-]{0,4096}/g, REDACTED],
  // WHY: the password part is greedy up to the last `@` before the host, so `u:p@ss@host` loses all of `p@ss`.
  [
    /(?<![a-z0-9+.-])([a-z][a-z0-9+.-]{0,30}:\/\/)[^\s/:@"',{}\\]{0,256}:[^\s/"',{}\\]{0,256}@/gi,
    `$1${REDACTED}@`,
  ],
  // WHY: the domain must end in a letter-only label, so `express@4.22.3` and `pkg@1.0.0` are kept.
  [
    /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]{1,64}(?:@|%40)[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){0,8}\.\p{L}{2,63}(?![\p{L}\p{N}-])/gu,
    REDACTED,
  ],
];

/**
 * Masks credentials and e-mail addresses embedded in free text.
 * @param text - Any string that may be logged.
 * @returns The text with those values replaced by `[Redacted]`.
 */
export function redactText(text: string): string {
  return TEXT_PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
