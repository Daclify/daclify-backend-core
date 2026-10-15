-- Short-lived public intents and exact signed packets; no ballot keys or plaintext choices.
CREATE TABLE quick_account_preparations (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES accounts(id),
 session_hash bytea NOT NULL CHECK(octet_length(session_hash)=32),
 prepared jsonb NOT NULL CHECK(jsonb_typeof(prepared)='object' AND octet_length(prepared::text)<=24576),
 expires_at timestamptz NOT NULL,
 packet jsonb CHECK(packet IS NULL OR (jsonb_typeof(packet)='object' AND octet_length(packet::text)<=12288)),
 cursor integer NOT NULL DEFAULT 0 CHECK(cursor>=0),
 confirmed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '5 minutes'),
 CHECK(packet IS NOT NULL OR (cursor=0 AND NOT confirmed))
);
CREATE INDEX quick_preparations_owner ON quick_account_preparations(account_id);
CREATE INDEX quick_preparations_expiry ON quick_account_preparations(expires_at);
CREATE TRIGGER quick_preparation_owner BEFORE INSERT ON quick_account_preparations
 FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();
CREATE FUNCTION freeze_quick_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.account_id,NEW.session_hash,NEW.prepared,NEW.expires_at,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.session_hash,OLD.prepared,OLD.expires_at,OLD.created_at)
   OR (OLD.packet IS NOT NULL AND NEW.packet IS DISTINCT FROM OLD.packet)
   OR NEW.cursor<OLD.cursor OR (OLD.confirmed AND NOT NEW.confirmed) THEN
  RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='quick_preparation_immutable',MESSAGE='Quick preparation is immutable';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER quick_preparation_frozen BEFORE UPDATE ON quick_account_preparations
 FOR EACH ROW EXECUTE FUNCTION freeze_quick_preparation();
