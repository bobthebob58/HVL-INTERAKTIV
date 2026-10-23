/**
 * PrismaLtiDatabaseManager — ltijs 7's storage (`DatabaseManager`, all 14 methods) on PostgreSQL through Prisma.
 *
 * Why: ltijs stores platforms, platform access tokens, launch ID tokens and OIDC nonces through a pluggable
 *      `DatabaseManager`; its default is MongoDB, which we do not run. `LTI-002` asks for PostgreSQL storage with
 *      atomic nonces, expiring records and encrypted private keys; D-051 adds the deployment check and D-052 the
 *      claim allowlist.
 * Spec: LTI-002, LTI-001, DATA-002
 * Invariants:
 *   - `saveIdToken` first checks the deployment (no record, so no ltik, for a deployment `LTI_PLATFORMS` does
 *     not list), then stores an allowlisted deep copy of the claims; it never changes its argument.
 *   - ID tokens are returned for 24 hours, nonces consumed for 10 minutes and access tokens returned until
 *     `expires_in`, whether or not the cleanup job has deleted them yet (./ltiRecordLifetimes.ts).
 *   - `consumeNonce` is one conditional DELETE, so of any number of concurrent calls exactly one succeeds.
 *   - Private keys and access tokens are stored only encrypted (./ltiPlatformRows.ts, ./ltiAccessTokenRows.ts).
 *   - A malformed ID or nonce is "not found", never a query error or an unfiltered query.
 *   - `listen` and `close` do nothing: the server owns the Prisma client's lifecycle.
 * Collaborators: ltijs `Provider` (ProviderOptions.databaseManager), ../platforms/LtiDeploymentGuard.ts,
 *   ./ltiIdTokenClaims.ts, ./LtiRecordCleanupJob.ts (deletes what expired), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts (runs the shared suite
 *   apps/server/test/lti/storage/ltiDatabaseContract.ts), apps/server/test/lti/storage/ltiSecretsAtRest.int.test.ts,
 *   apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { AccessTokenRecord, DatabaseManager, IdTokenClaims, IdTokenRecord } from 'ltijs';
import type { PlatformAttributes, PlatformFilter, PlatformRecord } from 'ltijs';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Database } from '../../infra/prismaClient.js';
import type { DataEncryption } from '../../security/keys/DataEncryption.js';
import type { LtiDeploymentGuard } from '../platforms/LtiDeploymentGuard.js';
import { accessTokenColumns, accessTokenFromRow } from './ltiAccessTokenRows.js';
import { minimiseIdTokenClaims } from './ltiIdTokenClaims.js';
import { isPlatformId, platformCreateData, platformFromRow, platformUpdateData } from './ltiPlatformRows.js';
import { platformWhere } from './ltiPlatformRows.js';
import { ID_TOKEN_LIFETIME_MS, NONCE_LIFETIME_MS } from './ltiRecordLifetimes.js';

const DEPLOYMENT_ID_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/deployment_id';

/** What the storage needs. */
export interface PrismaLtiDatabaseManagerDeps {
  /** The server's Prisma client. */
  readonly db: Database;
  /** `DATA_ENCRYPTION_KEYS`, for private keys and access tokens. */
  readonly encryption: DataEncryption;
  /** The deployment check run before an ID token is stored (D-051). */
  readonly deployments: Pick<LtiDeploymentGuard, 'assertAllowed'>;
  /** The clock; tests pass a fixed one. Defaults to the system clock. */
  readonly now?: () => Date;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** ltijs's `DatabaseManager` on PostgreSQL. */
export class PrismaLtiDatabaseManager implements DatabaseManager {
  private readonly db: Database;
  private readonly encryption: DataEncryption;
  private readonly now: () => Date;

  /**
   * @param deps - Prisma client, encryption, deployment guard and an optional clock.
   */
  constructor(private readonly deps: PrismaLtiDatabaseManagerDeps) {
    this.db = deps.db;
    this.encryption = deps.encryption;
    this.now = deps.now ?? (() => new Date());
  }

  // WHY: ltijs would connect and disconnect its store here; Prisma's connection belongs to the server.
  async listen(): Promise<void> {}

  async close(): Promise<void> {}

