/**
 * loadBench — the server under NFR-001's load: the whole app as `createApp` builds it, in one Node process, with the
 * mock Canvas pointed at it, the ten real content types, the QuestionSet example published, and one Canvas launch
 * address per learner written to a file for k6 (tools/load/).
 *
 * Why: NFR-001 measures one application node under 200 learners. D-114's load amendment of 2026-11-05 builds that
 *      node from the test bed's code (./appTestbed.ts's app, the D-078 packages through the seed path), in a database
 *      of its own (./loadDatabase.ts), so a run never adds rows to the shared development database.
 * Spec: NFR-001
 * Invariants:
 *   - Usage: `tsx --env-file-if-exists=.env test/load/loadBench.ts --learners <n> --addresses <file>`.
 *   - Prints exactly one JSON line when ready (`{"ready":true,…}`) and, on SIGTERM or SIGINT, one with the stored
 *     row counts (`{"rows":{…}}`), then closes the app, drops its database and exits 0; a failure prints
 *     `{"error":…}` and exits 1. Nothing else goes to standard output.
 *   - PRIVACY: the address file holds the tool's and the mock's URLs, the activity ID and one mock course-frame URL
 *     per learner; never an ltik, an ID token or a `sub` (DATA-009). It is written for its owner only (0600).
 *   - Every learner is a new random `sub` of the mock Canvas, launched as a student into one course and one link.
 * Collaborators: ../support/appTestbed.ts, ../support/realPackages.ts, ./loadDatabase.ts,
 *   ../../../../tools/load/runLoad.mjs (starts it), ../../../../tools/mock-platform/mockPlatform.mjs.
 * Tests: tools/load/test/loadBench.test.mjs
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { LibraryInstaller } from '../../src/h5p/libraries/LibraryInstaller.js';
import { seedLibraries } from '../../src/h5p/libraries/seedLibraries.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { REAL_PACKAGES_DIR, hasRealPackages } from '../support/realPackages.js';
import { testActor } from '../support/testActors.js';
import { TestLibraryAuditSink } from '../support/testLibraryAuditSink.js';
import { createLoadDatabase, type LoadDatabase } from './loadDatabase.js';

/** The activity under load: QuestionSet's example, four questions of three types (D-114). */
export const LOAD_PACKAGE = 'H5P.QuestionSet.h5p';
/** The most learners one bench serves. */
export const MAX_LEARNERS = 1000;

/** What k6 reads from the address file. */
export interface LoadAddresses {
  readonly toolUrl: string;
  readonly canvasOrigin: string;
  readonly contentId: string;
  /** One mock Canvas course-frame URL per learner; each GET starts a fresh LTI login. */
  readonly learners: readonly string[];
}

const say = (line: object): void => void process.stdout.write(`${JSON.stringify(line)}\n`);

/**
 * Reads the command line.
 * @param argv - Arguments after the script.
 * @returns The number of learners and the address file.
 * @throws Error for a missing file or a count outside 1…`MAX_LEARNERS`.
 */
export function benchArgs(argv: string[]): { learners: number; addresses: string } {
  const { values } = parseArgs({
    args: argv,
    options: { learners: { type: 'string' }, addresses: { type: 'string' } },
    strict: true,
  });
  const learners = Number(values.learners);
  if (!Number.isInteger(learners) || learners < 1 || learners > MAX_LEARNERS) {
    throw new Error(`--learners must be a whole number from 1 to ${MAX_LEARNERS}`);
  }
  if (!values.addresses) throw new Error('--addresses <file> is required');
  return { learners, addresses: values.addresses };
}

/**
 * Installs the real types and publishes the load activity.
 * @param tb - The running test bed.
 * @returns The activity's ID.
 */
async function publishLoadActivity(tb: AppTestbed): Promise<string> {
  const { packageImporter, libraryManager } = tb.runtime.editor;
  const audit = new TestLibraryAuditSink(tb.db);
  await seedLibraries(REAL_PACKAGES_DIR, new LibraryInstaller(packageImporter, audit, libraryManager));
  const owner = asAccountUser(testActor('author', { accountId: await tb.staffAccount() }));
  const { id } = await packageImporter.addPackageLibrariesAndContent(
    join(REAL_PACKAGES_DIR, LOAD_PACKAGE),
    owner,
  );
  await tb.db.h5PContent.update({
    where: { id: String(id) },
    data: { status: 'published', visibility: 'organisation' },
  });
  return String(id);
}

/**
 * One course-frame URL per learner, each a new student of the mock Canvas.
 * @param tb - The running test bed.
 * @param contentId - The activity the link opens.
 * @param count - How many learners.
 * @returns The URLs.
 */
export function learnerAddresses(tb: Pick<AppTestbed, 'mock'>, contentId: string, count: number): string[] {
  return Array.from({ length: count }, () => {
    const course = tb.mock.canvas.coursePageUrl({
      user: { sub: randomUUID(), roles: CANVAS_USERS.student.roles },
      course: { id: 'hvli-load-course', title: 'Lastprøve' },
      resourceLinkId: 'hvli-load-link',
      custom: { contentId },
      locale: 'nn',
    });
    return `${course}/frame`;
  });
}

async function main(): Promise<void> {
  const { learners, addresses } = benchArgs(process.argv.slice(2));
  if (!hasRealPackages())
    throw new Error('the real H5P packages are missing; run npm run h5p:fetch-libraries');
  let db: LoadDatabase | undefined;
  let tb: AppTestbed | undefined;
  const stop = async (): Promise<void> => {
    if (db) say({ rows: await db.storedRows() });
    await tb?.close();
    await db?.drop();
  };
  try {
    db = await createLoadDatabase(process.env.DATABASE_URL ?? '');
    // WHY: the test bed reads the environment when it opens, so the app writes only to the load database.
    process.env.DATABASE_URL = db.url;
    tb = await openAppTestbed([]);
    const contentId = await publishLoadActivity(tb);
    const file: LoadAddresses = {
      toolUrl: tb.toolUrl,
      canvasOrigin: tb.mock.canvas.origin,
      contentId,
      learners: learnerAddresses(tb, contentId, learners),
    };
    writeFileSync(addresses, `${JSON.stringify(file)}\n`, { mode: 0o600 });
    say({ ready: true, toolUrl: tb.toolUrl, learners });
  } catch (error) {
    await stop().catch(() => undefined);
    throw error;
  }
  let stopping = false;
  const onSignal = (): void => {
    if (stopping) return;
    stopping = true;
    stop().then(
      () => process.exit(0),
      (error: unknown) => {
        say({ error: error instanceof Error ? error.name : 'Error' });
        process.exit(1);
      },
    );
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
}

if (process.argv[1]?.endsWith('loadBench.ts')) {
  main().catch((error: unknown) => {
    // PRIVACY: our own messages name a rule or a file; nothing of a request is in them (DATA-009).
    say({ error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}
