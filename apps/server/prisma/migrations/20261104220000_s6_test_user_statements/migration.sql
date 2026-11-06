-- S6 step 5, the step-4 privacy review: a statement of Canvas's Student View test student (the LTI `TestUser` role)
-- is stored with `testUser = true`, so the grade worker still sends its score and a teacher can test the passback,
-- while insight and the mappe leave it out of every aggregate and k count (D-102's amendment of 2026-11-04).
--
-- WHY: rows stored before this migration keep the default (false): no launch was flagged before, and S6 is not
-- deployed, so a test student's rows can exist only in development databases.

-- AlterTable
ALTER TABLE "XapiStatement" ADD COLUMN     "testUser" BOOLEAN NOT NULL DEFAULT false;
