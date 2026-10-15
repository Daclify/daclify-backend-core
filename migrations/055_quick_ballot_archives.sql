-- Public encrypted rows only. Jobs must survive account erasure and DAO closure.
CREATE TABLE quick_ballot_archive_exports (
 id uuid PRIMARY KEY,
 dao_key text NOT NULL,
 dao jsonb NOT NULL CHECK(jsonb_typeof(dao)='object'),
 source text NOT NULL CHECK(length(source) BETWEEN 1 AND 13),
 ballot_id numeric(20,0) NOT NULL CHECK(ballot_id BETWEEN 1 AND 18446744073709551615),
 kind text NOT NULL CHECK(kind IN ('quick-ballot-responses','quick-ballot-grants')),
 provider_scope text NOT NULL CHECK(length(provider_scope) BETWEEN 1 AND 128),
 plan jsonb CHECK(plan IS NULL OR (jsonb_typeof(plan)='object' AND octet_length(plan::text)<=25165824)),
 maximum_bytes bigint NOT NULL CHECK(maximum_bytes BETWEEN 1 AND 67108864),
 remaining_bytes bigint NOT NULL CHECK(remaining_bytes BETWEEN 0 AND maximum_bytes),
 completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(dao_key,source,ballot_id,kind),
 CHECK((NOT completed AND plan IS NOT NULL) OR (completed AND remaining_bytes=0 AND plan IS NULL))
);
CREATE INDEX quick_archive_holds ON quick_ballot_archive_exports(dao_key) WHERE remaining_bytes>0;
CREATE TABLE quick_ballot_archive_files (
 export_id uuid NOT NULL REFERENCES quick_ballot_archive_exports(id),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 32),
 request_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 expected_bytes integer NOT NULL CHECK(expected_bytes BETWEEN 1 AND 5242880),
 commitment text NOT NULL CHECK(commitment ~ '^[0-9a-f]{64}$'),
 cid text CHECK(length(cid) BETWEEN 1 AND 128),
 storage_object_id uuid REFERENCES hosted_objects(id),
 PRIMARY KEY(export_id,ordinal),
 CHECK((cid IS NULL)=(storage_object_id IS NULL))
);
CREATE TABLE quick_ballot_archive_catalog (
 dao_key text NOT NULL,
 source text NOT NULL CHECK(length(source) BETWEEN 1 AND 13),
 ballot_id numeric(20,0) NOT NULL CHECK(ballot_id BETWEEN 1 AND 18446744073709551615),
 kind text NOT NULL CHECK(kind IN ('quick-ballot-responses','quick-ballot-grants')),
 manifest_commitment text NOT NULL CHECK(manifest_commitment ~ '^[0-9a-f]{64}$'),
 chunk_ordinal integer NOT NULL DEFAULT 0 CHECK(chunk_ordinal BETWEEN 0 AND 32),
 row_start integer NOT NULL DEFAULT 0 CHECK(row_start BETWEEN 0 AND 5000),
 completed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(dao_key,source,ballot_id,kind)
);
CREATE FUNCTION freeze_quick_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.dao_key,NEW.dao,NEW.source,NEW.ballot_id,NEW.kind,NEW.provider_scope,NEW.maximum_bytes,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.dao_key,OLD.dao,OLD.source,OLD.ballot_id,OLD.kind,OLD.provider_scope,OLD.maximum_bytes,OLD.created_at)
  OR NEW.remaining_bytes>OLD.remaining_bytes OR (OLD.completed AND NOT NEW.completed)
  OR (NEW.plan IS DISTINCT FROM OLD.plan AND NOT (NEW.completed AND NEW.plan IS NULL)) THEN
  RAISE EXCEPTION 'QUICK_ARCHIVE_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER quick_archive_immutable BEFORE UPDATE ON quick_ballot_archive_exports FOR EACH ROW EXECUTE FUNCTION freeze_quick_archive();
CREATE FUNCTION freeze_quick_archive_file() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.export_id,NEW.ordinal,NEW.request_id,NEW.expected_bytes,NEW.commitment)
  IS DISTINCT FROM ROW(OLD.export_id,OLD.ordinal,OLD.request_id,OLD.expected_bytes,OLD.commitment)
  OR (OLD.cid IS NOT NULL AND ROW(NEW.cid,NEW.storage_object_id) IS DISTINCT FROM ROW(OLD.cid,OLD.storage_object_id)) THEN
  RAISE EXCEPTION 'QUICK_ARCHIVE_FILE_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER quick_archive_file_immutable BEFORE UPDATE ON quick_ballot_archive_files FOR EACH ROW EXECUTE FUNCTION freeze_quick_archive_file();
