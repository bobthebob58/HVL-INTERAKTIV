-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('private', 'organisation', 'feide');

-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('coauthor');

-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('staff', 'learner');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('feide', 'lti');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('forarbeid', 'underveis', 'etterarbeid');

-- CreateEnum
CREATE TYPE "OutcomeCategory" AS ENUM ('kunnskap', 'ferdigheiter', 'generell_kompetanse');

-- CreateEnum
CREATE TYPE "AttemptPolicy" AS ENUM ('best', 'latest', 'mastery');

-- CreateEnum
CREATE TYPE "GradeSyncStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "XapiStatement" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "subContentId" TEXT,
    "contentVersion" INTEGER NOT NULL,
    "contextId" TEXT,
    "learnerKey" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "scoreRaw" DOUBLE PRECISION,
    "scoreMax" DOUBLE PRECISION,
    "scaled" DOUBLE PRECISION,
    "success" BOOLEAN,
    "completion" BOOLEAN,
    "response" VARCHAR(1000),
    "durationMs" INTEGER,
    "attemptId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XapiStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightSnapshot" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "contextId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "k" INTEGER NOT NULL,
    "aggregates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "H5PContent" (
    "id" UUID NOT NULL,
    "mainLibrary" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'private',
    "ownerUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceContentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "H5PContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "H5PContentFile" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "H5PContentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCollaborator" (
    "contentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'coauthor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCollaborator_pkey" PRIMARY KEY ("contentId","userId")
);

-- CreateTable
CREATE TABLE "H5PUserData" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "subContentId" TEXT NOT NULL DEFAULT '0',
    "dataType" TEXT NOT NULL,
    "learnerKey" TEXT NOT NULL,
    "contextId" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL,
    "preload" BOOLEAN NOT NULL DEFAULT false,
    "invalidate" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "H5PUserData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryAuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "machineName" TEXT NOT NULL,
    "fromVersion" TEXT,
    "toVersion" TEXT,
    "sha256" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "kind" "UserKind" NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "platformId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAuditEvent" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "event" TEXT NOT NULL,
    "ipHash" TEXT,

    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningDesignMetadata" (
    "contentId" UUID NOT NULL,
    "phase" "Phase",
    "courseCode" TEXT,
    "rationale" VARCHAR(1000),
    "estimatedStudentMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningDesignMetadata_pkey" PRIMARY KEY ("contentId")
);

