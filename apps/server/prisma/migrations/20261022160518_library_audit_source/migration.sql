/*
  Warnings:

  - Added the required column `source` to the `LibraryAuditEvent` table without a default value. This is not possible if the table is not empty.

*/
-- WHY: nothing wrote LibraryAuditEvent before Session 2 (D-041), so the new NOT NULL column needs no default.

-- CreateEnum
CREATE TYPE "LibraryChangeSource" AS ENUM ('seed', 'upload');

-- AlterTable
ALTER TABLE "LibraryAuditEvent" ADD COLUMN     "source" "LibraryChangeSource" NOT NULL,
ALTER COLUMN "actorUserId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "H5PUserData_contentId_learnerKey_contextId_idx" ON "H5PUserData"("contentId", "learnerKey", "contextId");

-- CreateIndex
CREATE INDEX "LibraryAuditEvent_machineName_idx" ON "LibraryAuditEvent"("machineName");
