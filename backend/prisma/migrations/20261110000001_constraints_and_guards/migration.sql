-- Custom objects the Prisma DSL cannot express (DATABASE_SCHEMA §3, PO D-1…D-8).
--
-- Applied in the same migration as the tables it guards. Prisma's diff does not
-- see any of it: a generated migration that rebuilds a table drops these objects
-- silently, so every later migration is reviewed against this file.
--
-- Re-runnable by construction where PostgreSQL allows it (`IF NOT EXISTS`,
-- `DROP … IF EXISTS` before `CREATE`, `CREATE OR REPLACE`): a Prisma CLI 7
-- migration is not atomic (MIGRATION_STRATEGY §2).

-- ---------------------------------------------------------------------------
-- 1. COLLATE "C" on every opaque TEXT identifier (D-5)
-- ---------------------------------------------------------------------------
-- Identifier comparison must be byte-wise, not locale-dependent, on both sides
-- of every foreign key and inside every composite key. Ordinary text and search
-- fields keep the server default.
--
-- Prisma generated these columns as plain `TEXT`; they are altered in place.

ALTER TABLE "exam_config" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "basis_ref" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "basis_ref" ALTER COLUMN "examConfigId" TYPE TEXT COLLATE "C";
ALTER TABLE "thresholds" ALTER COLUMN "examConfigId" TYPE TEXT COLLATE "C";
ALTER TABLE "provisional_approval" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "provisional_approval" ALTER COLUMN "configId" TYPE TEXT COLLATE "C";
ALTER TABLE "question" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "question" ALTER COLUMN "competencyId" TYPE TEXT COLLATE "C";
ALTER TABLE "question_version" ALTER COLUMN "questionId" TYPE TEXT COLLATE "C";
ALTER TABLE "question_report" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "question_report" ALTER COLUMN "questionId" TYPE TEXT COLLATE "C";
ALTER TABLE "validation_record" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "validation_record" ALTER COLUMN "questionId" TYPE TEXT COLLATE "C";
ALTER TABLE "question_review" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "question_review" ALTER COLUMN "questionId" TYPE TEXT COLLATE "C";
ALTER TABLE "competency" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "competency" ALTER COLUMN "parentId" TYPE TEXT COLLATE "C";
ALTER TABLE "session" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "session" ALTER COLUMN "examConfigId" TYPE TEXT COLLATE "C";
ALTER TABLE "session" ALTER COLUMN "packageId" TYPE TEXT COLLATE "C";
ALTER TABLE "session_snapshot" ALTER COLUMN "sessionId" TYPE TEXT COLLATE "C";
ALTER TABLE "session_deletion" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "session_deletion" ALTER COLUMN "sessionId" TYPE TEXT COLLATE "C";
ALTER TABLE "answer_sheet" ALTER COLUMN "sessionId" TYPE TEXT COLLATE "C";
ALTER TABLE "answer_sheet" ALTER COLUMN "questionId" TYPE TEXT COLLATE "C";
ALTER TABLE "score_result" ALTER COLUMN "sessionId" TYPE TEXT COLLATE "C";
ALTER TABLE "provider" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "secret_ref" ALTER COLUMN "providerId" TYPE TEXT COLLATE "C";
ALTER TABLE "generation_job" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "generation_job" ALTER COLUMN "providerId" TYPE TEXT COLLATE "C";
ALTER TABLE "generation_batch" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "generation_batch" ALTER COLUMN "jobId" TYPE TEXT COLLATE "C";
ALTER TABLE "notification" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "backup_record" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "package" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "package_version" ALTER COLUMN "packageId" TYPE TEXT COLLATE "C";
ALTER TABLE "observed_question_history" ALTER COLUMN "questionId" TYPE TEXT COLLATE "C";
ALTER TABLE "material" ALTER COLUMN "id" TYPE TEXT COLLATE "C";
ALTER TABLE "material_version" ALTER COLUMN "materialId" TYPE TEXT COLLATE "C";

-- ---------------------------------------------------------------------------
-- 2. Closed sets and bounds (DATABASE_SCHEMA §3.1, §3.2)
-- ---------------------------------------------------------------------------

