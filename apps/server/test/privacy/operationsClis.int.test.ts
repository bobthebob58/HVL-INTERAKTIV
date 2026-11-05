/**
 * Integration test of the operations CLIs together, each run through the npm script its runbook names, on a database
 * that only they set up: `db:roles` creates the roles and runs the migrate step on a new database (DATA-010, D-109);
 * the data-subject CLI exports a learner's rows in both academic years (DATA-008, D-108); the yearly purge counts in a
 * dry run, then deletes the ended year as `hvli_app` and leaves the current year (DATA-003, D-107); and the
 * data-subject CLI erases what is left of the learner, while the other learner's current rows stay. Every run is
 * audited with counts and years only (DATA-007).
 *
 * Spec: DATA-010, DATA-003, DATA-008, DATA-007, DATA-009
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { DEFAULT_PURGE_RUN_DATE, isPurgeDue } from '../../src/privacy/purge/purgeCalendar.js';
import { deployFreshDatabase, type FreshDeployment } from '../support/freshDeployment.js';
import { sqlStateOf } from '../support/roleDatabase.js';
import { jsonLines, runServerCli } from '../support/serverCli.js';
import { describeWithServices } from '../support/services.js';
import { seedOperations, type OperationsSeed } from './support/operationsSeed.js';

describeWithServices(
  '[DATA-010][DATA-003][DATA-008] the operations CLIs on a freshly deployed database',
  () => {
    let deployed: FreshDeployment;
    let app: Database;
    let seed: OperationsSeed;
    const now = new Date();
    // WHY: from 1 to 30 August the CLI refuses a real purge (D-107); the test then shows the refusal instead.
    const due = isPurgeDue(DEFAULT_PURGE_RUN_DATE, now);
    const rowsOf = async (keys: readonly string[]) => {
      const where = { learnerKey: { in: [...keys] } };
      return [
        await deployed.admin.xapiStatement.count({ where }),
        await deployed.admin.h5PUserData.count({ where }),
        await deployed.admin.gradeSyncJob.count({ where }),
      ];
    };
    const dsr = (args: string[], subject: string) =>
      runServerCli('privacy:dsr', [...args, '--operator', seed.operatorFeideId], seed.env, subject);
    const kariSubject = () => JSON.stringify({ feideId: seed.kari.feideId });

    beforeAll(async () => {
      deployed = await deployFreshDatabase();
      app = createPrismaClient(deployed.urls.hvli_app);
      seed = await seedOperations(app, deployed.urls.hvli_app, now);
    }, 180_000);
    afterAll(async () => {
      await app?.$disconnect();
      await deployed?.close();
    });

    it('[DATA-010] db:roles sets up a new database with the migrate step; the app role writes rows but no schema', async () => {
      // Act
      const steps = deployed.steps.map((line) => JSON.parse(line) as unknown);
      const appDdl = await sqlStateOf(app.$executeRawUnsafe('CREATE TABLE "Intruder" (id int)'));
      const analytics = createPrismaClient(deployed.urls.hvli_analytics);
      const view = await sqlStateOf(analytics.$queryRawUnsafe('SELECT * FROM analytics.insight_snapshot'));
      await analytics.$disconnect();
      // Assert
      expect(steps).toEqual([
        { applied: '01-roles.sql', as: new URL(deployed.urls.admin).username },
        { applied: '00-views-down.sql', as: 'hvli_migrator' },
        { applied: '02-grants.sql', as: 'hvli_migrator' },
      ]);
      expect([appDdl, view]).toEqual(['42501', 'ok']);
    });

    it('[DATA-008] privacy:dsr export prints Kari’s rows of both years on standard output, and no identifier given', async () => {
      // Act
      const run = await dsr(['export'], kariSubject());
      const document = JSON.parse(run.stdout) as {
        request: { academicYearsSearched: number[] };
        xapiStatements: unknown[];
        h5pUserData: unknown[];
        gradeSyncJobs: unknown[];
      };
      // Assert
      expect(run.code).toBe(0);
      expect(document.request.academicYearsSearched).toEqual([seed.ended, seed.current]);
      expect([
        document.xapiStatements.length,
        document.h5pUserData.length,
        document.gradeSyncJobs.length,
      ]).toEqual([4, 2, 1]);
      expect(run.stdout + run.stderr).not.toContain(seed.kari.feideId);
      expect(run.stderr).not.toContain(seed.kari.keys.current);
    }, 60_000);

    it('[DATA-003] privacy:purge counts in a dry run, then deletes the ended year only, as hvli_app', async () => {
      // Act
      const dry = await runServerCli('privacy:purge', ['--dry-run'], seed.env);
      const before = await rowsOf([seed.kari.keys.ended, seed.ola.keys.ended]);
      const real = await runServerCli('privacy:purge', ['--execute'], seed.env);
      const ended = await rowsOf([seed.kari.keys.ended, seed.ola.keys.ended]);
      const current = await rowsOf([seed.kari.keys.current, seed.ola.keys.current]);
      const ola = await deployed.admin.user.count({ where: { id: seed.ola.userId } });
      const snapshots = await deployed.admin.insightSnapshot.count();
      // Assert: the dry run counted the ended year and deleted nothing
      const [plan] = jsonLines(dry.stdout) as {
        endedYear: number;
        dryRun: boolean;
        counts: Record<string, number>;
      }[];
      expect(dry.code).toBe(0);
      expect(plan).toMatchObject({ endedYear: seed.ended, years: [seed.ended], dryRun: true });
      expect(plan?.counts).toMatchObject({
        xapiStatements: 4,
        h5pUserData: 2,
        gradeSyncJobs: 1,
        learnerIdentities: 1,
        learnerUsers: 1,
      });
      expect(before).toEqual([4, 2, 1]);
      expect(current).toEqual([4, 2, 0]);
      if (!due) {
        expect([real.code, ended, ola]).toEqual([1, [4, 2, 1], 1]);
        expect(real.stdout).toContain('refused: the purge of academic year');
        return;
      }
      // Assert: the real run deleted the ended year and Ola's old account, wrote the snapshots, and names the secret
      const [done, secret] = jsonLines(real.stdout) as { counts: Record<string, number> }[];
      expect(real.code).toBe(0);
      expect(done?.counts).toEqual(plan?.counts);
      expect([ended, ola, snapshots]).toEqual([[0, 0, 0], 0, plan?.counts.snapshots]);
      expect(secret).toEqual({ removePseudonymSecretsOfYears: [seed.ended] });
    }, 120_000);

    it('[DATA-008] privacy:dsr erase counts first, then with --confirm deletes Kari’s rows and account; Ola’s stay', async () => {
      // Act
      const dry = await dsr(['erase'], kariSubject());
      const kariBefore = await rowsOf([seed.kari.keys.current]);
      const confirmed = await dsr(['erase', '--confirm'], kariSubject());
      const kariAfter = await rowsOf([seed.kari.keys.ended, seed.kari.keys.current]);
      const kariAccount = await deployed.admin.user.count({ where: { id: seed.kari.userId } });
      const olaCurrent = await rowsOf([seed.ola.keys.current]);
      // Assert
      expect([dry.code, confirmed.code]).toEqual([0, 0]);
      expect(kariBefore).toEqual([2, 1, 0]);
      expect(kariAfter).toEqual([0, 0, 0]);
      expect(kariAccount).toBe(0);
      expect(olaCurrent).toEqual([2, 1, 0]);
      expect(dry.stdout + confirmed.stdout).not.toContain(seed.kari.feideId);
    }, 60_000);

    it('[DATA-007] every run is audited with counts, years and fixed words, never a learner key or identifier', async () => {
      // Act
      const events = await deployed.admin.auditEvent.findMany({
        where: { action: { in: ['purge.run', 'dataSubject.export', 'dataSubject.erase'] } },
        orderBy: { at: 'asc' },
      });
      const text = JSON.stringify(events);
      // Assert
      expect(events.map((event) => event.action)).toEqual([
        'dataSubject.export',
        'purge.run',
        ...(due ? ['purge.run'] : []),
        'dataSubject.erase',
        'dataSubject.erase',
      ]);
      for (const secret of [seed.kari.feideId, seed.ola.feideId, ...Object.values(seed.kari.keys)]) {
        expect(text).not.toContain(secret);
      }
    });
  },
);
