-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "exam_config" (
    "id" TEXT NOT NULL,
    "pathway" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "dataProvenance" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "itemCount" INTEGER NOT NULL,
    "twkCount" INTEGER NOT NULL,
    "tiuCount" INTEGER NOT NULL,
    "tkpCount" INTEGER NOT NULL,
    "twkWeight" INTEGER NOT NULL,
    "tiuWeight" INTEGER NOT NULL,
    "tkpWeightMin" INTEGER NOT NULL,
    "tkpWeightMax" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "notice" TEXT NOT NULL,
    "scoringVersion" INTEGER NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "regulatoryBasisHash" TEXT NOT NULL,

    CONSTRAINT "exam_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "basis_ref" (
    "id" TEXT NOT NULL,
    "examConfigId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "pathway" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "accessedAt" TEXT NOT NULL,

    CONSTRAINT "basis_ref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thresholds" (
    "examConfigId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "twk" INTEGER,
    "tiu" INTEGER,
    "tkp" INTEGER,
    "total" INTEGER,
    "sourceJson" TEXT NOT NULL,

    CONSTRAINT "thresholds_pkey" PRIMARY KEY ("examConfigId")
);

-- CreateTable
CREATE TABLE "provisional_approval" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "scoringVersion" INTEGER NOT NULL,
    "regulatoryBasisHash" TEXT NOT NULL,
    "approvedByUserAt" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "acknowledgedWarningsJson" TEXT NOT NULL,

    CONSTRAINT "provisional_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "test" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "stimulus" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "answerKeyJson" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficultyAiInitial" TEXT NOT NULL,
    "empiricalDifficultyJson" TEXT,
    "lifecycle" TEXT NOT NULL,
    "dynamicEligible" INTEGER NOT NULL,
    "answerKeyValidatedAt" TEXT,
    "quarantinedReason" TEXT,
    "provenanceJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_version" (
    "questionId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "answerKeyJson" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "question_version_pkey" PRIMARY KEY ("questionId","contentVersion")
);

-- CreateTable
CREATE TABLE "question_report" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "reportedAt" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "resolution" TEXT,
    "resolvedAt" TEXT,

    CONSTRAINT "question_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_record" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "layersJson" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "validatedAt" TEXT NOT NULL,

    CONSTRAINT "validation_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_review" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "reviewedAt" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "editsJson" TEXT,
    "answerKeyValidatedBy" TEXT,
    "answerKeyValidatedAt" TEXT,
    "notes" TEXT,

    CONSTRAINT "question_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "test" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "tier" TEXT NOT NULL,

    CONSTRAINT "competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "examConfigId" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "scoringVersion" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "rosterJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activeMs" INTEGER NOT NULL,
    "runningSince" TEXT,
    "durationMs" INTEGER,
    "startedAt" TEXT NOT NULL,
    "submittedAt" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_snapshot" (
    "sessionId" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "answerKeysJson" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "thresholdsJson" TEXT NOT NULL,
    "approvalJson" TEXT,
    "packageBindingJson" TEXT NOT NULL,
    "timingJson" TEXT NOT NULL,
    "rosterJson" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL,

    CONSTRAINT "session_snapshot_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "session_deletion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "startedAt" TEXT NOT NULL,
    "finishedAt" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "deletedAt" TEXT NOT NULL,
    "deletionKind" TEXT NOT NULL,

    CONSTRAINT "session_deletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_sheet" (
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "answerTimestampMs" INTEGER NOT NULL,
    "elapsedActiveMs" INTEGER NOT NULL,
    "flagged" INTEGER NOT NULL,

    CONSTRAINT "answer_sheet_pkey" PRIMARY KEY ("sessionId","questionId")
);

-- CreateTable
CREATE TABLE "score_result" (
    "sessionId" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "totalJson" TEXT NOT NULL,
    "byTestJson" TEXT NOT NULL,
    "byCompetencyJson" TEXT NOT NULL,
    "byQuestionJson" TEXT NOT NULL,
    "thresholdsJson" TEXT NOT NULL,
    "verdictJson" TEXT,
    "approvalJson" TEXT,
    "blockedErrorCode" TEXT,

    CONSTRAINT "score_result_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "provider" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "headersJson" TEXT NOT NULL,
    "extraParamsJson" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL,
    "capabilityFlagsJson" TEXT NOT NULL,
    "testedAt" TEXT,
    "modelCacheJson" TEXT,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_ref" (
    "providerId" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "hasKey" INTEGER NOT NULL,
    "storeEntryName" TEXT NOT NULL,
    "storeKind" TEXT NOT NULL,

    CONSTRAINT "secret_ref_pkey" PRIMARY KEY ("providerId")
);

-- CreateTable
CREATE TABLE "ai_routing" (
    "id" TEXT NOT NULL,
    "defaultProviderId" TEXT,
    "defaultModel" TEXT,
    "perTaskJson" TEXT NOT NULL,

    CONSTRAINT "ai_routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_job" (
    "id" TEXT NOT NULL,
    "competencyIdsJson" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "taskModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "producedCount" INTEGER NOT NULL,
    "quarantinedCount" INTEGER NOT NULL,
    "partial" INTEGER NOT NULL,

    CONSTRAINT "generation_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_batch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureCategory" TEXT,
    "rawResponseRef" TEXT,
    "draftQuestionIds" TEXT NOT NULL,

    CONSTRAINT "generation_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "linkJson" TEXT,
    "entityId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "readAt" TEXT,
    "dismissedAt" TEXT,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_record" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "finishedAt" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filePath" TEXT,
    "fileSizeBytes" INTEGER,
    "failureReason" TEXT,
    "schemaVersion" INTEGER NOT NULL,

    CONSTRAINT "backup_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "retiredAt" TEXT,

    CONSTRAINT "package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_version" (
    "packageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definitionJson" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "package_version_pkey" PRIMARY KEY ("packageId","version")
);

-- CreateTable
CREATE TABLE "observed_question_history" (
    "questionId" TEXT NOT NULL,
    "lastAnsweredAt" TEXT,
    "answerCount" INTEGER NOT NULL,

    CONSTRAINT "observed_question_history_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "material" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provenanceJson" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourcesJson" TEXT NOT NULL,
    "approvalVersion" INTEGER,
    "approvedAt" TEXT,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_version" (
    "materialId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bodyJson" TEXT NOT NULL,

    CONSTRAINT "material_version_pkey" PRIMARY KEY ("materialId","version")
);

-- CreateIndex
CREATE INDEX "provisional_approval_configId_configVersion_idx" ON "provisional_approval"("configId", "configVersion");

-- CreateIndex
CREATE UNIQUE INDEX "notification_type_entityId_key" ON "notification"("type", "entityId");

-- AddForeignKey
ALTER TABLE "basis_ref" ADD CONSTRAINT "basis_ref_examConfigId_fkey" FOREIGN KEY ("examConfigId") REFERENCES "exam_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thresholds" ADD CONSTRAINT "thresholds_examConfigId_fkey" FOREIGN KEY ("examConfigId") REFERENCES "exam_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisional_approval" ADD CONSTRAINT "provisional_approval_configId_fkey" FOREIGN KEY ("configId") REFERENCES "exam_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_version" ADD CONSTRAINT "question_version_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_report" ADD CONSTRAINT "question_report_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_record" ADD CONSTRAINT "validation_record_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_review" ADD CONSTRAINT "question_review_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_examConfigId_fkey" FOREIGN KEY ("examConfigId") REFERENCES "exam_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_snapshot" ADD CONSTRAINT "session_snapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_sheet" ADD CONSTRAINT "answer_sheet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_sheet" ADD CONSTRAINT "answer_sheet_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_result" ADD CONSTRAINT "score_result_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_ref" ADD CONSTRAINT "secret_ref_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_batch" ADD CONSTRAINT "generation_batch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "generation_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_version" ADD CONSTRAINT "package_version_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_version" ADD CONSTRAINT "material_version_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