-- CreateTable
CREATE TABLE "LearningOutcome" (
    "id" UUID NOT NULL,
    "metadataContentId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "category" "OutcomeCategory" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationAcknowledgement" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "ruleId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiPlatform" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authenticationEndpoint" TEXT NOT NULL,
    "accessTokenEndpoint" TEXT NOT NULL,
    "authorizationServer" TEXT,
    "idTokenValidationMethod" TEXT NOT NULL,
    "idTokenValidationKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publicKey" TEXT NOT NULL,
    "privateKeyEncrypted" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiAccessToken" (
    "id" UUID NOT NULL,
    "platformUrl" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "tokenEncrypted" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiIdToken" (
    "id" TEXT NOT NULL,
    "claims" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiIdToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiNonce" (
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LtiNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "LtiPlacement" (
    "id" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "contextId" TEXT NOT NULL,
    "resourceLinkId" TEXT NOT NULL,
    "contentId" UUID NOT NULL,
    "lineItemUrl" TEXT,
    "attemptPolicy" "AttemptPolicy" NOT NULL DEFAULT 'best',
    "masteryThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeSyncJob" (
    "id" UUID NOT NULL,
    "placementId" UUID NOT NULL,
    "learnerKey" TEXT NOT NULL,
    "ltiSubEncrypted" BYTEA,
    "scoreGiven" DOUBLE PRECISION NOT NULL,
    "status" "GradeSyncStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "succeededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XapiStatement_contentId_contextId_timestamp_idx" ON "XapiStatement"("contentId", "contextId", "timestamp");

-- CreateIndex
CREATE INDEX "XapiStatement_learnerKey_idx" ON "XapiStatement"("learnerKey");

-- CreateIndex
CREATE INDEX "XapiStatement_timestamp_idx" ON "XapiStatement"("timestamp");

-- CreateIndex
CREATE INDEX "InsightSnapshot_contentId_contextId_idx" ON "InsightSnapshot"("contentId", "contextId");

-- CreateIndex
CREATE INDEX "AuditEvent_at_idx" ON "AuditEvent"("at");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "H5PContent_ownerUserId_idx" ON "H5PContent"("ownerUserId");

-- CreateIndex
CREATE INDEX "H5PContent_mainLibrary_idx" ON "H5PContent"("mainLibrary");

-- CreateIndex
CREATE UNIQUE INDEX "H5PContentFile_s3Key_key" ON "H5PContentFile"("s3Key");

-- CreateIndex
CREATE UNIQUE INDEX "H5PContentFile_contentId_filename_key" ON "H5PContentFile"("contentId", "filename");

-- CreateIndex
CREATE INDEX "H5PUserData_learnerKey_idx" ON "H5PUserData"("learnerKey");

-- CreateIndex
CREATE INDEX "H5PUserData_updatedAt_idx" ON "H5PUserData"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "H5PUserData_contentId_subContentId_dataType_learnerKey_cont_key" ON "H5PUserData"("contentId", "subContentId", "dataType", "learnerKey", "contextId");

-- CreateIndex
CREATE INDEX "LibraryAuditEvent_at_idx" ON "LibraryAuditEvent"("at");

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_subjectHash_key" ON "Identity"("provider", "subjectHash");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_at_idx" ON "AuthAuditEvent"("at");

-- CreateIndex
CREATE INDEX "LearningOutcome_metadataContentId_idx" ON "LearningOutcome"("metadataContentId");

-- CreateIndex
CREATE INDEX "ValidationAcknowledgement_contentId_idx" ON "ValidationAcknowledgement"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "LtiPlatform_url_clientId_key" ON "LtiPlatform"("url", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LtiAccessToken_platformUrl_clientId_scopes_key" ON "LtiAccessToken"("platformUrl", "clientId", "scopes");

-- CreateIndex
CREATE INDEX "LtiIdToken_expiresAt_idx" ON "LtiIdToken"("expiresAt");

-- CreateIndex
CREATE INDEX "LtiNonce_createdAt_idx" ON "LtiNonce"("createdAt");

-- CreateIndex
CREATE INDEX "LtiPlacement_contentId_idx" ON "LtiPlacement"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "LtiPlacement_platformId_contextId_resourceLinkId_key" ON "LtiPlacement"("platformId", "contextId", "resourceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeSyncJob_idempotencyKey_key" ON "GradeSyncJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GradeSyncJob_status_idx" ON "GradeSyncJob"("status");

-- CreateIndex
CREATE INDEX "GradeSyncJob_succeededAt_idx" ON "GradeSyncJob"("succeededAt");

-- CreateIndex
CREATE INDEX "GradeSyncJob_learnerKey_idx" ON "GradeSyncJob"("learnerKey");

-- AddForeignKey
ALTER TABLE "XapiStatement" ADD CONSTRAINT "XapiStatement_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightSnapshot" ADD CONSTRAINT "InsightSnapshot_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5PContent" ADD CONSTRAINT "H5PContent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5PContent" ADD CONSTRAINT "H5PContent_sourceContentId_fkey" FOREIGN KEY ("sourceContentId") REFERENCES "H5PContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5PContentFile" ADD CONSTRAINT "H5PContentFile_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCollaborator" ADD CONSTRAINT "ContentCollaborator_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCollaborator" ADD CONSTRAINT "ContentCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "H5PUserData" ADD CONSTRAINT "H5PUserData_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningDesignMetadata" ADD CONSTRAINT "LearningDesignMetadata_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_metadataContentId_fkey" FOREIGN KEY ("metadataContentId") REFERENCES "LearningDesignMetadata"("contentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationAcknowledgement" ADD CONSTRAINT "ValidationAcknowledgement_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationAcknowledgement" ADD CONSTRAINT "ValidationAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiPlacement" ADD CONSTRAINT "LtiPlacement_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiPlacement" ADD CONSTRAINT "LtiPlacement_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "H5PContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSyncJob" ADD CONSTRAINT "GradeSyncJob_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "LtiPlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PRIVACY (DATA-002): learner rows never hold a name or an e-mail address. Prisma cannot express
-- CHECK constraints, so this one is added by hand; schema.int.test.ts proves the database enforces it.
ALTER TABLE "User" ADD CONSTRAINT "User_learner_has_no_personal_data"
  CHECK ("kind" = 'staff' OR ("displayName" IS NULL AND "email" IS NULL));
