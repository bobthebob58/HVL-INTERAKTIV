/**
 * onDeepLinking — what happens when a teacher opens HVL Interaktiv from a Canvas placement to add activities.
 *
 * Why: LTI-005: a Deep Linking launch opens the picker; only authors may use it (a learner cannot place content).
 *      AUTH-005 links the teacher's Canvas identity to their Feide identity at this launch, from the in-memory
 *      claims, because `feide_login` is never stored (D-052, D-063).
 * Spec: LTI-005, AUTH-005, LTI-004
 * Invariants:
 *   - A launch whose roles are not author is refused with 403 `hvl:deep-link-not-allowed`, before any account is
 *     created.
 *   - The picker is opened with `context.redirect`, which appends the ltik.
 *   - Every Deep Linking launch is an author launch and is audited (D-064), and so is the linking outcome: a
 *     refusal on the claimant's own account, a link on the account the launch ends in (D-063); a link is audited
 *     without an actor when the launch fails after it.
 *   - Linking runs before the account is resolved and only reads the in-memory claims (`context.rawIdToken`).
 * Collaborators: ../launchFacts.ts, ./ltiAccount.ts, ../../auth/identity/accountLinking.ts, ../ltiRoutes.ts.
 * Tests: apps/server/test/lti/launch/onDeepLinking.test.ts, apps/server/test/lti/deepLinking/deepLinking.int.test.ts,
 *   apps/server/test/auth/identity/accountLinking.int.test.ts
 */
import type { OnLaunchHandler } from 'ltijs';
import type { AuthAuditRecorder } from '../../auth/audit/AuthAuditRecorder.js';
import type { LinkOutcome, LinkRequest } from '../../auth/identity/accountLinking.js';
import { canAuthor } from '../../auth/Principal.js';
import { authError } from '../../http/authErrors.js';
import { launchFactsOf } from '../launchFacts.js';
import { mapLtiRoles } from '../LtiRoleMapper.js';
import type { LtiAccounts } from './ltiAccount.js';

/** The picker page (it receives `?ltik=`). */
export const LTI_DEEP_LINK_PATH = '/lti/deeplink';

/** What a Deep Linking launch needs. */
export interface DeepLinkingDeps {
  readonly accounts: Pick<LtiAccounts, 'atLaunch'>;
  readonly audit: Pick<AuthAuditRecorder, 'record'>;
  /** Links the teacher's identities (AUTH-005), given the launch's in-memory claims. */
  readonly link?: (request: LinkRequest) => Promise<LinkOutcome | undefined>;
}

/**
 * Builds the Deep Linking launch handler.
 * @param deps - Accounts, audit and the AUTH-005 linking step.
 * @returns The handler for `provider.onDeepLinking`.
 */
export function onDeepLinking(deps: DeepLinkingDeps): OnLaunchHandler {
  return async (context, _request, response) => {
    const facts = launchFactsOf(context.idToken);
    const roles = mapLtiRoles(facts.roles);
    // SECURITY: placing content in a course is an author action (LTI-004); learners never reach the picker.
    if (!canAuthor({ roles })) throw authError('hvl:deep-link-not-allowed');
    const identity = { issuer: facts.issuer, subject: facts.subject, platformId: facts.platformId };
    // WHY: linking first lets a first launch put its LTI identity straight on the teacher's Feide account (D-063).
    const linked = await deps.link?.({
      ...identity,
      clientId: context.platform.clientId,
      claims: context.rawIdToken,
      roles,
    });
    let account;
    try {
      account = await deps.accounts.atLaunch({ ...identity, roles });
    } catch (error) {
      // WHY: a link already written stays in the audit even when the launch then fails (D-064).
      if (linked) await deps.audit.record(linked);
      throw error;
    }
    await deps.audit.record({ event: 'launch.lti.author', actorUserId: account.userId });
    // WHY: a refused claim is recorded on the claimant's own account, never on the Feide account it named; a link on
    //      the account the launch now uses, which is the Feide account (D-063, D-064).
    if (linked) await deps.audit.record({ ...linked, actorUserId: account.userId });
    context.redirect(response, LTI_DEEP_LINK_PATH);
  };
}