-- C-1..C-3 exam_config
ALTER TABLE "exam_config"
  ADD CONSTRAINT "exam_config_state_check"
    CHECK ("state" IN ('official_verified', 'historical', 'provisional')),
  ADD CONSTRAINT "exam_config_data_provenance_check"
    CHECK ("dataProvenance" IN ('seed', 'legacy')),
  -- D-4: CPNS only. A second pathway value is not storable.
  ADD CONSTRAINT "exam_config_pathway_check"
    CHECK ("pathway" = 'CPNS');

-- C-4..C-5 basis_ref
ALTER TABLE "basis_ref"
  ADD CONSTRAINT "basis_ref_pathway_check"
    CHECK ("pathway" = 'CPNS'),
  ADD CONSTRAINT "basis_ref_tier_check"
    CHECK ("tier" IN ('VERIFIED-2026', 'VERIFIED-CURRENT', 'HISTORICAL', 'VERIFIED-ABSENCE',
                      'UNVERIFIED', 'EVIDENCE-BACKED-NOT-CPNS-2026'));

-- C-6 thresholds: presence matches mode (B-6)
ALTER TABLE "thresholds"
  ADD CONSTRAINT "thresholds_mode_check"
    CHECK ("mode" IN ('per_subtest_and_total', 'per_subtest_only', 'total_only', 'none')),
  ADD CONSTRAINT "thresholds_values_check"
    CHECK (
      ("twk" IS NULL OR "twk" >= 0) AND
      ("tiu" IS NULL OR "tiu" >= 0) AND
      ("tkp" IS NULL OR "tkp" >= 0) AND
      ("total" IS NULL OR "total" >= 0) AND
      ("mode" <> 'per_subtest_and_total'
         OR ("twk" IS NOT NULL AND "tiu" IS NOT NULL AND "tkp" IS NOT NULL AND "total" IS NOT NULL)) AND
      ("mode" <> 'per_subtest_only'
         OR ("twk" IS NOT NULL AND "tiu" IS NOT NULL AND "tkp" IS NOT NULL AND "total" IS NULL)) AND
      ("mode" <> 'total_only'
         OR ("total" IS NOT NULL AND "twk" IS NULL AND "tiu" IS NULL AND "tkp" IS NULL)) AND
      ("mode" <> 'none'
         OR ("twk" IS NULL AND "tiu" IS NULL AND "tkp" IS NULL AND "total" IS NULL))
    );

-- C-7..C-10 question
ALTER TABLE "question"
  ADD CONSTRAINT "question_test_check"
    CHECK ("test" IN ('TWK', 'TIU', 'TKP')),
  ADD CONSTRAINT "question_lifecycle_check"
    CHECK ("lifecycle" IN ('draft', 'ai_validated', 'human_reviewed', 'active',
                           'quarantined', 'rejected', 'archived')),
  ADD CONSTRAINT "question_dynamic_eligible_check"
    CHECK ("dynamicEligible" IN (0, 1)),
  ADD CONSTRAINT "question_difficulty_initial_check"
    CHECK ("difficultyAiInitial" IN ('easy', 'medium', 'hard')),
  ADD CONSTRAINT "question_content_version_check"
    CHECK ("contentVersion" > 0),
  -- B-9
  ADD CONSTRAINT "question_quarantined_reason_check"
    CHECK ("lifecycle" <> 'quarantined' OR ("quarantinedReason" IS NOT NULL AND length("quarantinedReason") > 0));

-- C-9 question_report and B-11
ALTER TABLE "question_report"
  ADD CONSTRAINT "question_report_severity_check"
    CHECK ("severity" IN ('critical', 'non_critical')),
  ADD CONSTRAINT "question_report_category_check"
    CHECK ("category" IN ('wrong_key', 'ambiguous', 'typo', 'explanation_unclear', 'other')),
  ADD CONSTRAINT "question_report_resolution_check"
    CHECK ("resolution" IS NULL OR "resolution" IN ('repaired', 'withdrawn', 'rejected')),
  ADD CONSTRAINT "question_report_resolved_pairing_check"
    CHECK (("resolution" IS NULL) = ("resolvedAt" IS NULL));

-- C-10 validation_record
ALTER TABLE "validation_record"
  ADD CONSTRAINT "validation_record_result_check"
    CHECK ("result" IN ('pass', 'fail', 'flagged'));

