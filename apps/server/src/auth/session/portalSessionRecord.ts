/**
 * portalSessionRecord — what a portal session holds in Redis, how that value is checked when read back, and the
 * shape routes see.
 *
 * Why: DATA-INVENTORY ("Redis keys") lists exactly which fields a session may
 *      hold. One schema keeps the store from writing anything else and turns a malformed or foreign value into
 *      "no session" instead of a half-trusted object (D-057).
 * Spec: AUTH-003, DATA-001, DATA-012
 * Invariants:
 *   - The stored record has exactly: userId, roles, hvlMember, studentAuthor, locale, learnerKey, learnerKeyYear,
 *     csrfToken, idTokenEncrypted (base64 of the D-056 format), createdAt and lastSeenAt (epoch milliseconds).
 *   - `learnerKeyYear` is the academic year of the secret that made `learnerKey` at login, so rows written for the
 *     session carry the key's year even after 1 August (D-107); a record without it is not a session.
 *   - No name, e-mail, Feide ID, Feide `sub` or session ID is ever part of it in plaintext; Feide's ID token (which
 *     holds such claims) is kept only inside `idTokenEncrypted` (D-021, D-056).
 *   - `toPortalSession` drops the encrypted ID token; only `SessionStore.destroy` reads it.
 * Collaborators: ./SessionStore.ts, ./portalSessionMiddleware.ts.
 * Tests: apps/server/test/auth/session/SessionStore.int.test.ts,
 *   apps/server/test/auth/session/SessionStore.integrity.int.test.ts
 */
import { z } from 'zod';
import type { Role } from '../Principal.js';
import { LOCALES, type Locale } from '../../i18n/translate.js';

// PRIVACY: exactly the fields DATA-INVENTORY lists for Redis sessions (DATA-001); no name, e-mail or Feide ID.
/** The shape a session record must have when it is written and when it is read back from Redis. */
export const PortalSessionRecordSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(['learner', 'author', 'admin'] as const satisfies readonly Role[])),
  hvlMember: z.boolean(),
  studentAuthor: z.boolean(),
  locale: z.enum(LOCALES),
  learnerKey: z.string().min(1),
  learnerKeyYear: z.int(),
  csrfToken: z.string().min(1),
  idTokenEncrypted: z.string().min(1),
  createdAt: z.number().int(),
  lastSeenAt: z.number().int(),
});

/** The value stored under a session key. */
export type PortalSessionRecord = z.infer<typeof PortalSessionRecordSchema>;

/** A live portal session as routes see it (without the ID token). */
export interface PortalSession {
  /** Internal `User.id`. */
  readonly userId: string;
  /** Roles computed at login (D-057); a role change in Feide applies at the next login. */
  readonly roles: readonly Role[];
  /** A Feide organisation in `ALLOWED_FEIDE_ORGS`. */
  readonly hvlMember: boolean;
  /** A student who may author through `AUTHOR_COURSE_GROUPS` (D-059). */
  readonly studentAuthor: boolean;
  /** UI language. */
  readonly locale: Locale;
  /** The learner pseudonym (DATA-002). */
  readonly learnerKey: string;
  /** The academic year of the pseudonym secret that made `learnerKey` at login (D-107), e.g. 2026 for 2026/27. */
  readonly learnerKeyYear: number;
  /** The synchronizer CSRF token of this session. */
  readonly csrfToken: string;
  /** When the session was created (login). */
  readonly createdAt: Date;
  /** The latest request, after this one slid it. */
  readonly lastSeenAt: Date;
}

/** What login hands to `SessionStore.create`. */
export interface NewPortalSession extends Omit<PortalSession, 'csrfToken' | 'createdAt' | 'lastSeenAt'> {
  /** Feide's raw ID token; stored encrypted only, for `id_token_hint` at logout (D-021). */
  readonly idToken: string;
}

/**
 * Checks a record before it is written.
 * @param record - The record to store.
 * @returns The same record.
 * @throws ZodError when a field is missing or invalid (a programming error).
 */
export const checkedPortalSessionRecord = (record: PortalSessionRecord): PortalSessionRecord =>
  PortalSessionRecordSchema.parse(record);

/**
 * Reads a stored value.
 * @param raw - The Redis value.
 * @returns The record, or undefined when the value is not JSON or not a valid record.
 */
export function parsePortalSessionRecord(raw: string): PortalSessionRecord | undefined {
  try {
    const result = PortalSessionRecordSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The route-facing view of a record.
 * @param record - A checked record.
 * @returns The session without its encrypted ID token.
 */
export const toPortalSession = ({
  idTokenEncrypted: _sealed,
  ...record
}: PortalSessionRecord): PortalSession => ({
  ...record,
  roles: Object.freeze([...record.roles]),
  createdAt: new Date(record.createdAt),
  lastSeenAt: new Date(record.lastSeenAt),
});
