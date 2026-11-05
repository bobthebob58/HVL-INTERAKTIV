/**
 * canvasTarget — the Canvas the live-contract checks run against: the platform as the test server registered it, the
 * tool key read as the grade worker reads it, and the service URLs of the test course.
 *
 * Why: a token request must be signed with the key whose public half the developer key's `public_jwk_url` (the test
 *      server's `/lti/keys`) publishes, and Canvas ties a line item to the tool that created it (D-101's amendment of
 *      2026-11-05). The grade worker reads that key through ltijs's platform manager over `PrismaLtiDatabaseManager`
 *      (D-104, D-056); this module reads it through the same storage class from the test server's database.
 * Spec: LTI-012, LTI-008
 * Invariants:
 *   - SECURITY: only the `LtiPlatform` row of the named issuer and client ID is read, and nothing is written. The key
 *     and every assertion signed with it stay in memory: never logged, never in an error or assertion message.
 *   - An unknown or inactive platform fails the run with a message that names variables, not values.
 *   - The course's service URLs have the form Canvas's launch claims carry, on the institution domain:
 *     `<origin>/api/lti/courses/<course>/line_items` and `/names_and_roles` (canvas-platform-values.md §1).
 *   - The mock target (./mockCanvasTarget.ts) is loaded only for `LIVE_TARGET=mock`, so a Canvas run never loads the
 *     test bed.
 * Collaborators: ./liveConfig.ts, ./mockCanvasTarget.ts, ../src/lti/storage/PrismaLtiDatabaseManager.ts,
 *   ../src/grades/agsClientAssertion.ts, ../src/grades/AgsAccessTokens.ts.
 * Tests: apps/server/live/canvasToken.live.test.ts, apps/server/live/canvasAgs.live.test.ts,
 *   apps/server/live/canvasNrps.live.test.ts
 */
import type { PlatformRecord } from 'ltijs';
import type { AgsPlatformDirectory, AgsPlatformRecord } from '../src/grades/AgsAccessTokens.js';
import { signClientAssertion } from '../src/grades/agsClientAssertion.js';
import { createPrismaClient, type Database } from '../src/infra/prismaClient.js';
import type { AgsLabelMode } from '../src/lti/deepLinking/formativeLabel.js';
import { PrismaLtiDatabaseManager } from '../src/lti/storage/PrismaLtiDatabaseManager.js';
import { DataEncryption } from '../src/security/keys/DataEncryption.js';
import { parseKeyring, type Keyring } from '../src/security/keys/keyring.js';
import { LiveConfigError, type LivePlan } from './liveConfig.js';

/** The test course and what the checks expect of it. */
export interface LiveCourse {
  /** Where AGS and NRPS answer: the institution domain, or the mock Canvas's origin. */
  readonly apiOrigin: string;
  readonly courseId: string;
  /** A test student's LTI `sub`; without it no score is posted. */
  readonly studentSub: string | undefined;
  /** The label mode the line items were made with (D-105). */
  readonly labelMode: AgsLabelMode;
}

/** A Canvas to check, with the tool's registration on it. */
export interface CanvasTarget extends LiveCourse {
  /** `the mock Canvas` or `the test Canvas`, for test titles. */
  readonly description: string;
  /** The platform as the grade worker sees it. */
  readonly platform: AgsPlatformRecord;
  /** The directory `AgsAccessTokens` reads the platform and its key from, as in production. */
  readonly directory: AgsPlatformDirectory;
  /** The course's line-item container. */
  readonly lineItemsUrl: string;
  /** The course's Names and Roles service. */
  readonly membershipsUrl: string;
  /**
   * Signs a client assertion as the grade worker does (`signClientAssertion`).
   * @param audience - Another `aud`, to see how the platform refuses it; default the platform's token endpoint.
   * @returns The compact JWT; it lives for one request.
   */
  assertion(audience?: string): string;
  /** Ends the run: closes the database connection (or the mock's test bed). */
  close(): Promise<void>;
}

/** The deployment check ltijs's storage asks for; a read-only run stores no ID token, so it is never called. */
export const NO_DEPLOYMENTS = Object.freeze({
  assertAllowed: async (): Promise<void> => {
    throw new Error('the live checks store no ID tokens');
  },
});

/**
 * Reads the registered platform with its decrypted tool key.
 * @param db - A Prisma client on the server's database.
 * @param keys - The server's `DATA_ENCRYPTION_KEYS`.
 * @param find - Which platform: by issuer and client ID, or by its ID.
 * @returns The platform record, or undefined when there is none.
 */
export async function readPlatform(
  db: Database,
  keys: Keyring,
  find: { readonly issuer: string; readonly clientId: string } | { readonly id: string },
): Promise<PlatformRecord | undefined> {
  const storage = new PrismaLtiDatabaseManager({
    db,
    encryption: new DataEncryption(keys),
    deployments: NO_DEPLOYMENTS,
  });
  return 'id' in find
    ? storage.getPlatformById(find.id)
    : storage.getPlatformByUrlAndClientId(find.issuer, find.clientId);
}

/**
 * Builds the target from a platform record and the course.
 * @param record - The platform with its private key, from `readPlatform`.
 * @param course - The course and its expectations.
 * @param description - How test titles name the platform.
 * @param close - What ends the run.
 * @returns The target.
 */
export function canvasTargetOf(
  record: PlatformRecord,
  course: LiveCourse,
  description: string,
  close: () => Promise<void>,
): CanvasTarget {
  const platform: AgsPlatformRecord = {
    id: record.id,
    clientId: record.clientId,
    accessTokenEndpoint: record.accessTokenEndpoint,
    authorizationServer: record.authorizationServer,
    active: record.active,
  };
  // SECURITY: the key is kept in this closure only; nothing returned exposes it.
  const key = record.keys.private;
  const courseBase = `${course.apiOrigin}/api/lti/courses/${encodeURIComponent(course.courseId)}`;
  return {
    ...course,
    description,
    platform,
    directory: {
      getPlatformById: async (id) => (id === platform.id ? platform : undefined),
      getPrivateKey: async () => key,
    },
    lineItemsUrl: `${courseBase}/line_items`,
    membershipsUrl: `${courseBase}/names_and_roles`,
    assertion: (audience) =>
      signClientAssertion(
        audience === undefined ? platform : { ...platform, authorizationServer: audience },
        key,
        Date.now(),
      ),
    close,
  };
}

/**
 * Opens the Canvas the plan names.
 * @param plan - From `livePlanOf`; the mock target or a named Canvas.
 * @returns The target; the caller closes it.
 * @throws LiveConfigError when the plan names no Canvas, or the test server has no active platform for it.
 * @spec LTI-012
 */
export async function openCanvasTarget(plan: LivePlan): Promise<CanvasTarget> {
  if (plan.kind === 'mock') return (await import('./mockCanvasTarget.js')).openMockCanvasTarget();
  if (plan.kind !== 'live' || plan.canvas === undefined) throw new LiveConfigError('no Canvas target is set');
  const settings = plan.canvas;
  const db = createPrismaClient(settings.databaseUrl);
  try {
    const keys = parseKeyring(settings.dataEncryptionKeys);
    const record = await readPlatform(db, keys, settings);
    if (!record?.active) {
      throw new LiveConfigError(
        'the database at LIVE_DATABASE_URL has no active platform for LIVE_CANVAS_ISSUER and LIVE_CANVAS_CLIENT_ID',
      );
    }
    return canvasTargetOf(record, settings, 'the test Canvas', () => db.$disconnect());
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}
