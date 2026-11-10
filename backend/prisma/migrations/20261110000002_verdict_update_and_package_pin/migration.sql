-- AUD-88: a stored result carries its whole wire state; nothing is projected at read time.
ALTER TABLE "score_result" ADD COLUMN "verdictWithheldJson" TEXT;
ALTER TABLE "score_result" ADD COLUMN "timingJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "score_result" ADD COLUMN "scoredAt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "score_result" ALTER COLUMN "timingJson" DROP DEFAULT;
ALTER TABLE "score_result" ALTER COLUMN "scoredAt" DROP DEFAULT;

-- AUD-87: a custom package version may pin the config it was authored against (optional).
ALTER TABLE "package_version" ADD COLUMN "examConfigId" TEXT;
ALTER TABLE "package_version" ADD COLUMN "examConfigVersion" INTEGER;

-- AUD-85: T-7 becomes a row guard. A stored result is still immutable, except that
-- `tryoutsim.add_session_verdict` may add the verdict exactly once. The condition is
-- purely the row's own state (no verdict yet, score columns untouched), so this does
-- not open an escape hatch: the app role still holds no UPDATE on this table.
CREATE OR REPLACE FUNCTION tryoutsim_score_result_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."verdictJson" IS NULL
     AND NEW."verdictJson" IS NOT NULL
     AND (to_jsonb(NEW) - ARRAY['verdictJson', 'approvalJson', 'verdictWithheldJson'])
       = (to_jsonb(OLD) - ARRAY['verdictJson', 'approvalJson', 'verdictWithheldJson']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'score_result rows are immutable (%).', TG_OP USING ERRCODE = '23001';
END $$;

DROP TRIGGER IF EXISTS score_result_no_update ON "score_result";
CREATE TRIGGER score_result_no_update
  BEFORE UPDATE ON "score_result"
  FOR EACH ROW EXECUTE FUNCTION tryoutsim_score_result_guard();
ALTER TABLE "score_result" ENABLE ALWAYS TRIGGER score_result_no_update;

-- AUD-85: the only writer of the verdict-only transition. SECURITY DEFINER, owned by the
-- migration role, pinned search_path, no dynamic SQL, EXECUTE to the app role only.
CREATE OR REPLACE FUNCTION tryoutsim.add_session_verdict(
  p_session_id text, p_verdict jsonb, p_approval jsonb, p_withheld jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public."score_result"
     SET "verdictJson" = p_verdict::text,
         "approvalJson" = p_approval::text,
         "verdictWithheldJson" = p_withheld::text
   WHERE "sessionId" = p_session_id AND "verdictJson" IS NULL;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION tryoutsim.add_session_verdict(text, jsonb, jsonb, jsonb) FROM PUBLIC;
