/**
 * Principal — who is making a request, the same shape whether they came through the Feide portal or a Canvas
 * launch.
 *
 * Why: spec 02 §2 gives both entry points one server-side identity, so every route and the H5P permission
 *      system read one set of facts (D-053). The roles are computed once, at login or launch, from Feide's
 *      affiliation or the LTI roles; a request never raises them.
 * Spec: AUTH-002, LTI-004, LTI-001, DATA-002, DATA-012
 * Invariants:
 *   - `userId` is always set; learners have pseudonymous User rows (D-034, D-053).
 *   - `learnerKey` is the HMAC pseudonym, never a raw ID (DATA-002).
 *   - `learnerKeyYear` is the academic year of the secret that made `learnerKey`: a portal principal carries the
 *     year its session stored at login; an LTI principal derives its key for each request, so `learnerKeyYearOf`
 *     gives it the year of the request (D-107).
 *   - An LTI principal never has `admin`, `hvlMember` or `feideAuthenticated` (LTI-004, D-053, D-059).
 *   - The principal holds no name, e-mail, Feide ID, LTI `sub` or token.
 * Collaborators: ./principalToH5pActor.ts, ./requestPrincipal.ts, ./feide/FeideRoleMapper.ts,
 *   ../lti/LtiRoleMapper.ts, ../privacy/academicYear.ts, ../xapi/XapiIngest.ts (stores the year, D-107).
 * Tests: apps/server/test/auth/Principal.test.ts, apps/server/test/auth/requestPrincipal.test.ts
 */
import type { H5pRole } from '../h5p/HvlH5pUser.js';
import type { Locale } from '../i18n/translate.js';
import { academicYearOf } from '../privacy/academicYear.js';

/** A role in HVL Interaktiv (spec 02 `AUTH-002`, `LTI-004`). */
export type Role = H5pRole;

/** Roles from least to most powerful. */
export const ROLE_ORDER: readonly Role[] = ['learner', 'author', 'admin'];

/** How the principal authenticated. */
export type AuthMode = 'portal' | 'lti';

/** What the LTI launch said, for a principal that came from Canvas. */
export interface LtiLaunchFacts {
  /** `LtiPlatform.id` of the launching platform. */
  readonly platformId: string;
  /** The launch's `deployment_id` (checked against `LtiDeployment`, D-051). */
  readonly deploymentId: string;
  /** The course: `context.id` of the launch (not ltijs's `contextId`, which is a record ID). */
  readonly contextId: string;
  /** The resource link, for resource-link launches. */
  readonly resourceLinkId?: string;
  /** The activity the launch opens (`custom.contentId`), if any. */
  readonly contentId?: string;
  /** The AGS line item, when the placement is graded. */
  readonly lineItemUrl?: string;
  /** `LtiResourceLinkRequest` or `LtiDeepLinkingRequest`. */
  readonly messageType: string;
}

/** What every API handler receives after authentication (spec 02 §2, amended by D-053). */
export interface Principal {
  /** Internal `User.id`. */
  readonly userId: string;
  /** HMAC pseudonym for H5P state and statistics (DATA-002). */
  readonly learnerKey: string;
  /**
   * The academic year of the pseudonym secret that made `learnerKey` (D-107), e.g. 2026 for 2026/27. Set for a portal
   * principal from its session, whose key was made at login and can outlive 1 August by up to 12 hours (D-057);
   * unset for an LTI principal, whose key is derived for each request. Read it through `learnerKeyYearOf`.
   */
  readonly learnerKeyYear?: number;
  /** Every role the person holds; the H5P role is the highest. */
  readonly roles: readonly Role[];
  /** Portal (Feide session) or LTI (ltik). */
  readonly mode: AuthMode;
  /** UI language. */
  readonly locale: Locale;
  /** Portal: a Feide organisation in `ALLOWED_FEIDE_ORGS`. LTI: false. */
  readonly hvlMember: boolean;
  /** Portal only: logged in with Feide. */
  readonly feideAuthenticated: boolean;
  /** A student who may author through `AUTHOR_COURSE_GROUPS` (D-059). */
  readonly studentAuthor: boolean;
  /** The launch, for LTI principals. */
  readonly lti?: LtiLaunchFacts;
}

/**
 * The most powerful of a set of roles.
 * @param roles - Roles held.
 * @returns The highest role; `learner` for an empty list.
 */
export function highestRole(roles: readonly Role[]): Role {
  return ROLE_ORDER.reduce<Role>((best, role) => (roles.includes(role) ? role : best), 'learner');
}

/**
 * The academic year of the secret behind a principal's `learnerKey`, stored on the learner's rows so that the yearly
 * purge deletes them by year (D-107).
 * @param principal - Who made the request.
 * @param receivedAt - When the request arrived.
 * @returns The year the portal session stored at login; otherwise the academic year of `receivedAt`, since an LTI
 *   principal's key is derived for each request in that request's year.
 * @spec DATA-012
 */
export const learnerKeyYearOf = (principal: Pick<Principal, 'learnerKeyYear'>, receivedAt: Date): number =>
  principal.learnerKeyYear ?? academicYearOf(receivedAt);

/**
 * Tells whether a principal may author (create and edit their own activities).
 * @param principal - Who is asking.
 * @returns True for authors and admins.
 */
export const canAuthor = (principal: Pick<Principal, 'roles'>): boolean =>
  highestRole(principal.roles) !== 'learner';

/**
 * Freezes a principal and checks the LTI invariants, so no code path can build an LTI admin.
 * @param principal - The computed principal.
 * @returns The same principal, frozen.
 * @throws Error when an LTI principal holds `admin` or portal-only flags (a programming error).
 */
export function sealPrincipal(principal: Principal): Principal {
  if (principal.mode === 'lti') {
    // SECURITY: an LTI launch never grants admin (LTI-004), and Canvas users are not treated as HVL members.
    if (principal.roles.includes('admin')) throw new Error('an LTI principal cannot be admin');
    if (principal.hvlMember || principal.feideAuthenticated)
      throw new Error('an LTI principal has no Feide facts');
    if (!principal.lti) throw new Error('an LTI principal needs its launch facts');
  } else if (principal.lti) {
    throw new Error('a portal principal has no launch facts');
  }
  return Object.freeze({
    ...principal,
    roles: Object.freeze([...new Set(principal.roles)]),
    ...(principal.lti ? { lti: Object.freeze({ ...principal.lti }) } : {}),
  });
}
