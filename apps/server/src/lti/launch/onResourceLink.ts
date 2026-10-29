/**
 * onResourceLink — what happens when a learner or teacher opens an HVL Interaktiv link in Canvas.
 *
 * Why: LTI-006: the launch reads `contentId` from the custom claim, records or updates the placement and opens the
 *      player. An unknown, draft or invisible activity gives the friendly "not available" page (PROD-004, D-066);
 *      the activity's owner may preview a draft. The same View rule as everywhere else decides, including D-060
 *      (an instructor of a copied course may view the published activity their launch opened).
 * Spec: LTI-006, LTI-007, LTI-001, PROD-004, PED-030
 * Invariants:
 *   - The account is created or found here (the only LTI path that may write it); the `sub` is never stored.
 *   - Nothing is recorded for an activity the launch may not view; the answer is the one 404 page.
 *   - The player (or, when the web app runs, its chrome page `/app/play`) is opened with `context.redirect`, which
 *     appends the ltik (LTI-003 step 1).
 *   - Author launches are audited; learner launches are not (D-064).
 *   - The placement gets the launch's course label, which the recorder keeps only when it is a course code (D-087).
 * Collaborators: ../launchFacts.ts, ../ltikPrincipal.ts, ./ltiAccount.ts, ../placements/LtiPlacementRecorder.ts,
 *   ../../auth/principalToH5pActor.ts, ../../h5p/permissions/contentRules.ts, ../ltiRoutes.ts.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts
 */
import { ContentPermission } from '@lumieducation/h5p-server';
import type { OnLaunchHandler } from 'ltijs';
import type { AuthAuditRecorder } from '../../auth/audit/AuthAuditRecorder.js';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { asStateUser } from '../../h5p/HvlH5pUser.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { decideContent } from '../../h5p/permissions/contentRules.js';
import { canAuthor } from '../../auth/Principal.js';
import { authError } from '../../http/authErrors.js';
import { launchFactsOf } from '../launchFacts.js';
import { principalOfLaunch } from '../ltikPrincipal.js';
import { mapLtiRoles } from '../LtiRoleMapper.js';
import type { LtiPlacementRecorder } from '../placements/LtiPlacementRecorder.js';
import type { LtiAccounts } from './ltiAccount.js';

/** The page the player opens on (it receives `?ltik=`). */
export const LTI_PLAY_PATH = '/lti/play';

/** What a resource-link launch needs. */
export interface ResourceLinkDeps {
  readonly accounts: Pick<LtiAccounts, 'atLaunch'>;
  readonly access: ContentAccessRepository;
  readonly placements: Pick<LtiPlacementRecorder, 'record'>;
  readonly audit: Pick<AuthAuditRecorder, 'record'>;
  /** Where the launch lands: the web app's chrome page `/app/play` when it runs (D-067), else `/lti/play`. */
  readonly landingPath?: string;
}

/**
 * Builds the resource-link launch handler.
 * @param deps - Accounts, activity facts, placements and audit.
 * @returns The handler for `provider.onResourceLink`.
 */
export function onResourceLink(deps: ResourceLinkDeps): OnLaunchHandler {
  return async (context, _request, response) => {
    const facts = launchFactsOf(context.idToken);
    const roles = mapLtiRoles(facts.roles);
    const account = await deps.accounts.atLaunch({
      issuer: facts.issuer,
      subject: facts.subject,
      platformId: facts.platformId,
      roles,
    });
    if (canAuthor({ roles })) {
      await deps.audit.record({ event: 'launch.lti.author', actorUserId: account.userId });
    }
    const activity = facts.contentId ? await deps.access.factsFor(facts.contentId) : undefined;
    const viewer = asStateUser(principalToH5pActor(principalOfLaunch(context, facts, account)));
    // SECURITY: unknown, draft and invisible activities get the same answer, so a launch reveals nothing (D-066).
    if (!activity || !decideContent(viewer, ContentPermission.View, activity)) {
      throw authError('hvl:activity-unavailable');
    }
    if (facts.resourceLinkId && facts.contextId) {
      await deps.placements.record({
        platformId: facts.platformId,
        contextId: facts.contextId,
        resourceLinkId: facts.resourceLinkId,
        contentId: activity.contentId,
        ...(facts.lineItemUrl ? { lineItemUrl: facts.lineItemUrl } : {}),
        // PRIVACY: the recorder keeps the label only when it is a course code (D-087, ../placements/courseLabel.ts).
        contextLabel: context.idToken.launch.context?.label,
      });
    }
    context.redirect(response, deps.landingPath ?? LTI_PLAY_PATH);
  };
}
