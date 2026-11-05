/**
 * createH5pRuntime — assembles the whole H5P engine of the server: config, storages, permission system,
 * editor, player, AJAX endpoint, upload sanitisers and the temporary-file cleanup job.
 *
 * Why: the HTTP layer (../http/createH5pRouter.ts) and later the LTI and web routes (S3, S4) need one engine
 *      built one way. Building it here keeps every safety option in one reviewed place, runs the H5P-001 start
 *      check and the permission guard before anything is served, and never lets the server call the Hub on its
 *      own (empty content-type cache stored as `[]`, D-041).
 * Spec: H5P-001, H5P-004, H5P-006, H5P-007, H5P-008, SEC-001, SEC-002, PROD-013, SEC-006
 * Invariants:
 *   - The same HvlPermissionSystem instance is used by editor, player and routes; the guard checks it. The editor's
 *     paste-source guard reads the same activity facts as that permission system.
 *   - Editor and player share one HvlUrlGenerator; its content-file grants are signed with `URL_SIGNING_KEYS`,
 *     and the routes verify them with the same ContentFileGrants (D-058). Its file URLs and the player pages' policy
 *     name the files origin (`FILES_BASE_URL`, ../config/filesOrigin.ts); the editor's files have their own grants
 *     (`editorFileGrants`) on the app origin (D-110 amendment of 2026-11-05).
 *   - File sanitisers run in this order: file-type sniffer, then the SVG sanitiser.
 *   - With `CLAMAV_HOST`, the fail-closed ClamAV scanner is the editor's one malware scanner (editor uploads and
 *     package imports, SEC-006); without it there is none (../security/malware/createMalwareScanners.ts).
 *   - The cleanup job is created but not started; the server starts and stops it (S3 entry point).
 *   - The editor resets learner state only on a structural save, and the player's state URLs carry the activity's
 *     version, both on PostgreSQL (D-093, ../learningDesign/safeEditing/).
 *   - The editor carries the per-person copy limit in Redis, which the duplicator counts (D-092 amendment).
 *   - Editor and player get HVL's language overlay: the one given, or else `content/h5p-tekstar/` loaded here, so
 *     every engine (the server's, the seed command's, a test bed's) has it (D-111).
 * Collaborators: ./h5pServerInit.ts, ./h5pStorage.ts, ./H5pEditorFactory.ts, ./H5pPlayerFactory.ts,
 *   ./HvlUrlGenerator.ts, ./contentFileGrants.ts, ./permissionSystemGuard.ts, ./HvlPermissionSystem.ts,
 *   ../security/FileTypeSniffer.ts, ../security/SvgSanitizer.ts, ../http/createH5pRouter.ts, ../config/filesOrigin.ts,
 *   ../learningDesign/content/h5pTextsContent.ts (the overlay).
 * Tests: apps/server/test/http/router.int.test.ts, apps/server/test/http/signedFiles.int.test.ts,
 *   apps/server/test/http/filesOrigin.int.test.ts
 */
import type { S3Client } from '@aws-sdk/client-s3';
import { H5PAjaxEndpoint, type IH5PConfig } from '@lumieducation/h5p-server';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import { filesOriginOf } from '../config/filesOrigin.js';
import type { H5pRouteDeps } from '../http/h5pRouteDeps.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import { PrismaContentVersionReader } from '../learningDesign/safeEditing/contentVersionOnPages.js';
import { CopyRateLimit } from '../learningDesign/collaboration/CopyRateLimit.js';
import { loadLanguageOverlay } from '../learningDesign/content/h5pTextsContent.js';
import { PrismaLearnerStateStore } from '../learningDesign/safeEditing/PrismaLearnerStateStore.js';
import { FileTypeSniffer } from '../security/FileTypeSniffer.js';
import { createMalwareScanners } from '../security/malware/createMalwareScanners.js';
import { SvgSanitizer } from '../security/SvgSanitizer.js';
import { ContentFileGrants } from './contentFileGrants.js';
import { createHvlEditor } from './H5pEditorFactory.js';
import { createHvlPlayer } from './H5pPlayerFactory.js';
import { h5pServerInit } from './h5pServerInit.js';
import { createH5pStorage } from './h5pStorage.js';
import { HvlPermissionSystem } from './HvlPermissionSystem.js';
import { HvlUrlGenerator } from './HvlUrlGenerator.js';
import { createHvlTranslationCallback } from './HvlTranslationCallback.js';
import { TemporaryFileCleanupJob } from './jobs/TemporaryFileCleanupJob.js';
import { PrismaLibraryAuditSink } from './libraries/LibraryAuditSink.js';
import type { LanguageOverlay } from './languageOverlay/languageOverlay.js';
import { keepContentTypeCacheOffline } from './offlineContentTypeCache.js';
import { assertPermissionSystem } from './permissionSystemGuard.js';
import { PrismaContentAccessRepository } from './permissions/ContentAccessRepository.js';
import { PrismaUserDataAccessAuditor } from './permissions/UserDataAccessAuditor.js';
import { RedisKeyValueStorage } from './storage/RedisKeyValueStorage.js';
import { coreInlineScriptHashes } from './render/coreInlineScripts.js';