  async getPlatforms(filter?: PlatformFilter): Promise<PlatformRecord[]> {
    const rows = await this.db.ltiPlatform.findMany({
      where: platformWhere(filter),
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => platformFromRow(row, this.encryption));
  }

  async getPlatformById(id: string): Promise<PlatformRecord | undefined> {
    if (!isPlatformId(id)) return undefined;
    const row = await this.db.ltiPlatform.findUnique({ where: { id } });
    return row === null ? undefined : platformFromRow(row, this.encryption);
  }

  async getPlatformByUrlAndClientId(url: string, clientId: string): Promise<PlatformRecord | undefined> {
    if (!isNonEmptyString(url) || !isNonEmptyString(clientId)) return undefined;
    const row = await this.db.ltiPlatform.findUnique({ where: { url_clientId: { url, clientId } } });
    return row === null ? undefined : platformFromRow(row, this.encryption);
  }

  async savePlatform(platform: PlatformAttributes): Promise<string> {
    const data = platformCreateData(platform, this.encryption);
    return (await this.db.ltiPlatform.create({ data, select: { id: true } })).id;
  }

  async updatePlatformById(id: string, fields: Partial<PlatformAttributes>): Promise<void> {
    if (!isPlatformId(id)) return;
    await this.db.ltiPlatform.updateMany({
      where: { id },
      data: platformUpdateData(fields, this.encryption),
    });
  }

  async deletePlatformById(id: string): Promise<void> {
    if (!isPlatformId(id)) return;
    await this.db.ltiPlatform.deleteMany({ where: { id } });
  }

  async getAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
  ): Promise<AccessTokenRecord | undefined> {
    const row = await this.db.ltiAccessToken.findUnique({
      where: { platformUrl_clientId_scopes: { platformUrl, clientId, scopes } },
    });
    if (row === null || row.expiresAt <= this.now()) return undefined;
    return accessTokenFromRow(row, this.encryption);
  }

  async saveAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
    token: AccessTokenRecord,
  ): Promise<string> {
    const columns = accessTokenColumns(token, this.encryption);
    const row = await this.db.ltiAccessToken.upsert({
      where: { platformUrl_clientId_scopes: { platformUrl, clientId, scopes } },
      create: { platformUrl, clientId, scopes, ...columns },
      update: columns,
      select: { id: true },
    });
    return row.id;
  }

  async getIdToken(id: string): Promise<IdTokenRecord | undefined> {
    if (!isNonEmptyString(id)) return undefined;
    const row = await this.db.ltiIdToken.findUnique({ where: { id } });
    if (row === null || row.expiresAt <= this.now()) return undefined;
    return { ...(row.claims as unknown as IdTokenClaims), id: row.id };
  }

  async saveIdToken(token: IdTokenClaims): Promise<string> {
    // SECURITY: no record, and so no ltik, for a deployment that LTI_PLATFORMS does not list (LTI-001, D-051).
    await this.deps.deployments.assertAllowed(token.platform_id, token[DEPLOYMENT_ID_CLAIM] as string);
    // PRIVACY: names, e-mail, lis and unknown custom fields never reach the table (DATA-002, D-052).
    const claims = minimiseIdTokenClaims(token);
    const createdAt = this.now();
    const id = randomUUID();
    await this.db.ltiIdToken.create({
      data: {
        id,
        claims: claims as unknown as Prisma.InputJsonValue,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + ID_TOKEN_LIFETIME_MS),
      },
    });
    return id;
  }

  async saveNonce(nonce: string): Promise<string> {
    await this.db.ltiNonce.create({ data: { nonce, createdAt: this.now() } });
    return nonce;
  }

  async consumeNonce(nonce: string): Promise<boolean> {
    // SECURITY: without this guard an undefined nonce would drop the filter and match every recent nonce.
    if (!isNonEmptyString(nonce)) return false;
    const freshSince = new Date(this.now().getTime() - NONCE_LIFETIME_MS);
    // SECURITY: one conditional DELETE is atomic, so a replayed ID token can never use a nonce twice (LTI-002).
    const { count } = await this.db.ltiNonce.deleteMany({ where: { nonce, createdAt: { gt: freshSince } } });
    return count === 1;
  }
}
