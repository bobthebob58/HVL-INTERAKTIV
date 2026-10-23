/**
 * LtiDeploymentGuard — tells whether a platform's deployment may launch the tool.
 *
 * Why: ltijs 7 accepts any `deployment_id` (it checks only that the claim is a string), but `LTI-001` requires a
 *      launch from a wrong deployment to be refused. The allowed deployments are the `LtiDeployment` rows synced
 *      from `LTI_PLATFORMS` (D-051). The ID-token storage asks before it mints a record, and the ltik resolver
 *      asks again on every request, so a revoked deployment also stops working ltiks.
 * Spec: LTI-001, LTI-002
 * Invariants:
 *   - Allowed only when a row `(platformId, deploymentId)` exists; anything malformed is not allowed.
 *   - The refusal is `authError('hvl:deployment-not-allowed')` (403) and names neither ID.
 *   - Does not look at `LtiPlatform.active`: the ltik resolver checks that separately (D-050).
 * Collaborators: ../storage/PrismaLtiDatabaseManager.ts (saveIdToken), ./syncLtiPlatforms.ts (writes the rows),
 *   the ltik resolver, ../../http/authErrors.ts.
 * Tests: apps/server/test/lti/storage/LtiDeploymentGuard.int.test.ts,
 *   apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import { authError } from '../../http/authErrors.js';
import { isPlatformId } from '../storage/ltiPlatformRows.js';

/** Checks LTI deployments against the `LtiDeployment` table. */
export class LtiDeploymentGuard {
  /**
   * @param db - The database with the `LtiDeployment` rows.
   */
  constructor(private readonly db: Pick<Database, 'ltiDeployment'>) {}

  /**
   * Tells whether a deployment of a platform may launch the tool.
   * @param platformId - ltijs's platform ID (`LtiPlatform.id`).
   * @param deploymentId - The launch's `deployment_id` claim.
   * @returns True when the deployment is configured for that platform.
   * @spec LTI-001
   */
  async isAllowed(platformId: string, deploymentId: string): Promise<boolean> {
    // SECURITY: a missing or malformed ID never matches, and never reaches the query as an "any" filter (LTI-001).
    if (!isPlatformId(platformId) || typeof deploymentId !== 'string' || deploymentId === '') return false;
    const row = await this.db.ltiDeployment.findUnique({
      where: { platformId_deploymentId: { platformId, deploymentId } },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Refuses a deployment that may not launch the tool.
   * @param platformId - ltijs's platform ID (`LtiPlatform.id`).
   * @param deploymentId - The launch's `deployment_id` claim.
   * @throws HttpError `hvl:deployment-not-allowed` (403) when the deployment is not configured.
   * @spec LTI-001
   */
  async assertAllowed(platformId: string, deploymentId: string): Promise<void> {
    if (!(await this.isAllowed(platformId, deploymentId))) throw authError('hvl:deployment-not-allowed');
  }
}
