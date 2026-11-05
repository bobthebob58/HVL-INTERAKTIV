/**
 * uploadProof — run inside the app container by the smoke test (`node --import tsx --input-type=module -`, from
 * apps/server, with the app's own environment): uploads the EICAR test file and a clean PNG through the editor's
 * upload method, so the stack's clamd scans both, saves a draft activity with the clean image, renders its player and
 * prints the player's URL for that image on the files origin.
 *
 * Why: SEC-006 and SEC-004 must hold in the image, not only in the test beds: the stack's real clamd must refuse
 *      EICAR and pass a clean file, and the player's file URL must point at the files origin, where the running app
 *      serves it with the sandbox policy (D-110 integration amendment of 2026-11-05).
 * Spec: SEC-006, SEC-004, NFR-007
 * Invariants:
 *   - Builds the H5P engine with `createH5pRuntime` from `loadEnv()`, as the server does, so the scanner, the
 *     sanitisers and the URL generator are the production ones; nothing is replaced or faked.
 *   - The upload does what the AJAX upload route does after reading the request (`ajaxRoutes.ts`): the sanitisers,
 *     then Lumi's `files` action, which scans and stores. Only the HTTP part is left out: the stack has no Feide or
 *     LTI platform to log in with. The route itself is covered by apps/server/test/http/malwareScan.int.test.ts.
 *   - The author is a new staff `User` row with no person behind it; the activity stays a draft.
 *   - Prints one JSON line last: the EICAR outcome, the stored file, the activity and the file URL. The lines before
 *     it are the engine's own log (warn and above), which the smoke reads for the scanner's reason code. The URL
 *     carries a grant; the smoke uses it and never prints it.
 * Collaborators: apps/server/src/h5p/createH5pRuntime.ts, apps/server/src/h5p/HvlH5PEditor.ts, ./smokeChecks.sh
 *   (`check_upload`).
 * Tests: it is a check of the smoke test (./dockerSmoke.sh), run here and in .github/workflows/docker.yml.
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { loadEnv } from './src/config/env.ts';
import { createH5pRuntime } from './src/h5p/createH5pRuntime.ts';
import { asAccountUser, asStateUser } from './src/h5p/HvlH5pUser.ts';
import { PLAYER_DISPLAY_OPTIONS } from './src/http/routes/playerRoutes.ts';
import { createPrismaClient } from './src/infra/prismaClient.ts';
import { connectRedis } from './src/infra/redisClient.ts';
import { createS3Client } from './src/infra/s3Client.ts';
import { createLogger } from './src/logging/logger.ts';

/** A 1×1 PNG, as apps/server/test/support/uploadFixtures.ts has it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
// WHY: joined at run time, so a virus scanner on the build machine does not quarantine this script.
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', '-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

const env = loadEnv();
const logger = createLogger({ level: 'warn' });
const db = createPrismaClient(env.DATABASE_URL);
const redis = await connectRedis(env.REDIS_URL, logger);
let failed = false;
try {
  const h5p = await createH5pRuntime({ env, logger, db, redis, s3: createS3Client(env) });
  const { id: accountId } = await db.user.create({ data: { kind: 'staff' }, select: { id: true } });
  const actor = {
    accountId,
    role: 'author',
    learnerKey: `smoke-${randomUUID()}`,
    contextId: '',
    locale: 'nn',
    hvlMember: true,
    feideAuthenticated: true,
    studentAuthor: false,
    ltiLaunchContentIds: [],
  };
  /** Uploads as the route does: a temporary file that keeps its extension, the sanitisers, then Lumi's action. */
  const upload = async (name, mimetype, bytes, type) => {
    const tempFilePath = `/tmp/hvli-smoke-upload-${randomUUID()}-${name}`;
    writeFileSync(tempFilePath, bytes, { mode: 0o600 });
    for (const sanitizer of h5p.fileSanitizers) await sanitizer.sanitize(tempFilePath);
    const file = { name, mimetype, size: bytes.length, tempFilePath };
    const fields = { field: JSON.stringify({ name: 'file', type }) };
    return h5p.ajax.postAjax('files', fields, 'nn', asAccountUser(actor), file);
  };
  const eicar = await upload('vedlegg.txt', 'text/plain', Buffer.from(EICAR), 'file').then(
    () => 'stored',
    (error) => error?.messageKey ?? error?.name ?? 'Error',
  );
  const image = await upload('bilete.png', 'image/png', PNG, 'image');
  const media = {
    library: 'H5P.Image 1.1',
    params: {
      file: { path: image.path, mime: image.mime, width: image.width, height: image.height },
      alt: 'Prøvebilete',
      decorative: false,
      contentName: 'Image',
    },
    subContentId: randomUUID(),
    metadata: { contentType: 'Image', license: 'U', title: 'Prøvebilete' },
  };
  const params = {
    question: '<p>Vart biletet skanna?</p>',
    answers: [{ text: '<div>Ja</div>', correct: true }],
    media: { type: media },
  };
  const metadata = { title: 'Røyktest for opplasting', license: 'U' };
  const contentId = String(
    await h5p.editor.saveOrUpdateContent(
      undefined,
      params,
      metadata,
      'H5P.MultiChoice 1.16',
      asAccountUser(actor),
    ),
  );
  const stored = (await h5p.editor.contentManager.contentStorage.getParameters(contentId)).media.type.params
    .file;
  const model = await h5p.player.render(contentId, asStateUser(actor), 'nn', {
    ...PLAYER_DISPLAY_OPTIONS,
    contextId: '',
  });
  const contentUrl = model.integration.contents[`cid-${contentId}`].contentUrl;
  process.stdout.write(
    `${JSON.stringify({ eicar, stored: stored.path, contentId, fileUrl: `${contentUrl}/${stored.path}` })}\n`,
  );
} catch (error) {
  failed = true;
  // PRIVACY: the error's name and message only, never a stack with paths.
  process.stdout.write(`${JSON.stringify({ failed: `${error?.name}: ${error?.message}` })}\n`);
} finally {
  await Promise.allSettled([redis.quit(), db.$disconnect()]);
}
process.exit(failed ? 1 : 0);
