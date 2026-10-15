-- Public authorization projection only; personal profiles and vote choices are not copied here.
CREATE TABLE quick_account_anchors (
 account_id uuid NOT NULL REFERENCES accounts(id),
 chain_id text NOT NULL CHECK(chain_id ~ '^[0-9a-f]{64}$'),
 runtime text NOT NULL CHECK(runtime ~ '^[a-z1-5.]{1,13}$'),
 anchor jsonb NOT NULL CHECK(jsonb_typeof(anchor)='object' AND octet_length(anchor::text)<=256 AND COALESCE(anchor->>'kind' IN('key','native','evm'),false)),
 identity bytea NOT NULL CHECK(octet_length(identity)=32),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,chain_id,runtime),
 UNIQUE(chain_id,runtime,identity)
);
CREATE TRIGGER quick_anchor_owner BEFORE INSERT OR UPDATE ON quick_account_anchors
 FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();
CREATE FUNCTION freeze_quick_anchor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM accounts WHERE id=OLD.account_id AND erasure_state IN('pending','erased')) THEN RETURN OLD; END IF;
 ELSE
  -- A proved account reconnect may move ownership while retaining the exact on-chain identity.
  IF ROW(NEW.chain_id,NEW.runtime,NEW.anchor,NEW.identity,NEW.created_at)
    IS NOT DISTINCT FROM ROW(OLD.chain_id,OLD.runtime,OLD.anchor,OLD.identity,OLD.created_at) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='quick_anchor_immutable',MESSAGE='Quick account anchor is immutable';
END;
$$;
CREATE TRIGGER quick_anchor_frozen BEFORE UPDATE OR DELETE ON quick_account_anchors
 FOR EACH ROW EXECUTE FUNCTION freeze_quick_anchor();
