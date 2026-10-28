/**
 * apiTestbedStudio — the studio's services for ./apiTestbed.ts, built by the server's own `createStudioServices` from
 * the test database, Redis and the studio content, with a stand-in for the H5P engine.
 *
 * Why: the API testbed injects principals instead of signing in, which suits permission matrices, but it has no H5P
 *      engine (no libraries, no S3). Studio routes whose services need no engine (learning design, collaboration, the
 *      mappe) can still be tested there with the real services; a service that saves through the editor fails loudly.
 * Spec: DOC-012
 * Invariants:
 *   - Built by `createStudioServices`, so a service a workstream adds there reaches this testbed without a change here.
 *   - Calling anything on the stand-in editor throws an error that names `openAppTestbed`; reading its members does
 *     not, because a service's constructor may keep one (ContentDuplicator keeps `libraryManager`).
 *   - The identity hasher uses the test environment's `IDENTITY_HASH_KEYS`, as the app does.
 * Collaborators: ./apiTestbed.ts, ../../src/server/studioServices.ts, ./appTestbed.ts (the testbed with the engine).
 * Tests: shared by apps/server/test/http/api/*.int.test.ts
 */
import type { PublishingDeps } from '../../src/content/publishingDeps.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import type { ContentAccessRepository } from '../../src/h5p/permissions/ContentAccessRepository.js';
import type { Redis } from '../../src/infra/redisClient.js';
import type { StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { createLogger } from '../../src/logging/logger.js';
import { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';
import { createStudioServices, type StudioServices } from '../../src/server/studioServices.js';
import { serviceEnv } from './services.js';

/**
 * A stand-in for something a testbed does not have: reading a member gives another stand-in, and calling or
 * constructing one throws.
 * @param what - What is missing, for the error, e.g. `H5P engine`.
 * @returns The stand-in, typed as the real thing.
 */
export function unavailableInApiTestbed<T extends object>(what: string): T {
  const refuse = (): never => {
    throw new Error(`apiTestbed has no ${what}; test a route that uses it with openAppTestbed`);
  };
  const standIn: object = new Proxy(refuse, {
    // WHY: `then` stays undefined, so awaiting a stand-in by accident does not call it.
    get: (_target, property) => (property === 'then' ? undefined : standIn),
    apply: refuse,
    construct: refuse,
  });
  return standIn as T;
}

/** What the API testbed has to build the studio's services from. */
export interface ApiTestbedStudioInputs {
  readonly db: PublishingDeps['db'];
  readonly redis: Redis;
  readonly access: ContentAccessRepository;
  /** The testbed's publish flow (its replaceable validator and movable clock). */
  readonly publishing: PublishingDeps;
  readonly studioContent: StudioContent;
}

/**
 * Builds the studio's services as createApp does, with the H5P editor replaced by a stand-in.
 * @param inputs - The testbed's database, Redis, activity facts, publish flow and studio content.
 * @returns The services.
 */
export function apiTestbedStudio(inputs: ApiTestbedStudioInputs): StudioServices {
  const env = serviceEnv();
  return createStudioServices({
    ...inputs,
    env,
    logger: createLogger({ level: 'silent' }),
    h5p: { editor: unavailableInApiTestbed<HvlH5PEditor>('H5P engine') },
    hasher: new IdentityHasher(env.IDENTITY_HASH_KEYS),
  });
}
