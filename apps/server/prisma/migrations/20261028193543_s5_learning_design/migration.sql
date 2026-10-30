-- S5 learning design: learner purpose and pattern (PED-030, PED-032, D-087), the course label of a placement
-- (D-087), the content bank listing (PROD-007, D-091), the source author of a copy (PROD-007, D-092) and co-author
-- search eligibility (PROD-007, D-090). Every new column is nullable, so existing rows need no default.
-- WHY: no code set `sourceContentId` before S5, so no existing copy needs `sourceAuthorUserId` filled in.

-- AlterTable
ALTER TABLE "H5PContent" ADD COLUMN     "bankListedAt" TIMESTAMP(3),
ADD COLUMN     "sourceAuthorUserId" UUID;

-- AlterTable
ALTER TABLE "LearningDesignMetadata" ADD COLUMN     "learnerPurpose" VARCHAR(200),
ADD COLUMN     "patternId" VARCHAR(64);

-- AlterTable
ALTER TABLE "LtiPlacement" ADD COLUMN     "contextLabel" VARCHAR(255);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coAuthorSearchableAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "H5PContent_bankListedAt_idx" ON "H5PContent"("bankListedAt");

-- CreateIndex
CREATE INDEX "User_coAuthorSearchableAt_idx" ON "User"("coAuthorSearchableAt");

-- AddForeignKey
ALTER TABLE "H5PContent" ADD CONSTRAINT "H5PContent_sourceAuthorUserId_fkey" FOREIGN KEY ("sourceAuthorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
