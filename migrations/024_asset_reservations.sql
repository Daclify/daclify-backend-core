CREATE TABLE asset_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  dao_key text NOT NULL,
  provider_scope text NOT NULL CHECK(length(provider_scope) BETWEEN 1 AND 128),
  import_profile text NOT NULL CHECK(import_profile='public-cidv1-file-v1'),
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('branding','media','archive')),
  reference_key text NOT NULL CHECK(reference_key ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$'),
  expected_bytes integer NOT NULL CHECK(expected_bytes>0 AND expected_bytes<=5242880),
  commitment text NOT NULL CHECK(commitment ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','uploaded','verified','published','review')),
  provider_id uuid,
  cid text CHECK(cid IS NULL OR length(cid) BETWEEN 1 AND 128),
  storage_object_id uuid,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  UNIQUE(account_id,request_id),
  FOREIGN KEY(storage_object_id,provider_scope) REFERENCES hosted_objects(id,provider_scope),
  CHECK(state NOT IN ('uploaded','verified','published') OR (provider_id IS NOT NULL AND cid IS NOT NULL)),
  CHECK(state NOT IN ('verified','published') OR (storage_object_id IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX asset_uploads_budget ON asset_uploads(dao_key,storage_object_id);
CREATE INDEX asset_uploads_reconciliation ON asset_uploads(state,created_at) WHERE state IN ('reserved','uploaded','review');
CREATE FUNCTION freeze_asset_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'ASSET_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF ROW(NEW.id,NEW.account_id,NEW.dao_key,NEW.provider_scope,NEW.import_profile,NEW.request_id,NEW.kind,NEW.reference_key,NEW.expected_bytes,NEW.commitment,NEW.request_hash,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.dao_key,OLD.provider_scope,OLD.import_profile,OLD.request_id,OLD.kind,OLD.reference_key,OLD.expected_bytes,OLD.commitment,OLD.request_hash,OLD.created_at) THEN
    RAISE EXCEPTION 'ASSET_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
    OR (OLD.cid IS NOT NULL AND NEW.cid IS DISTINCT FROM OLD.cid)
    OR (OLD.storage_object_id IS NOT NULL AND NEW.storage_object_id IS DISTINCT FROM OLD.storage_object_id)
    OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at) THEN
    RAISE EXCEPTION 'ASSET_VERIFICATION_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER asset_request_immutable BEFORE UPDATE OR DELETE ON asset_uploads FOR EACH ROW EXECUTE FUNCTION freeze_asset_request();
