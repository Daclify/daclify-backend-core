CREATE TABLE archive_storage_holds (
  id uuid PRIMARY KEY,
  requested_by uuid NOT NULL REFERENCES accounts(id),
  dao_key text NOT NULL,
  provider_scope text NOT NULL CHECK(length(provider_scope) BETWEEN 1 AND 128),
  maximum_bytes bigint NOT NULL CHECK(maximum_bytes>0),
  remaining_bytes bigint NOT NULL CHECK(remaining_bytes>=0 AND remaining_bytes<=maximum_bytes),
  state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(state<>'released' OR remaining_bytes=0)
);
CREATE INDEX archive_storage_holds_budget ON archive_storage_holds(dao_key) WHERE state='held';
ALTER TABLE asset_uploads ADD COLUMN archive_hold_id uuid REFERENCES archive_storage_holds(id);
CREATE FUNCTION freeze_archive_hold() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR ROW(NEW.id,NEW.requested_by,NEW.dao_key,NEW.provider_scope,NEW.maximum_bytes,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.requested_by,OLD.dao_key,OLD.provider_scope,OLD.maximum_bytes,OLD.created_at)
    OR NEW.remaining_bytes>OLD.remaining_bytes OR (OLD.state='released' AND NEW.state<>'released') THEN
    RAISE EXCEPTION 'ARCHIVE_HOLD_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER archive_hold_immutable BEFORE UPDATE OR DELETE ON archive_storage_holds FOR EACH ROW EXECUTE FUNCTION freeze_archive_hold();
CREATE FUNCTION freeze_asset_archive_hold() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.archive_hold_id IS DISTINCT FROM OLD.archive_hold_id THEN
    RAISE EXCEPTION 'ASSET_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER asset_archive_hold_immutable BEFORE UPDATE ON asset_uploads FOR EACH ROW EXECUTE FUNCTION freeze_asset_archive_hold();