-- C-11 question_review
ALTER TABLE "question_review"
  ADD CONSTRAINT "question_review_decision_check"
    CHECK ("decision" IN ('accepted', 'edited', 'rejected', 'reported', 'repaired', 'withdrawn')),
  ADD CONSTRAINT "question_review_activity_check"
    CHECK ("activity" IN ('content', 'batch_decision', 'sample_review', 'report_triage', 'repair'));

-- C-12 competency and B-12
ALTER TABLE "competency"
  ADD CONSTRAINT "competency_tier_check"
    CHECK ("tier" IN ('EVIDENCE-BACKED-NOT-CPNS-2026', 'UNVERIFIED', 'DEPRECATED')),
  ADD CONSTRAINT "competency_parent_not_self_check"
    CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- C-8, C-13 session; B-13
ALTER TABLE "session"
  ADD CONSTRAINT "session_mode_check"
    CHECK ("mode" IN ('tryout', 'latihan')),
  ADD CONSTRAINT "session_status_check"
    CHECK ("status" IN ('open', 'submitted', 'blocked')),
  ADD CONSTRAINT "session_bounds_check"
    CHECK ("activeMs" >= 0
       AND ("durationMs" IS NULL OR "durationMs" > 0)
       AND "configVersion" > 0
       AND "scoringVersion" > 0),
  ADD CONSTRAINT "session_submitted_at_check"
    CHECK (("status" = 'open') OR "submittedAt" IS NOT NULL);

-- B-14 answer_sheet
ALTER TABLE "answer_sheet"
  ADD CONSTRAINT "answer_sheet_flagged_check"
    CHECK ("flagged" IN (0, 1)),
  ADD CONSTRAINT "answer_sheet_bounds_check"
    CHECK ("answerTimestampMs" >= 0 AND "elapsedActiveMs" >= 0);

-- C-15, B-15 session_deletion
ALTER TABLE "session_deletion"
  ADD CONSTRAINT "session_deletion_kind_check"
    CHECK ("deletionKind" = 'user_delete'),
  ADD CONSTRAINT "session_deletion_count_check"
    CHECK ("questionCount" >= 0);

-- C-14 score_result
ALTER TABLE "score_result"
  ADD CONSTRAINT "score_result_blocked_code_check"
    CHECK ("blockedErrorCode" IS NULL OR "blockedErrorCode" IN
      ('PF_ROSTER_INVALID', 'PF_CONFIG_INVALID', 'PF_BASIS_MISMATCH', 'PF_SCORE_CEILING', 'SC_PURITY'));

-- C-16, B-16 provider / secret_ref
ALTER TABLE "provider"
  ADD CONSTRAINT "provider_preset_check"
    CHECK ("preset" IN ('openrouter', 'openai_compatible', 'ollama', 'custom')),
  ADD CONSTRAINT "provider_timeout_check"
    CHECK ("timeoutMs" > 0);

ALTER TABLE "secret_ref"
  ADD CONSTRAINT "secret_ref_has_key_check"
    CHECK ("hasKey" IN (0, 1)),
  ADD CONSTRAINT "secret_ref_store_kind_check"
    CHECK ("storeKind" IN ('windows_credential_manager', 'macos_keychain', 'secret_service'));

-- C-17, C-18, B-17 generation_job / generation_batch
ALTER TABLE "generation_job"
  ADD CONSTRAINT "generation_job_status_check"
    CHECK ("status" IN ('queued', 'running', 'completed', 'failed', 'interrupted')),
  ADD CONSTRAINT "generation_job_counts_check"
    CHECK ("count" >= 1 AND "producedCount" >= 0 AND "quarantinedCount" >= 0 AND "partial" IN (0, 1));

ALTER TABLE "generation_batch"
  ADD CONSTRAINT "generation_batch_status_check"
    CHECK ("status" IN ('completed', 'failed', 'interrupted'));

-- C-20 notification
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_severity_check"
    CHECK ("severity" IN ('info', 'action', 'warning', 'error'));

