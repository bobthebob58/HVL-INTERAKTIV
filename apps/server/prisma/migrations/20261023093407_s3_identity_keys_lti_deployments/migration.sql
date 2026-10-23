/*
  Warnings:

  - Added the required column `subjectKeyId` to the `Identity` table without a default value. This is not possible if the table is not empty.

  WHY: no login existed before Session 3, so `Identity` is empty in every installation and needs no default.

*/
-- AlterTable
ALTER TABLE "AuthAuditEvent" ADD COLUMN     "ipKeyId" TEXT,
ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "Identity" ADD COLUMN     "subjectKeyId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "LtiDeployment" (
    "id" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LtiDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LtiDeployment_platformId_deploymentId_key" ON "LtiDeployment"("platformId", "deploymentId");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_actorUserId_idx" ON "AuthAuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "ContentCollaborator_userId_idx" ON "ContentCollaborator"("userId");

-- AddForeignKey
ALTER TABLE "LtiDeployment" ADD CONSTRAINT "LtiDeployment_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
