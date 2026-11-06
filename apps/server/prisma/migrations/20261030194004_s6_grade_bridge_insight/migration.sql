-- S6 grade bridge and insight: the `orphaned` grade-sync status and the worker's columns (LTI-012, D-104), the
-- attempt and result order of a grade job (D-115), the academic year the yearly purge deletes by (DATA-003, D-107),
-- the content version of an insight snapshot (PROD-013, D-107), and the platform-scoped course context (D-103).
--
-- WHY: nothing wrote `GradeSyncJob` before S6, so its new required columns (`attemptId`, `resultAt`) need no default,
-- as in the S3 migration. No server code wrote `InsightSnapshot` either, but an S5 test does
-- (ContentDuplicatorData.int.test.ts), so a development database can hold a row: it gets its activity's version.
-- WHY: `academicYear` is required with a database default (the academic year of the write, Oslo time), so no row can
-- escape the purge. PostgreSQL fills existing rows with today's year; the UPDATEs below set each existing row's year
-- from its own time instead. D-107 wants the year of the secret behind the row's `learnerKey`: an LTI request derives
-- its key when it is made, so there the default is that year, but a portal session keeps the key it got at login for
-- up to 12 hours (D-057), so the writers of portal rows must set the year themselves.

-- AlterEnum
ALTER TYPE "GradeSyncStatus" ADD VALUE 'orphaned';

-- DropIndex: replaced by `GradeSyncJob_status_nextAttemptAt_idx`, `GradeSyncJob_terminalAt_idx` and
-- `XapiStatement_learnerKey_contentId_timestamp_idx`, which serve the same queries.
DROP INDEX "GradeSyncJob_status_idx";

-- DropIndex
DROP INDEX "GradeSyncJob_succeededAt_idx";

-- DropIndex
DROP INDEX "XapiStatement_learnerKey_idx";

-- AlterTable
ALTER TABLE "GradeSyncJob" ADD COLUMN     "academicYear" INTEGER NOT NULL DEFAULT (EXTRACT(year FROM ((now() AT TIME ZONE 'Europe/Oslo'::text) - '7 mons'::interval)))::integer,
ADD COLUMN     "attemptId" TEXT NOT NULL,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resultAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "terminalAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "H5PUserData" ADD COLUMN     "academicYear" INTEGER NOT NULL DEFAULT (EXTRACT(year FROM ((now() AT TIME ZONE 'Europe/Oslo'::text) - '7 mons'::interval)))::integer;

-- AlterTable: added nullable, filled from the activity (a snapshot's `contentId` always has one), then required.
ALTER TABLE "InsightSnapshot" ADD COLUMN     "contentVersion" INTEGER;
UPDATE "InsightSnapshot" AS s SET "contentVersion" = c."version" FROM "H5PContent" AS c WHERE c."id" = s."contentId";
ALTER TABLE "InsightSnapshot" ALTER COLUMN "contentVersion" SET NOT NULL;

-- AlterTable
ALTER TABLE "XapiStatement" ADD COLUMN     "academicYear" INTEGER NOT NULL DEFAULT (EXTRACT(year FROM ((now() AT TIME ZONE 'Europe/Oslo'::text) - '7 mons'::interval)))::integer;

-- PRIVACY (DATA-003, D-107): existing rows get the academic year of their own time in Oslo (1 August starts a
-- year, so the year is that of the date seven months earlier); Prisma stores timestamps as UTC without a zone.
UPDATE "H5PUserData" SET "academicYear" =
  (EXTRACT(year FROM ((("updatedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Oslo') - '7 mons'::interval)))::integer;
UPDATE "XapiStatement" SET "academicYear" =
  (EXTRACT(year FROM ((("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Oslo') - '7 mons'::interval)))::integer;

-- PRIVACY (D-103): a stored course context is `<LtiPlatform.id>:<context ID>`, never a bare Canvas ID that could merge
-- courses from two Canvas instances. Prisma cannot express CHECK constraints, so these are added by hand;
-- s6Schema.int.test.ts proves the database enforces them.
ALTER TABLE "XapiStatement" ADD CONSTRAINT "XapiStatement_contextId_platform_scoped"
  CHECK ("contextId" IS NULL OR "contextId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.');
ALTER TABLE "InsightSnapshot" ADD CONSTRAINT "InsightSnapshot_contextId_platform_scoped"
  CHECK ("contextId" IS NULL OR "contextId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.');

-- CreateIndex
CREATE INDEX "GradeSyncJob_status_nextAttemptAt_idx" ON "GradeSyncJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "GradeSyncJob_placementId_learnerKey_idx" ON "GradeSyncJob"("placementId", "learnerKey");

-- CreateIndex
CREATE INDEX "GradeSyncJob_placementId_status_idx" ON "GradeSyncJob"("placementId", "status");

-- CreateIndex
CREATE INDEX "GradeSyncJob_terminalAt_idx" ON "GradeSyncJob"("terminalAt");

-- CreateIndex
CREATE INDEX "GradeSyncJob_academicYear_idx" ON "GradeSyncJob"("academicYear");

-- CreateIndex
CREATE INDEX "H5PUserData_academicYear_idx" ON "H5PUserData"("academicYear");

-- CreateIndex
CREATE INDEX "XapiStatement_learnerKey_contentId_timestamp_idx" ON "XapiStatement"("learnerKey", "contentId", "timestamp");

-- CreateIndex
CREATE INDEX "XapiStatement_academicYear_idx" ON "XapiStatement"("academicYear");
