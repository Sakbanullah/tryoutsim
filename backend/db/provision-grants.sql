-- Grants for the two roles (DATABASE_SCHEMA §3.5, SCHEMA_CONTRACT_REVIEW §2.6).
--
-- This is PROVISIONING SQL, not a migration: it runs once per machine as the
-- role that owns the database and the objects (the migrator), after the first
-- `migrate deploy`, and again only when a new table or function is added.
-- Prisma emits no privilege, so every grant lives here and nowhere else.
--
-- Replace the literals below with the actual role names chosen at provisioning.
-- Passwords are never part of this file: they are entered by the operator and
-- stored in Windows Credential Manager (PO decision 2026-11-10).

\set ON_ERROR_STOP on

-- Placeholders — the operator substitutes these (psql \set or sed) before running.
--   :app_role      e.g. tryoutsim_app
--   :migrator_role e.g. tryoutsim_migrator
--   :database      e.g. tryoutsim

BEGIN;

-- G-8 ownership: every object in the database schema is owned by the migrator.
-- (Already true if migrations ran as the migrator; asserted so that a stray
-- object created by another role is a hard failure, not a silent gap.)
-- `current_user` is the migrator: this file is run as that role. psql does not
-- substitute `:'var'` inside a dollar-quoted body, so the variable cannot be used here.
DO $$
DECLARE stray int;
BEGIN
  SELECT count(*) INTO stray
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p', 'i', 'S', 'v')
     AND pg_get_userbyid(c.relowner) <> current_user;
  IF stray > 0 THEN
    RAISE EXCEPTION '% object(s) in public are not owned by %', stray, current_user;
  END IF;
END $$;

-- G-1 the app role never holds CREATEDB, and never SUPERUSER.
-- Rule attributes (CREATEDB/SUPERUSER/CREATEROLE) are set at provisioning time by the
-- superuser, not here: `ALTER ROLE … NOSUPERUSER` on another role needs SUPERUSER, which
-- the migrator does not hold. See ProvisioningCommon.ps1 (Get-RoleAttributeSql).

-- G-2 schema defaults: the app can use the schema and read/write tables the
-- migrator creates later, but never create objects in it.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_role";

ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Private schema: the delete function only.
REVOKE ALL ON SCHEMA tryoutsim FROM PUBLIC;
GRANT USAGE ON SCHEMA tryoutsim TO :"app_role";

-- Blanket: the defaults above also apply to objects that already exist.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";

-- G-5 the migration table is readable, never writable, by the app.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public._prisma_migrations FROM :"app_role";
GRANT SELECT ON public._prisma_migrations TO :"app_role";

-- G-3 append-only tables: the app may read and insert, never change.
REVOKE UPDATE, DELETE, TRUNCATE ON
  public.provisional_approval,
  public.question_version,
  public.validation_record,
  public.question_review,
  public.session_deletion,
  public.package_version,
  public.material_version
FROM :"app_role";
GRANT SELECT, INSERT ON
  public.provisional_approval,
  public.question_version,
  public.validation_record,
  public.question_review,
  public.session_deletion,
  public.package_version,
  public.material_version
TO :"app_role";

-- G-4 the session family: no DELETE for the app at all. Deletion is the
-- function's job (D-1), so the trigger behind it is a second line of defence and
-- the privilege is the first.
REVOKE DELETE, TRUNCATE ON
  public.session,
  public.session_snapshot,
  public.answer_sheet,
  public.score_result
FROM :"app_role";

-- session_snapshot and score_result are written once and never updated.
REVOKE UPDATE ON public.session_snapshot, public.score_result FROM :"app_role";

-- The app writes these session columns and nothing else.
REVOKE UPDATE ON public.session FROM :"app_role";
GRANT UPDATE (
  "status", "activeMs", "runningSince", "durationMs", "submittedAt"
) ON public.session TO :"app_role";

REVOKE UPDATE ON public.answer_sheet FROM :"app_role";
GRANT UPDATE (
  "selectedOption", "answerTimestampMs", "elapsedActiveMs", "flagged"
) ON public.answer_sheet TO :"app_role";

-- question_report is updatable only to resolve an open report.
REVOKE UPDATE, DELETE ON public.question_report FROM :"app_role";
GRANT UPDATE ("resolution", "resolvedAt") ON public.question_report TO :"app_role";

-- G-6 functions: nothing is executable by PUBLIC; the app gets only the delete
-- function. The guard functions are trigger bodies and are invoked by PostgreSQL
-- regardless of EXECUTE, so they keep EXECUTE to PUBLIC revoked.
REVOKE ALL ON FUNCTION tryoutsim.delete_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tryoutsim.delete_session(text) TO :"app_role";
-- AUD-85: the verdict-only transition; creates an error until migration 000002 runs.
REVOKE ALL ON FUNCTION tryoutsim.add_session_verdict(text, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tryoutsim.add_session_verdict(text, jsonb, jsonb, jsonb) TO :"app_role";

REVOKE ALL ON FUNCTION tryoutsim_raise_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION tryoutsim_forbid_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION tryoutsim_question_report_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION tryoutsim_session_transition_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION tryoutsim_answer_sheet_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION tryoutsim_thresholds_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION tryoutsim_provider_guard() FROM PUBLIC;

-- G-7 TRUNCATE is never granted, on any table.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM :"app_role";

COMMIT;
