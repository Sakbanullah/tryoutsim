-- ---------------------------------------------------------------------------
-- Restore the provider foreign key to its baseline definition (2026-11-13)
-- ---------------------------------------------------------------------------
-- A probe during the DB-4 investigation re-created `generation_job_providerId_fkey`
-- without its `ON DELETE RESTRICT` action. The baseline
-- (20261110000000_baseline) defines RESTRICT; the DB-4 delete guard in
-- 20261110000001_constraints_and_guards relies on it to refuse a provider that
-- still owns a job. This migration puts the baseline definition back, so a
-- database that saw the probe matches a fresh `migrate deploy`.
-- Idempotent: the constraint is dropped first, so re-running is harmless.
-- ---------------------------------------------------------------------------
ALTER TABLE "generation_job" DROP CONSTRAINT IF EXISTS "generation_job_providerId_fkey";
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