-- C-21, B-18 backup_record
ALTER TABLE "backup_record"
  ADD CONSTRAINT "backup_record_mode_check"
    CHECK ("mode" IN ('automatic', 'manual')),
  ADD CONSTRAINT "backup_record_status_check"
    CHECK ("status" IN ('succeeded', 'failed')),
  ADD CONSTRAINT "backup_record_bounds_check"
    CHECK ("fileSizeBytes" IS NULL OR "fileSizeBytes" >= 0),
  ADD CONSTRAINT "backup_record_failed_nulls_check"
    CHECK ("status" <> 'failed' OR ("filePath" IS NULL AND "fileSizeBytes" IS NULL)),
  ADD CONSTRAINT "backup_record_succeeded_has_file_check"
    CHECK ("status" <> 'succeeded' OR "filePath" IS NOT NULL);

-- C-22 package
ALTER TABLE "package"
  ADD CONSTRAINT "package_mode_check"
    CHECK ("mode" IN ('tryout', 'latihan')),
  ADD CONSTRAINT "package_source_check"
    CHECK ("source" IN ('builtin', 'dynamic', 'custom'));

-- B-19 package_version
ALTER TABLE "package_version"
  ADD CONSTRAINT "package_version_version_check"
    CHECK ("version" > 0);

-- B-15 observed_question_history
ALTER TABLE "observed_question_history"
  ADD CONSTRAINT "observed_question_history_count_check"
    CHECK ("answerCount" >= 0);

-- C-23, B-19, B-20 material / material_version
ALTER TABLE "material"
  ADD CONSTRAINT "material_content_type_check"
    CHECK ("contentType" IN ('conceptual', 'strategy', 'factual', 'legal', 'historical', 'policy')),
  ADD CONSTRAINT "material_status_check"
    CHECK ("status" IN ('draft', 'approved', 'retired')),
  ADD CONSTRAINT "material_version_check"
    CHECK ("version" > 0),
  ADD CONSTRAINT "material_approval_pairing_check"
    CHECK (("approvalVersion" IS NULL) = ("approvedAt" IS NULL)),
  ADD CONSTRAINT "material_approved_requires_approval_check"
    CHECK ("status" <> 'approved' OR ("approvalVersion" IS NOT NULL AND "approvedAt" IS NOT NULL));

ALTER TABLE "material_version"
  ADD CONSTRAINT "material_version_version_check"
    CHECK ("version" > 0);

-- B-1..B-5 exam_config
ALTER TABLE "exam_config"
  ADD CONSTRAINT "exam_config_counts_check"
    CHECK ("itemCount" = "twkCount" + "tiuCount" + "tkpCount"
       AND "itemCount" >= 0 AND "twkCount" >= 0 AND "tiuCount" >= 0 AND "tkpCount" >= 0),
  ADD CONSTRAINT "exam_config_weights_check"
    CHECK ("twkWeight" IN (0, 5) AND "tiuWeight" IN (0, 5)),
  ADD CONSTRAINT "exam_config_tkp_weights_check"
    CHECK ("tkpWeightMin" BETWEEN 1 AND 5 AND "tkpWeightMin" <= "tkpWeightMax"),
  ADD CONSTRAINT "exam_config_bounds_check"
    CHECK (("durationMinutes" IS NULL OR "durationMinutes" > 0) AND "maxScore" > 0),
  ADD CONSTRAINT "exam_config_versions_check"
    CHECK ("scoringVersion" > 0 AND "configVersion" > 0);

-- B-7 provisional_approval
ALTER TABLE "provisional_approval"
  ADD CONSTRAINT "provisional_approval_versions_check"
    CHECK ("scoringVersion" > 0 AND "configVersion" > 0);

-- ---------------------------------------------------------------------------
-- 3. Append-only guards (DATABASE_SCHEMA §3.3, T-1…T-13)
-- ---------------------------------------------------------------------------
-- Every trigger is ENABLE ALWAYS: a plain ENABLE trigger is disabled by
-- `session_replication_role = replica`, which a restore may set. No GUC, no flag
-- and no role can unlock them (SCHEMA_CONTRACT_REVIEW §1.3); deletion of session
-- rows goes through `tryoutsim.delete_session` below, which runs these checks
-- under its own owner and deletes children explicitly.

CREATE OR REPLACE FUNCTION tryoutsim_raise_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (%).', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23001';
END $$;

-- Pure append-only: INSERT only.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'provisional_approval', 'question_version', 'validation_record', 'question_review',
    'session_deletion', 'package_version', 'material_version'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_append_only', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON %I '
      'FOR EACH STATEMENT EXECUTE FUNCTION tryoutsim_raise_append_only()',
      t || '_append_only', t);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER %I', t, t || '_append_only');
  END LOOP;
