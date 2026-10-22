/**
 * redactPersonalData — removes personal data and credentials from anything about to be logged.
 *
 * Why: logs are copied, shipped and kept for 30 days, so they must never hold names, e-mail addresses,
 *      Feide IDs, LTI subjects, tokens or learners' answers (DATA-009). Redaction by key name at any
 *      depth is safer than a fixed list of paths, because new log calls cannot forget a path.
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - Keys are matched case-insensitively, ignoring `-` and `_` (so `ID_Token` = `idToken`).
 *   - Keys that contain `feide`, keys ending in a sensitive word (`authToken`, `userEmail`, `ltiSubject`,
 *     `S3_SECRET_ACCESS_KEY`) and Feide attribute names are redacted too.
 *   - Every string value goes through `redactText` (credentials and e-mail addresses inside text).
 *   - Input objects are never mutated; cycles are replaced by "[Circular]" instead of recursing forever.
 *   - Prisma errors, wherever they appear, are reduced to their codes (./prismaErrorSummary.ts).
 * Collaborators: ./logger.ts (applies it to every log record and argument), ./redactText.ts,
 *   ./prismaErrorSummary.ts.
 * Tests: apps/server/test/logging/logger.test.ts
 */
import { isPrismaError, summarisePrismaError } from './prismaErrorSummary.js';
import { REDACTED, redactText } from './redactText.js';

/**
 * Key names whose values are always removed (normalised: lower case, no `-` or `_`).
 * The first eight come from DATA-009 (its `feide*` entry is matched by prefix in `isSensitiveKey`);
 * the rest are the same data under other common names.
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
  'subject',
  'token',
  'jwt',
  'apikey',
  'xapikey',
  'clientassertion',
  'idtokenhint',
  'loginhint',
  'credentials',
  'nin',
  'personnummer',
  'fodselsnummer',
]);

/** Endings that mark a key as sensitive whatever comes before them (`authToken`, `userEmail`, `ltiSubject`). */
export const SENSITIVE_SUFFIXES: readonly string[] = [
  'token',
  'secret',
  'password',
  'passwd',
  'email',
  'emailaddress',
  'apikey',
  'subject',
  'accesskey',
  'privatekey',
  'cookie',
  'authorization',
  'nin',
];

// PRIVACY: Feide attribute names for the Feide ID, legal name and national ID number (DATA-002).
const FEIDE_ATTRIBUTES = new Set(['edupersonprincipalname', 'noredupersonlegalname', 'noredupersonnin']);

const normalise = (key: string): string => key.toLowerCase().replace(/[-_\s]/g, '');

/**
 * Tells whether a key's value must be redacted.
 * @param key - Object key as written by the caller.
 * @returns True for DATA-009 keys and their aliases, keys ending in a sensitive word, and any key that
 *   names Feide (including claim URIs such as `https://n.feide.no/claims/nin`).
 */
export function isSensitiveKey(key: string): boolean {
  const k = normalise(key);
  return (
    SENSITIVE_KEYS.has(k) ||
    FEIDE_ATTRIBUTES.has(k) ||
    k.includes('feide') ||
    SENSITIVE_SUFFIXES.some((suffix) => k.endsWith(suffix))
  );
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
  // PRIVACY: Prisma renders query values into message and stack; keep only its codes.
  if (isPrismaError(value)) return summarisePrismaError(value);
  // WHY: only objects on the current path count as visited, so a shared (non-cyclic) object is kept.
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => redactPersonalData(item, seen));
    // WHY: an Error's own `name` would be blanked as a sensitive key; its class name goes to `type` instead.
    const { name: _name, ...own } = value as Error & Record<string, unknown>;
    const source =
      value instanceof Error
        ? { ...own, type: value.name, message: value.message, stack: value.stack }
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
