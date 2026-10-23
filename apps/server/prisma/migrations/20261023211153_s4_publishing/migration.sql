-- S4 publishing (PROD-003, D-074) and notice dismissals (PROD-011, D-075).

-- AlterTable
ALTER TABLE "H5PContent" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- WHY: before S4 an activity could be published only outside the publish flow (D-066); its last change is the
-- best known publication time, so `publishedAt` is set for every activity that is already published.
UPDATE "H5PContent" SET "publishedAt" = "updatedAt" WHERE "status" = 'published';

-- CreateTable
CREATE TABLE "NoticeDismissal" (
    "userId" UUID NOT NULL,
    "noticeId" TEXT NOT NULL,
    "noticeVersion" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeDismissal_pkey" PRIMARY KEY ("userId","noticeId")
);

-- AddForeignKey
ALTER TABLE "NoticeDismissal" ADD CONSTRAINT "NoticeDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
