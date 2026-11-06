/**
 * principalToH5pActor — the one mapping from a `Principal` to the actor the H5P permission system reads (D-053).
 *
 * Why: the H5P layer (S2, D-036) knows actors, not principals. Mapping in one place keeps both entry points
 *      consistent: the H5P role is the highest role, H5P state is keyed by the learnerKey and the Canvas course,
 *      an LTI launch lets its own activity be viewed (D-060), and the request's token is put into H5P's URLs (D-058).
 * Spec: H5P-006, H5P-007, LTI-007, DATA-002, DATA-003
 * Invariants:
 *   - `contextId` is the Canvas course of the launch, empty in the portal, so learner state is kept per course.
 *   - `learnerKeyYear` is `learnerKeyYearOf(principal, now)`: the year of the secret behind `learnerKey`, which the
 *     learner's H5P state rows store so the yearly purge deletes them with their key (D-107).
 *   - `ltiLaunchContentIds` holds only the activity the launch itself opened.
 *   - `urlToken` is the ltik (LTI) or the session's CSRF token (portal); nothing else goes into H5P URLs.
 *   - `studentAuthor` travels as the login computed it, so copying through the content bank is refused to a student
 *     author in the editor's paste guard as in the duplicate route (D-091, D-092).
 * Collaborators: ./Principal.ts, ../h5p/HvlH5pUser.ts, ./requestPrincipal.ts, ../lti/play/ltiPlayRoutes.ts.
 * Tests: apps/server/test/auth/principalToH5pActor.test.ts
 */
import type { HvlH5pActor, UrlToken } from '../h5p/HvlH5pUser.js';
import { highestRole, learnerKeyYearOf, type Principal } from './Principal.js';

/**
 * Maps a principal to an H5P actor.
 * @param principal - Who is making the request.
 * @param urlToken - The ltik or CSRF token of this request, for H5P's AJAX and user-data URLs.
 * @param now - When the request arrived; the key's year falls back to its academic year (`learnerKeyYearOf`).
 * @returns The actor.
 */
export function principalToH5pActor(
  principal: Principal,
  urlToken?: UrlToken,
  now: Date = new Date(),
): HvlH5pActor {
  const contentId = principal.lti?.contentId;
  return {
    accountId: principal.userId,
    role: highestRole(principal.roles),
    learnerKey: principal.learnerKey,
    // PRIVACY: the key's own year, carried to the state write, so the yearly purge takes the row with it (DATA-003).
    learnerKeyYear: learnerKeyYearOf(principal, now),
    contextId: principal.lti?.contextId ?? '',
    locale: principal.locale,
    hvlMember: principal.hvlMember,
    feideAuthenticated: principal.feideAuthenticated,
    studentAuthor: principal.studentAuthor,
    ltiLaunchContentIds: contentId ? [contentId] : [],
    ...(urlToken && urlToken.value !== '' ? { urlToken } : {}),
  };
}
