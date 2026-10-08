ALTER TABLE hosted_removals DROP CONSTRAINT hosted_removals_staged_bytes_check;
ALTER TABLE hosted_removals ALTER COLUMN staged_bytes DROP NOT NULL;
ALTER TABLE hosted_removals ADD CONSTRAINT hosted_removal_staging_lifecycle CHECK (
 (state IN ('prepared','removing','review') AND staged_bytes IS NOT NULL AND octet_length(staged_bytes) BETWEEN 1 AND 5242880)
 OR (state IN ('removed','canceled') AND staged_bytes IS NULL)
);
CREATE OR REPLACE FUNCTION guard_removal_domain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.object_id,NEW.generation,NEW.recovery_request,NEW.provider_ids,NEW.affected_daos) IS DISTINCT FROM ROW(OLD.object_id,OLD.generation,OLD.recovery_request,OLD.provider_ids,OLD.affected_daos) THEN RAISE EXCEPTION 'STORAGE_REMOVAL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.staged_bytes IS DISTINCT FROM OLD.staged_bytes AND NOT(NEW.state IN ('removed','canceled') AND NEW.staged_bytes IS NULL) THEN RAISE EXCEPTION 'STORAGE_REMOVAL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF OLD.state IN ('removed','canceled') AND NEW.state<>OLD.state THEN RAISE EXCEPTION 'STORAGE_REMOVAL_TERMINAL' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
