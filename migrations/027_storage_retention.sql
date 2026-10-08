ALTER TABLE hosted_references ADD COLUMN released_at timestamptz;
ALTER TABLE uploads ADD COLUMN storage_released_at timestamptz;
ALTER TABLE asset_uploads ADD COLUMN storage_released_at timestamptz;
CREATE INDEX hosted_references_retained ON hosted_references(object_id,dao_key) WHERE released_at IS NULL;
CREATE TABLE storage_curation (
 dao_key text NOT NULL,provider_scope text NOT NULL,generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0),
 object_ids uuid[] NOT NULL DEFAULT '{}',updated_by uuid REFERENCES accounts(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(dao_key,provider_scope),CHECK(cardinality(object_ids)<=10000)
);
CREATE TABLE hosted_removals (
 object_id uuid NOT NULL REFERENCES hosted_objects(id),generation bigint NOT NULL CHECK(generation>0),
 recovery_request uuid NOT NULL DEFAULT gen_random_uuid(),lease_token uuid NOT NULL,lease_until timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('prepared','removing','removed','canceled','review')),
 staged_bytes bytea NOT NULL CHECK(octet_length(staged_bytes) BETWEEN 1 AND 5242880),
 provider_ids uuid[] NOT NULL CHECK(cardinality(provider_ids) BETWEEN 1 AND 100),
 affected_daos jsonb NOT NULL CHECK(jsonb_typeof(affected_daos)='array'),
 last_error_code text CHECK(last_error_code ~ '^[A-Z_]+$'),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,PRIMARY KEY(object_id,generation)
);
CREATE UNIQUE INDEX hosted_removal_active ON hosted_removals(object_id) WHERE state IN ('prepared','removing','review');
CREATE FUNCTION guard_removal_domain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.object_id,NEW.generation,NEW.recovery_request,NEW.staged_bytes,NEW.provider_ids,NEW.affected_daos) IS DISTINCT FROM ROW(OLD.object_id,OLD.generation,OLD.recovery_request,OLD.staged_bytes,OLD.provider_ids,OLD.affected_daos) THEN
  RAISE EXCEPTION 'STORAGE_REMOVAL_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 IF OLD.state IN ('removed','canceled') AND NEW.state<>OLD.state THEN RAISE EXCEPTION 'STORAGE_REMOVAL_TERMINAL' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hosted_removal_immutable BEFORE UPDATE ON hosted_removals FOR EACH ROW EXECUTE FUNCTION guard_removal_domain();
