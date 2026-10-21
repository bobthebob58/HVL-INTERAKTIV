/**
 * redactPersonalData — removes personal data and credentials from anything about to be logged.
 *
 * Why: logs are copied, shipped and kept for 30 days, so they must never hold names, e-mail addresses,
 *      Feide IDs, LTI subjects, tokens or learners' answers (DATA-009). Redaction by key name at any
 *      depth is safer than a fixed list of paths, because new log calls cannot forget a path.
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - Keys are matched case-insensitively, ignoring `-` and `_` (so `ID_Token` = `idToken`).
 *   - Keys starting with `feide` are redacted whatever follows (`feideId`, `feide_affiliation`).
 *   - In every string value, `ltik=` query parameters and `Bearer` credentials are masked too.
 *   - Input objects are never mutated; cycles are replaced by "[Circular]" instead of recursing forever.
 * Collaborators: ./logger.ts (applies it to every log record and message).
 * Tests: apps/server/test/logging/logger.test.ts
 */

/** Replacement written in place of a redacted value. */
export const REDACTED = '[Redacted]';

/**
 * Key names whose values are always removed (normalised: lower case, no `-` or `_`).
 * The first nine come from DATA-009; the rest are the same data under other common names.
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'ltik',
  'idtoken',
  'email',
  'name',
  'sub',
  'response',
  // PRIVACY: aliases of the DATA-009 list that HTTP, OIDC and LTI libraries use for the same data.
  'setcookie',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
  'clientsecret',
  'secretaccesskey',
  'privatekey',
  'givenname',
  'familyname',
  'displayname',
  'mail',
  'ltisub',
  'nin',
  'personnummer',
  'fodselsnummer',
]);

const normalise = (key: string): string => key.toLowerCase().replace(/[-_]/g, '');

/**
 * Tells whether a key's value must be redacted.
 * @param key - Object key as written by the caller.
 * @returns True for DATA-009 keys, their aliases and any `feide*` key.
 */
export function isSensitiveKey(key: string): boolean {
  const k = normalise(key);
  return SENSITIVE_KEYS.has(k) || k.startsWith('feide');
}

/**
 * Masks credentials embedded in free text, such as a URL with `?ltik=` or a copied header.
 * @param text - Any string that may be logged.
 * @returns The text with token values replaced.
 */
export function redactText(text: string): string {
  return text
    .replace(/([?&;]ltik=)[^&#\s"']+/gi, `$1${REDACTED}`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, `$1 ${REDACTED}`);
}

/**
 * Returns a deep copy of `value` with sensitive keys and embedded credentials redacted.
 * @param value - Anything: objects, arrays, errors, strings, numbers.
 * @param seen - Objects already visited (internal, for cycle detection).
 * @returns The redacted copy (primitives other than strings are returned as they are).
 */
export function redactPersonalData(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (Buffer.isBuffer(value) || value instanceof Date) return value;
  // WHY: only objects on the current path count as visited, so a shared (non-cyclic) object is kept.
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => redactPersonalData(item, seen));
    const source =
      value instanceof Error
        ? { ...value, type: value.name, message: value.message, stack: value.stack }
        : (value as Record<string, unknown>);
    return Object.fromEntries(
      Object.entries(source).map(([key, v]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redactPersonalData(v, seen),
      ]),
    );
  } finally {
    seen.delete(value);
  }
}