/** Connected clients and settings the engine is built from. */
export interface H5pRuntimeInputs {
  readonly env: Env;
  readonly logger: Logger;
  readonly db: Database;
  readonly redis: Redis;
  readonly s3: S3Client;
  /** Base folder for relative H5P folders; defaults to apps/server. */
  readonly root?: string;
  /**
   * Where the player's file URLs point; defaults to the files origin of `env` (../config/filesOrigin.ts). A test bed
   * that serves the player's file route on its one test server passes `''`, for relative URLs.
   */
  readonly filesOrigin?: string;
  /** HVL's texts for the libraries (D-111), as the start-up loaded them; loaded from `content/` when absent. */
  readonly languageOverlay?: LanguageOverlay;
}

/** The assembled engine: everything the routes need, plus the config and the cleanup job. */
export interface H5pRuntime extends H5pRouteDeps {
  readonly config: IH5PConfig;
  readonly cleanupJob: TemporaryFileCleanupJob;
}

/**
 * Builds the H5P engine.
 * @param inputs - Config, logger and connected clients.
 * @returns The runtime, ready to pass to `createH5pRouter`.
 * @throws CoreVersionMismatchError when the core files do not match (H5P-001);
 *   PermissionSystemMismatchError when any component would use another permission system;
 *   StudioContentError when no overlay is given and `content/h5p-tekstar/` has a problem.
 */
export async function createH5pRuntime(inputs: H5pRuntimeInputs): Promise<H5pRuntime> {
  const { env, logger, db, redis } = inputs;
  const keyValueStorage = new RedisKeyValueStorage(redis);
  const { config, paths } = await h5pServerInit({
    env,
    logger,
    keyValueStorage,
    ...(inputs.root ? { root: inputs.root } : {}),
  });
  const storages = {
    ...createH5pStorage({ env, db, redis, s3: inputs.s3, libraryDir: paths.libraryDir }),
    keyValueStorage,
  };
  await keepContentTypeCacheOffline(keyValueStorage);
  const contentFacts = new PrismaContentAccessRepository(db);
  const permissions = new HvlPermissionSystem({
    content: contentFacts,
    auditor: new PrismaUserDataAccessAuditor(db),
  });
  const translate = createHvlTranslationCallback();
  const fileSanitizers = [new FileTypeSniffer(), new SvgSanitizer()];
  const malwareScanners = await createMalwareScanners(env, logger);
  const fileGrants = new ContentFileGrants(env.URL_SIGNING_KEYS);
  const filesOrigin = inputs.filesOrigin ?? filesOriginOf(env);
  const urlGenerator = new HvlUrlGenerator(config, fileGrants, filesOrigin);
  const languageOverlay = inputs.languageOverlay ?? loadLanguageOverlay();
  const editor = createHvlEditor({
    config,
    storages,
    permissionSystem: permissions,
    audit: new PrismaLibraryAuditSink(db),
    contentFacts,
    learnerStates: new PrismaLearnerStateStore(db),
    // WHY: the duplicator reaches it through this editor; the studio services take only the editor (D-092).
    copyLimit: new CopyRateLimit(redis),
    translate,
    fileSanitizers,
    malwareScanners,
    urlGenerator,
    languageOverlay,
  });
  const player = createHvlPlayer({
    ...storages,
    config,
    permissionSystem: permissions,
    translate,
    urlGenerator,
    contentVersions: new PrismaContentVersionReader(db),
    languageOverlay,
  });
  assertPermissionSystem({ editor, player }, permissions);
  const cleanupJob = new TemporaryFileCleanupJob({
    redis,
    cleanUp: () => editor.temporaryFileManager.cleanUp(),
    logger,
  });
  return {
    config,
    editor,
    player,
    ajax: new H5PAjaxEndpoint(editor),
    permissions,
    fileSanitizers,
    fileGrants,
    editorFileGrants: new ContentFileGrants(env.URL_SIGNING_KEYS, 'editor-file-url'),
    uploadGrants: new ContentFileGrants(env.URL_SIGNING_KEYS, 'temporary-file-url'),
    corePath: paths.coreDir,
    editorPath: paths.editorDir,
    pageCsp: {
      scriptHashes: coreInlineScriptHashes(paths.coreDir),
      externalMediaOrigins: env.EXTERNAL_MEDIA_ORIGINS,
      filesOrigin,
    },
    logger,
    cleanupJob,
  };
}
