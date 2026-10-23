/**
 * feideTypes.d.mts — the TypeScript shapes of the mock Feide (./mockFeide.mjs, ./feideUsers.mjs); type-only, it has
 * no JavaScript twin.
 *
 * Why: apps/server tests are strict TypeScript; ./mockPlatform.d.mts re-exports these shapes for them (D-049).
 * Spec: AUTH-001, AUTH-002, AUTH-003
 * Invariants: the shapes match what ./mockFeide.mjs returns and accepts.
 * Collaborators: ./mockPlatform.d.mts, ./mockFeide.mjs, ./feideUsers.mjs.
 * Tests: tools/mock-platform/test/mockFeide.test.mjs (behaviour); `npx tsc -p apps/server --noEmit` (callers).
 */

/** A Feide `eduPersonAffiliation` value. */
export type FeideAffiliation =
  'faculty' | 'student' | 'staff' | 'alum' | 'member' | 'affiliate' | 'employee' | 'library-walk-in';

/** A user to add to the mock Feide. Defaults: random UUID `sub`, `name` = key, realm `hvl.no`, `<key>@<realm>`. */
export interface FeideUserSpec {
  key: string;
  feideId?: string;
  sub?: string;
  name?: string;
  email?: string;
  realm?: string;
  affiliations?: FeideAffiliation[];
  /** FS group IDs such as `fc:fs:fs:emne:hvl.no:PPU101:1`, or whole Feide group objects. */
  groups?: Array<string | Record<string, unknown>>;
  /** The user has no Feide ID (e.g. a guest); the Feide ID claims are never released. */
  withoutFeideId?: boolean;
}

/** A mock Feide user after defaults; `feideId` is undefined for a user without a Feide ID. */
export interface FeideUser {
  key: string;
  sub: string;
  name: string;
  email: string | undefined;
  realm: string;
  affiliations: FeideAffiliation[];
  groups: Array<string | Record<string, unknown>>;
  feideId: string | undefined;
}

/** One RP-initiated logout the mock Feide accepted. */
export interface FeideLogout {
  idTokenHint: string;
  postLogoutRedirectUri: string;
  state: string | undefined;
}

/** A running mock Feide. */
export interface MockFeide {
  /** `http://localhost:<port>`, the discovery issuer. */
  issuer: string;
  /** Base URL of the Groups API: `GET <groupsApiUrl>/groups/me/groups`. */
  groupsApiUrl: string;
  /** `<issuer>/openid/endsession`. */
  endSessionUrl: string;
  clientId: string;
  /** Any secret is accepted; the mock does not check it. */
  clientSecret: string;
  /** Users by key: `author`, `student`, `ppu-student`, `uib-employee`, `no-feide-id`, plus added ones. */
  users: ReadonlyMap<string, FeideUser>;
  logouts: FeideLogout[];
  /** Adds or replaces a user. Throws a TypeError for an unknown affiliation or a string group that is not FS. */
  addUser(spec: FeideUserSpec): FeideUser;
  /** Queues the user the next /authorize logs in (default `author`). Throws a RangeError for an unknown key. */
  nextLogin(key: string): void;
  /** While true, the Groups API answers 503. */
  setGroupsFailure(failing: boolean): void;
  /** Edits the next ID token's payload and header before it is signed (synchronously). */
  tamperNextIdToken(edit: (payload: Record<string, unknown>, header: Record<string, unknown>) => void): void;
  /** Re-signs the next ID token with a key outside the JWKS under the real `kid`. */
  forgeNextIdTokenSignature(): void;
  close(): Promise<void>;
}
