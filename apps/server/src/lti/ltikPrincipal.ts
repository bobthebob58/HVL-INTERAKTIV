/**
 * ltikPrincipal — turns an LTI launch, or a later request carrying its ltik, into a `Principal`.
 *
 * Why: LTI-003 step 4: "server middleware resolves getLaunchContext(ltik) into a Principal; invalid or expired →
 *      401". ltijs checks the ltik's signature and age but not whether the platform is still active or the
 *      deployment still allowed (D-050, D-051), so both are checked here on every use.
 * Spec: LTI-003, LTI-004, LTI-001, DATA-002
 * Invariants:
 *   - Any failure (bad, expired or foreign ltik; inactive platform; revoked deployment; account gone) is the same
 *     401 `hvl:ltik-invalid`, so nothing about the cause leaks.
 *   - Roles come from the launch's LTI roles only and never include admin (LTI-004); the principal is sealed.
 *   - A resumed request writes nothing; only the launch itself may create the account.
 * Collaborators: ./launchFacts.ts, ./LtiRoleMapper.ts, ./ltiLocale.ts, ./launch/ltiAccount.ts,
 *   ./platforms/LtiDeploymentGuard.ts, ../auth/requestPrincipal.ts, ./launch/onResourceLink.ts.
 * Tests: apps/server/test/lti/ltikPrincipal.int.test.ts
 */
import type { LaunchContext, Provider } from 'ltijs';
import { sealPrincipal, type Principal } from '../auth/Principal.js';
import { authError } from '../http/authErrors.js';
import { launchFactsOf, type LaunchFacts } from './launchFacts.js';
import type { LtiAccount, LtiAccounts } from './launch/ltiAccount.js';
import { localeFromLaunch } from './ltiLocale.js';
import { mapLtiRoles } from './LtiRoleMapper.js';
import type { LtiDeploymentGuard } from './platforms/LtiDeploymentGuard.js';

/** What resolving an ltik needs. */
export interface LtikResolverDeps {
  readonly provider: Pick<Provider, 'getLaunchContext'>;
  readonly deployments: Pick<LtiDeploymentGuard, 'isAllowed'>;
  readonly accounts: Pick<LtiAccounts, 'forRequest'>;
}

/** A resolved ltik: who asks, and the launch it continues. */
export interface ResolvedLtik {
  readonly principal: Principal;
  readonly context: LaunchContext;
  readonly facts: LaunchFacts;
}

/**
 * Builds the principal of a launch.
 * @param context - ltijs's launch context.
 * @param facts - The launch facts read from it.
 * @param account - The launch's account and learnerKey.
 * @returns A sealed LTI principal.
 */
export function principalOfLaunch(
  context: LaunchContext,
  facts: LaunchFacts,
  account: LtiAccount,
): Principal {
  return sealPrincipal({
    userId: account.userId,
    learnerKey: account.learnerKey,
    roles: mapLtiRoles(facts.roles),
    mode: 'lti',
    locale: localeFromLaunch(context.rawIdToken),
    // SECURITY: Canvas users are not treated as HVL members or Feide users, whatever the launch says (D-053).
    hvlMember: false,
    feideAuthenticated: false,
    studentAuthor: false,
    lti: {
      platformId: facts.platformId,
      deploymentId: facts.deploymentId,
      contextId: facts.contextId,
      messageType: facts.messageType,
      ...(facts.resourceLinkId ? { resourceLinkId: facts.resourceLinkId } : {}),
      ...(facts.contentId ? { contentId: facts.contentId } : {}),
      ...(facts.lineItemUrl ? { lineItemUrl: facts.lineItemUrl } : {}),
    },
  });
}

/**
 * Resolves an ltik into the principal of the launch it continues.
 * @param deps - The provider, the deployment guard and the LTI accounts.
 * @param ltik - The token from `Authorization: Bearer` or an allowed query parameter.
 * @returns The principal, the launch context and its facts.
 * @throws HttpError 401 `hvl:ltik-invalid` for any failure.
 */
export async function resolveLtik(deps: LtikResolverDeps, ltik: string): Promise<ResolvedLtik> {
  let context: LaunchContext;
  try {
    context = await deps.provider.getLaunchContext(ltik);
  } catch {
    throw authError('hvl:ltik-invalid');
  }
  // SECURITY: ltijs resumes a launch even after its platform was deactivated (pinned in the ltijs probe tests).
  if (!context.platform.active) throw authError('hvl:ltik-invalid');
  const facts = launchFactsOf(context.idToken);
  // SECURITY: a deployment removed from LTI_PLATFORMS stops working at once, not after the ltik's 24 hours (D-051).
  if (!(await deps.deployments.isAllowed(facts.platformId, facts.deploymentId)))
    throw authError('hvl:ltik-invalid');
  const account = await deps.accounts.forRequest({
    issuer: facts.issuer,
    subject: facts.subject,
    platformId: facts.platformId,
    roles: mapLtiRoles(facts.roles),
  });
  if (!account) throw authError('hvl:ltik-invalid');
  return { principal: principalOfLaunch(context, facts, account), context, facts };
}
