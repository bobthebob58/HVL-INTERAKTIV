/**
 * HvlH5pUser — the authenticated person behind every H5P request, in the two shapes Lumi needs (D-036).
 *
 * Why: Lumi passes one `IUser` everywhere and uses `user.id` both as the owner of content and as the key of
 *      learner state. Ownership needs the account ID; learner state must be keyed by the pseudonym only
 *      (DATA-002). So one actor is wrapped in two explicit views, and the permission system reads the
 *      actor's fields, never `user.id`, so handing Lumi the wrong view fails closed.
 * Spec: H5P-006, H5P-005, DATA-002
 * Invariants:
 *   - Only `asAccountUser` and `asStateUser` create users that `isHvlH5pUser` accepts; anything else is denied.
 *   - No view carries a name or e-mail address (they would end up in pages and logs).
 *   - Users and actors are frozen; a request cannot change who it acts as.
 * Collaborators: ./HvlPermissionSystem.ts, ../http/ (sets the actor; S3 maps its Principal to it).
 * Tests: apps/server/test/h5p/HvlH5pUser.test.ts
 */
import type { IUser } from '@lumieducation/h5p-server';
import type { Locale } from '../i18n/translate.js';

/** What a person may do in H5P (spec 01 `H5P-006`). S3 derives it from Feide or the LTI launch. */
export type H5pRole = 'learner' | 'author' | 'admin';

/** An admin's access to one learner's state for a data-subject request (audit-logged). */
export interface DataSubjectRequest {
  /** The request's reference in the case system. */
  readonly requestId: string;
  /** The learner whose state may be read or deleted. */
  readonly learnerKey: string;
}

/** The authenticated person behind an H5P request. */
export interface HvlH5pActor {
  /** Internal `User.id`: the owner of content and temporary files. */
  readonly accountId: string;
  /** Role for the permission matrix. */
  readonly role: H5pRole;
  /** Pseudonym that keys this person's H5P state (`DATA-002`), never a raw or internal ID. */
  readonly learnerKey: string;
  /** LMS context of this launch (a Canvas course); empty outside Canvas. */
  readonly contextId: string;
  /** UI language of this person. */
  readonly locale: Locale;
  /** True for HVL staff and students: may view activities shared with "everyone at HVL". */
  readonly hvlMember: boolean;
  /** True when signed in with Feide: may view activities shared with "anyone with Feide". */
  readonly feideAuthenticated: boolean;
  /** Activities this LTI launch opened; a learner may view these even when not otherwise visible. */
  readonly ltiLaunchContentIds: readonly string[];
  /** Present only in the data-subject-request tool. */
  readonly dataSubjectRequest?: DataSubjectRequest;
}

/** Which ID a view presents to Lumi as `IUser.id`. */
export type H5pUserView = 'account' | 'state';

/** An `IUser` built by this module: Lumi sees `id`, our code reads `actor`. */
export interface HvlH5pUser extends IUser {
  /** The person behind the request. */
  readonly actor: HvlH5pActor;
  /** `account`: `id` is the account ID; `state`: `id` is the learnerKey. */
  readonly view: H5pUserView;
}

const ISSUED = new WeakSet<object>();

function issue(actor: HvlH5pActor, view: H5pUserView): HvlH5pUser {
  const frozen = Object.freeze({
    ...actor,
    ltiLaunchContentIds: Object.freeze([...actor.ltiLaunchContentIds]),
  });
  const id = view === 'account' ? frozen.accountId : frozen.learnerKey;
  // PRIVACY: Lumi copies name and e-mail into pages and the Hub request; they stay empty.
  const user: HvlH5pUser = Object.freeze({ id, name: '', email: '', type: 'local', actor: frozen, view });
  ISSUED.add(user);
  return user;
}

/**
 * The account view: `id` is `User.id`. Use it for content, temporary files and the editor.
 * @param actor - The authenticated person.
 * @returns A frozen user that the permission system recognises.
 */
export const asAccountUser = (actor: HvlH5pActor): HvlH5pUser => issue(actor, 'account');

/**
 * The state view: `id` is the learnerKey. Use it for learner state and the player.
 * @param actor - The authenticated person.
 * @returns A frozen user that the permission system recognises.
 */
export const asStateUser = (actor: HvlH5pActor): HvlH5pUser => issue(actor, 'state');

/**
 * Tells whether a user came from `asAccountUser` or `asStateUser`.
 * @param user - Whatever Lumi passed as the acting user (may be undefined).
 * @returns True only for users issued by this module.
 */
export const isHvlH5pUser = (user: unknown): user is HvlH5pUser =>
  typeof user === 'object' && user !== null && ISSUED.has(user);