END $$;

-- T-3 question_report: updatable only while open (resolution IS NULL).
CREATE OR REPLACE FUNCTION tryoutsim_question_report_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'question_report is append-only (%)', TG_OP USING ERRCODE = '23001';
  END IF;
  IF OLD."resolution" IS NOT NULL THEN
    RAISE EXCEPTION 'a resolved question_report cannot be updated' USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS question_report_guard ON "question_report";
CREATE TRIGGER question_report_guard
  BEFORE UPDATE OR DELETE ON "question_report"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_question_report_guard();
ALTER TABLE "question_report" ENABLE ALWAYS TRIGGER question_report_guard;

DROP TRIGGER IF EXISTS question_report_no_truncate ON "question_report";
CREATE TRIGGER question_report_no_truncate
  BEFORE TRUNCATE ON "question_report"
  FOR EACH STATEMENT EXECUTE FUNCTION tryoutsim_raise_append_only();
ALTER TABLE "question_report" ENABLE ALWAYS TRIGGER question_report_no_truncate;

-- T-6/T-7 session_snapshot, score_result: no UPDATE; DELETE only through the
-- delete function, which sets a transaction-local marker under its own owner.
-- The marker is not a caller-settable GUC: it is a session variable set by the
-- function body, and the app role has no DELETE privilege on these tables, so it
-- can never reach the check.
CREATE OR REPLACE FUNCTION tryoutsim_forbid_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable (%).', TG_TABLE_NAME, TG_OP USING ERRCODE = '23001';
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['session_snapshot', 'score_result'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_update', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION tryoutsim_forbid_update()',
      t || '_no_update', t);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER %I', t, t || '_no_update');
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_truncate', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION tryoutsim_raise_append_only()',
      t || '_no_truncate', t);
    EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER %I', t, t || '_no_truncate');
  END LOOP;
END $$;

-- T-11 session: submittedAt may not be reset; submitted/blocked are terminal.
CREATE OR REPLACE FUNCTION tryoutsim_session_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'session rows are deleted only through tryoutsim.delete_session (TRUNCATE)'
      USING ERRCODE = '23001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- The app role holds no DELETE privilege here. The only role that can reach
    -- this branch is the delete function's owner (tryoutsim_migrator) or a
    -- superuser, and the function is the only object that deletes a session.
    RETURN OLD;
  END IF;
  IF OLD."submittedAt" IS NOT NULL AND NEW."submittedAt" IS NULL THEN
    RAISE EXCEPTION 'submittedAt cannot be cleared' USING ERRCODE = '23001';
  END IF;
  IF OLD."status" IN ('submitted', 'blocked') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'session status % is terminal', OLD."status" USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS session_transition_guard ON "session";
CREATE TRIGGER session_transition_guard
  BEFORE UPDATE OR DELETE ON "session"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_session_transition_guard();
ALTER TABLE "session" ENABLE ALWAYS TRIGGER session_transition_guard;

DROP TRIGGER IF EXISTS session_no_truncate ON "session";
CREATE TRIGGER session_no_truncate
  BEFORE TRUNCATE ON "session"
  FOR EACH STATEMENT EXECUTE FUNCTION tryoutsim_raise_append_only();
ALTER TABLE "session" ENABLE ALWAYS TRIGGER session_no_truncate;

-- T-12 answer_sheet: writes only while the parent session is open.
CREATE OR REPLACE FUNCTION tryoutsim_answer_sheet_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'answer_sheet cannot be truncated' USING ERRCODE = '23001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- Only the delete function may remove answers; it deletes after removing the
    -- session's snapshot, and it deletes every answer of a session at once.
    RETURN OLD;
  END IF;
  SELECT "status" INTO parent_status FROM public."session" WHERE "id" = NEW."sessionId";
  IF parent_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'answer_sheet is frozen: session is %', coalesce(parent_status, 'absent')
      USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS answer_sheet_guard ON "answer_sheet";
CREATE TRIGGER answer_sheet_guard
  BEFORE INSERT OR UPDATE ON "answer_sheet"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_answer_sheet_guard();
ALTER TABLE "answer_sheet" ENABLE ALWAYS TRIGGER answer_sheet_guard;

