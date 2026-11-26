/**
 * ltiInputText — the text an LTI login or launch may carry, checked before any of it reaches the database.
 *
 * Why: PostgreSQL's `text` and `jsonb` refuse U+0000 and unpaired UTF-16 surrogates. A login field or a claim with
 *      such a character failed inside the database driver and was answered with 500 and an error line, although
 *      the sender is at fault (PROD-012, NFR-006). No platform sends a control character in a form field or in a
 *      `sub`, so those are refused outright; other claims, such as a description on several lines, may hold
 *      line breaks and tabs.
 * Spec: LTI-001, PROD-012, NFR-006
 * Invariants:
 *   - A query or form field of an ltijs route (login, launch) holds no control character (U+0000 to U+001F, U+007F)
 *     and is well-formed text, at any depth of the parsed fields.
 *   - Of the claims that are stored: the `sub` holds no control character; every string and every key, at any
 *     depth, is well-formed and without U+0000.
 *   - A refusal is 400 `hvl:launch-malformed`, the «could not be opened from Canvas» page (./http/ltiErrorPages.ts);
 *     nothing is stored and no value is named.
 *   - `isLookupText`: text that could never be a stored value is not used as a database filter; it is "not found".
 *   - Every check is one iterative pass, so a deeply nested value costs no stack.
 * Collaborators: ./http/ExpressRouterHttpHandler.ts (fields), ./storage/PrismaLtiDatabaseManager.ts (claims and
 *   lookups), ./storage/ltiPlatformRows.ts (platform filters), ../http/authErrors.ts.
 * Tests: apps/server/test/lti/ltiInputText.test.ts, apps/server/test/lti/ltiMalformedInput.int.test.ts
 */
import { authError } from '../http/authErrors.js';

/**
 * Tells whether a text holds a C0 control character or DEL.
 * @param text - Any text.
 * @returns True for U+0000 to U+001F and U+007F anywhere in it.
 */
export function hasControlCharacter(text: string): boolean {
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Text PostgreSQL can hold in `text` and `jsonb`: well-formed UTF-16 without U+0000. */
const storable = (text: string): boolean => text.isWellFormed() && !text.includes('\u0000');

/** An identifier as a platform sends it: storable and without control characters. */
const plain = (text: string): boolean => text.isWellFormed() && !hasControlCharacter(text);

/**
 * Tells whether a value can be used to look a row up: a non-empty identifier a platform could have sent.
 * @param value - An issuer, client ID, nonce or similar, as the request or token gave it.
 * @returns False for anything that is not a string, is empty, or could never be stored.
 */
export const isLookupText = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && plain(value);

/** Visits every string, and every key when asked, of a parsed value; stops at the first `refuse` says yes to. */
function anyText(root: unknown, refuse: (text: string) => boolean, keysToo: boolean): boolean {
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') {
      if (refuse(value)) return true;
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        if (keysToo && refuse(key)) return true;
        pending.push(child);
      }
    }
  }
  return false;
}

/**
 * Refuses a login or launch request whose query or form fields hold a control character.
 * @param fields - The parsed query and the parsed form body.
 * @throws HttpError 400 `hvl:launch-malformed`.
 * @spec LTI-001
 */
export function assertLaunchFields(...fields: readonly Readonly<Record<string, unknown>>[]): void {
  // SECURITY: before ltijs reads a field, so no lookup or page is ever made from one (PROD-012).
  if (anyText(fields, (text) => !plain(text), false)) throw authError('hvl:launch-malformed');
}

/**
 * Refuses launch claims that cannot be stored, before the deployment check and the write.
 * @param claims - The allowlisted claims about to be stored (./storage/ltiIdTokenClaims.ts).
 * @throws HttpError 400 `hvl:launch-malformed`.
 * @spec LTI-001
 */
export function assertStorableClaims(claims: Readonly<Record<string, unknown>>): void {
  const { sub } = claims;
  // WHY: a `sub` is an identifier (LTI 1.3 Core: ASCII), sent back to the platform with a score; never free text.
  if (typeof sub === 'string' && !plain(sub)) throw authError('hvl:launch-malformed');
  if (anyText(claims, (text) => !storable(text), true)) throw authError('hvl:launch-malformed');
}
