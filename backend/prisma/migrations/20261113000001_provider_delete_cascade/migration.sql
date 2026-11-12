-- ---------------------------------------------------------------------------
-- DB-4 cascade: provider deletion deletes its finished jobs (PO decision, 2026-11-13)
-- ---------------------------------------------------------------------------
-- The original design (20261110000001_constraints_and_guards) called for a
-- `BEFORE DELETE` trigger that deletes the provider's finished jobs itself and
-- refuses while one is queued or running. That shape cannot work under FK
-- RESTRICT: the job rows a trigger deletes are still checked against the
-- provider row being deleted, so every delete failed 23503 (verified on
-- PostgreSQL 18.6; in an `AFTER` trigger the RI check runs before it fires).
--
-- The cascade is therefore expressed where PostgreSQL enforces it: the FK.
-- `ON DELETE CASCADE` removes the provider's jobs (and, through
-- `generation_batch.jobId`, their batches) in the same statement. The guard keeps
-- only the refusal. `ENABLE ALWAYS` would also fire it during a restore
-- (`session_replication_role = replica`), where it must not: a cascaded delete
-- takes its trigger rows with it, so firing on them mid-cascade raises a 23503
-- that rolls the whole restore back. The guard is `ENABLE` (origin/local) in this
-- migration, and migration 20261113000002 applies that to existing databases.
-- ---------------------------------------------------------------------------
ALTER TABLE "generation_job" DROP CONSTRAINT IF EXISTS "generation_job_providerId_fkey";
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS provider_delete_guard ON "provider";
CREATE TRIGGER provider_delete_guard
  BEFORE DELETE ON "provider"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_provider_guard();
ALTER TABLE "provider" ENABLE TRIGGER provider_delete_guard;