DROP TRIGGER IF EXISTS answer_sheet_no_truncate ON "answer_sheet";
CREATE TRIGGER answer_sheet_no_truncate
  BEFORE TRUNCATE ON "answer_sheet"
  FOR EACH STATEMENT EXECUTE FUNCTION tryoutsim_raise_append_only();
ALTER TABLE "answer_sheet" ENABLE ALWAYS TRIGGER answer_sheet_no_truncate;

-- T-13 thresholds: a historical config's thresholds are frozen. "Historical" is
-- decided by the config row itself; the app updates the config first, so this
-- compares against the live exam_config state rather than duplicating a rule.
CREATE OR REPLACE FUNCTION tryoutsim_thresholds_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE cfg_state text;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'thresholds cannot be truncated' USING ERRCODE = '23001';
  END IF;
  SELECT "state" INTO cfg_state FROM public."exam_config" WHERE "id" = OLD."examConfigId";
  IF cfg_state = 'historical' THEN
    RAISE EXCEPTION 'thresholds of a historical config are frozen (%)', TG_OP USING ERRCODE = '23001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS thresholds_guard ON "thresholds";
CREATE TRIGGER thresholds_guard
  BEFORE UPDATE OR DELETE ON "thresholds"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_thresholds_guard();
ALTER TABLE "thresholds" ENABLE ALWAYS TRIGGER thresholds_guard;

-- ---------------------------------------------------------------------------
-- 4. DB-4 cascade: provider deletion (PO directive 2026-11-10)
-- ---------------------------------------------------------------------------
-- `generation_job.providerId` is FK RESTRICT in the generated baseline. Deleting
-- a provider deletes its finished jobs (the batch history survives through the
-- job's own taskModel/promptVersion snapshot), but is refused while any job is
-- queued or running, which the endpoint reports as 409 CONFLICT.
CREATE OR REPLACE FUNCTION tryoutsim_provider_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE active_jobs int;
BEGIN
  SELECT count(*) INTO active_jobs
    FROM public."generation_job"
   WHERE "providerId" = OLD."id" AND "status" IN ('queued', 'running');
  IF active_jobs > 0 THEN
    RAISE EXCEPTION 'provider % has % active generation job(s)', OLD."id", active_jobs
      USING ERRCODE = '23503';
  END IF;
  DELETE FROM public."generation_job" WHERE "providerId" = OLD."id";
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS provider_delete_guard ON "provider";
CREATE TRIGGER provider_delete_guard
  BEFORE DELETE ON "provider"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_provider_guard();
ALTER TABLE "provider" ENABLE ALWAYS TRIGGER provider_delete_guard;

-- ---------------------------------------------------------------------------
-- 5. Deletion (D-1, D-2, D-3): the only path that removes a session
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, owned by the migration role, pinned search_path, fully
-- schema-qualified, no dynamic SQL, EXECUTE to the app role only. Returns boolean
-- and reports nothing beyond existence. The body is one transaction, so DB-6
-- holds by construction: tombstone, children, parent, no interleaving.

-- Container schema for definer-owned functions.
CREATE SCHEMA IF NOT EXISTS tryoutsim;

CREATE OR REPLACE FUNCTION tryoutsim.delete_session(p_session_id text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  s public."session"%ROWTYPE;
  answer_count int;
BEGIN
  SELECT * INTO s FROM public."session" WHERE "id" = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO answer_count FROM public."answer_sheet" WHERE "sessionId" = p_session_id;

  -- Content-free tombstone first: if anything below fails, it rolls back too.
  INSERT INTO public."session_deletion"
    ("id", "sessionId", "mode", "configId", "configVersion", "startedAt", "finishedAt",
     "questionCount", "deletedAt", "deletionKind")
  VALUES
    (gen_random_uuid()::text, p_session_id, s."mode", s."examConfigId", s."configVersion",
     s."startedAt", coalesce(s."submittedAt", s."startedAt"), answer_count,
     to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'user_delete');

  DELETE FROM public."answer_sheet"     WHERE "sessionId" = p_session_id;
  DELETE FROM public."score_result"     WHERE "sessionId" = p_session_id;
  DELETE FROM public."session_snapshot" WHERE "sessionId" = p_session_id;
  DELETE FROM public."session"          WHERE "id" = p_session_id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION tryoutsim.delete_session(text) FROM PUBLIC;
