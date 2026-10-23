/**
 * syncLtiPlatforms — makes the registered LTI platforms and deployments match `LTI_PLATFORMS` at start-up.
 *
 * Why: which Canvas instances and deployments may launch the tool is configuration (D-051). Syncing at start-up
 *      registers new platforms (ltijs generates the tool key pair), updates changed endpoints, deactivates removed
 *      platforms, and replaces each platform's deployment list, so a deployment can be added or revoked with a
 *      configuration change and a restart.
 * Spec: LTI-001, LTI-002
 * Invariants:
 *   - A platform is identified by `(issuer, clientId)`; its tool key pair is generated once and never replaced here.
 *   - After a sync, exactly the configured deployments of each configured platform are allowed; a removed platform
 *     is inactive and has no deployments, so neither a new launch nor an old ltik works for it.
 *   - `authorizationServer` stays unset, so the client-assertion audience is the token URL (spec 02 LTI-001).
 *   - Several servers may start at once: a platform another server just registered is updated, not duplicated.
 * Collaborators: ../LtiProviderFactory.ts, ./LtiDeploymentGuard.ts, ../../config/envParsers.ts.
 * Tests: apps/server/test/lti/platforms/syncLtiPlatforms.int.test.ts
 */
import { IdTokenValidationMethod, type Platform, type Provider } from 'ltijs';
import type { LtiPlatformConfig } from '../../config/envParsers.js';
import type { Database } from '../../infra/prismaClient.js';

type PlatformManager = Provider['platformManager'];

/** What a sync did, for the start-up log (no secrets). */
export interface PlatformSyncSummary {
  /** Platforms registered for the first time. */
  readonly registered: number;
  /** Configured platforms that already existed (endpoints refreshed, reactivated). */
  readonly updated: number;
  /** Registered platforms no longer configured, now inactive. */
  readonly deactivated: number;
}

const settingsOf = (config: LtiPlatformConfig) => ({
  name: config.name,
  authenticationEndpoint: config.authEndpoint,
  accessTokenEndpoint: config.tokenEndpoint,
  idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: config.jwksUrl },
});

async function registerOrFind(platforms: PlatformManager, config: LtiPlatformConfig): Promise<Platform> {
  const existing = await platforms.getPlatformByUrlAndClientId(config.issuer, config.clientId);
  if (existing) return existing;
  try {
    return await platforms.registerPlatform({
      url: config.issuer,
      clientId: config.clientId,
      ...settingsOf(config),
    });
  } catch (error) {
    // WHY: another server may have registered it between our lookup and our insert.
    const raced = await platforms.getPlatformByUrlAndClientId(config.issuer, config.clientId);
    if (raced) return raced;
    throw error;
  }
}

async function replaceDeployments(db: Database, platformId: string, deploymentIds: readonly string[]) {
  await db.$transaction([
    db.ltiDeployment.deleteMany({ where: { platformId, deploymentId: { notIn: [...deploymentIds] } } }),
    db.ltiDeployment.createMany({
      data: deploymentIds.map((deploymentId) => ({ platformId, deploymentId })),
      skipDuplicates: true,
    }),
  ]);
}

/**
 * Registers, updates and deactivates platforms and replaces their deployments.
 * @param configured - The parsed `LTI_PLATFORMS`.
 * @param deps - ltijs's platform manager and the database.
 * @returns Counts for the start-up log.
 */
export async function syncLtiPlatforms(
  configured: readonly LtiPlatformConfig[],
  deps: { platforms: PlatformManager; db: Database },
): Promise<PlatformSyncSummary> {
  const { platforms, db } = deps;
  const kept = new Set<string>();
  let registered = 0;
  for (const config of configured) {
    const before = await platforms.getPlatformByUrlAndClientId(config.issuer, config.clientId);
    const platform = await registerOrFind(platforms, config);
    if (!before) registered += 1;
    await platforms.updatePlatform(platform, { ...settingsOf(config), active: true });
    await replaceDeployments(db, platform.id, [...new Set(config.deployments)]);
    kept.add(platform.id);
  }
  let deactivated = 0;
  for (const platform of await platforms.getPlatforms()) {
    if (kept.has(platform.id)) continue;
    // SECURITY: a removed platform loses its deployments too, so its existing ltiks stop working (D-051).
    await db.ltiDeployment.deleteMany({ where: { platformId: platform.id } });
    if (platform.active) {
      await platforms.deactivatePlatform(platform);
      deactivated += 1;
    }
  }
  return { registered, updated: configured.length - registered, deactivated };
}
