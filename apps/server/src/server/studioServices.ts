/**
 * studioServices — builds the læringsdesign studio's services (S5) once, from the connected clients, the H5P editor
 * and the studio content loaded at start-up, and closes those that hold a resource at shutdown.
 *
 * Why: the studio's `/api` routes (../http/api/studioRouter.ts), the editor's «Lagre som ny versjon» route and
 *      main.ts's shutdown need the same instances, built one way. Building them here keeps createApp.ts to the mount
 *      order, and gives each S5 workstream one place for its service: a field in `StudioServices` and its
 *      construction in `createStudioServices`.
 * Spec: PED-001, PROD-007, PROD-013
 * Invariants:
 *   - Built once per app, so every route shares one instance of each service (the PDF renderer's one browser and
 *     its concurrency limit are per process, D-096).
 *   - The duplicator saves through the same editor and reads the same activity facts as the H5P routes, so
 *     `duplicateRules` and the editor's paste-source guard decide alike (D-092).
 *   - Building contacts nothing: no query, no Redis command, no browser start (the PDF renderer starts its browser
 *     on the first export, D-096).
 *   - `content` is the frozen object `loadStudioContent` returned at start-up; nothing here reads `content/` again.
 *   - A service that holds a resource (a browser, a timer) has `close()`; `closeStudioServices` calls each once.
 * Collaborators: ./createApp.ts (builds them), ./main.ts (closes them), ../http/api/studioRouter.ts,
 *   ../learningDesign/http/studioRouteDeps.ts, ../learningDesign/content/loadStudioContent.ts,
 *   ../learningDesign/collaboration/ContentDuplicator.ts, ../learningDesign/patterns/PatternCreator.ts,
 *   ../learningDesign/metadata/LearningDesignStore.ts; each workstream's service as it is added.
 * Tests: apps/server/test/server/studioServices.test.ts
 */
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import type { PublishingDeps } from '../content/publishingDeps.js';
import type { ContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import type { H5pRouteDeps } from '../http/h5pRouteDeps.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import { ContentDuplicator } from '../learningDesign/collaboration/ContentDuplicator.js';
import type { StudioContent } from '../learningDesign/content/loadStudioContent.js';
import { LearningDesignStore } from '../learningDesign/metadata/LearningDesignStore.js';
import { PatternCreator } from '../learningDesign/patterns/PatternCreator.js';
import type { IdentityHasher } from '../security/keys/IdentityHasher.js';

/** What the studio's services are built from: createApp's inputs and the single instances it makes. */
export interface StudioServiceInputs {
  /** The parsed configuration: `MIN_GROUP_SIZE` (D-095) and the `PDF_*` variables (D-096). */
  readonly env: Env;
  readonly logger: Logger;
  readonly db: Database;
  /** Redis, for per-person rate limits such as the people search's (D-090). */
  readonly redis: Redis;
  /** The H5P engine; activities created from a pattern and copies are saved through its editor (D-085, D-092). */
  readonly h5p: Pick<H5pRouteDeps, 'editor'>;
  /** The studio content, loaded and frozen at start-up (D-082). */
  readonly studioContent: StudioContent;
  /** The activity facts the permission rules read: createApp's one instance, shared with the routes. */
  readonly access: ContentAccessRepository;
  /** The login's identity hasher: an exact Feide ID search finds the account by its hash (D-090). */
  readonly hasher: IdentityHasher;
  /** The publish flow's database, validator and clock: the mappe shows each activity's findings (D-094). */
  readonly publishing: PublishingDeps;
}

/**
 * The type of a service whose workstream has not built it yet. The workstream replaces it with its service's type
 * in `StudioServices` and replaces `undefined` with the construction in `createStudioServices`.
 */
export type PendingStudioService = undefined;

/**
 * The studio's services. Each workstream owns its fields and may add more next to them; a service whose object has a
 * `close()` method is closed at shutdown, so `close` means "release your resources" on every service here.
 */
export interface StudioServices {
  /** The studio content from `content/` (D-082): phases, references, guide, patterns and the mappe template. */
  readonly content: StudioContent;
  /** Copies activities: «Lag ein kopi» (W4, D-092) and the editor's «Lagre som ny versjon» (W5, D-093). */
  readonly duplicator: ContentDuplicator;
  /** W2: creates an activity from a pattern, with its metadata, in one request, and says which can be (D-085). */
  readonly patternCreator: PatternCreator;
  /** W3: reads and replaces an activity's learning-design metadata, and builds the planner's grid (D-087, D-088). */
  readonly learningDesignStore: LearningDesignStore;
  /** W4: finds HVL staff who may be co-authors, rate-limited per person (D-090). */
  readonly peopleDirectory: PendingStudioService;
  /** W6: renders the pedagogisk mappe as Markdown, with the minimum group size applied (D-094, D-095). */
  readonly mappeRenderer: PendingStudioService;
  /** W6: prints the mappe's HTML as a tagged PDF in a shared, lazily started Chromium (D-096). */
  readonly pdfRenderer: PendingStudioService;
}

/** A studio service that holds a resource, such as a browser, which must be released at shutdown. */
export interface ClosableStudioService {
  /** Releases the resource; called once, after the server has stopped taking requests. */
  close(): Promise<void>;
}

const isClosable = (service: unknown): service is ClosableStudioService =>
  typeof service === 'object' &&
  service !== null &&
  typeof (service as Partial<ClosableStudioService>).close === 'function';

/**
 * Builds the studio's services.
 * @param inputs - Configuration, clients, the H5P editor, the loaded content and createApp's shared instances.
 * @returns The services, frozen; build them once per app.
 * @example
 * const studio = createStudioServices({ ...appInputs, access, hasher, publishing });
 * app.use('/api', authenticate, apiRouter({ publishing, access, studio, serveDocs }));
 * @spec PED-001
 */
export function createStudioServices(inputs: StudioServiceInputs): StudioServices {
  const { db, access } = inputs;
  return Object.freeze({
    content: inputs.studioContent,
    duplicator: new ContentDuplicator({ db, editor: inputs.h5p.editor, access }),
    patternCreator: new PatternCreator({
      db,
      editor: inputs.h5p.editor,
      patterns: inputs.studioContent.patterns,
    }),
    learningDesignStore: new LearningDesignStore({
      db,
      phases: inputs.studioContent.phases.phases.map((phase) => phase.key),
    }),
    peopleDirectory: undefined,
    mappeRenderer: undefined,
    pdfRenderer: undefined,
  });
}

/**
 * Closes every studio service that holds a resource (see `ClosableStudioService`), all of them even when one fails.
 * A service that two fields share is closed once.
 * @param services - The services `createStudioServices` built.
 * @returns When every close has settled.
 * @throws AggregateError with each failure, after every service had its turn.
 */
export async function closeStudioServices(services: StudioServices): Promise<void> {
  const closable = new Set(Object.values(services).filter(isClosable));
  const results = await Promise.allSettled([...closable].map((service) => service.close()));
  const failures = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (failures.length > 0) throw new AggregateError(failures, 'a studio service did not close');
}
