CREATE INDEX audit_account_time ON audit_events(account_id,id DESC);
CREATE FUNCTION audit_credential_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  record jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  method text;
  subject text;
  chain text := NULL;
BEGIN
  IF TG_TABLE_NAME='credentials' THEN
    method := split_part(record->>'provider_key',':',1);
    subject := substring(record->>'provider_key' from length(method)+2);
  ELSIF TG_TABLE_NAME='passkeys' THEN
    method := 'passkey';
    subject := regexp_replace(translate(encode(CASE WHEN TG_OP='DELETE' THEN OLD.credential_id ELSE NEW.credential_id END,'base64'),'+/','-_'),'[=\n\r]','','g');
  ELSIF TG_TABLE_NAME='native_links' THEN
    method := 'native';subject := record->>'native_account';chain := record->>'chain_id';
  ELSE
    method := 'evm';subject := record->>'address';chain := record->>'chain_id';
  END IF;
  INSERT INTO audit_events(account_id,kind,public_reference)
  VALUES((record->>'account_id')::uuid,'credential.change',jsonb_build_object('action',CASE TG_OP WHEN 'INSERT' THEN 'linked' WHEN 'DELETE' THEN 'unlinked' ELSE 'updated' END,'method',method,'subject',subject,'chainId',chain));
  RETURN NULL;
END;
$$;
CREATE TRIGGER credential_history AFTER INSERT OR UPDATE OR DELETE ON credentials FOR EACH ROW EXECUTE FUNCTION audit_credential_change();
CREATE TRIGGER passkey_history AFTER INSERT OR DELETE ON passkeys FOR EACH ROW EXECUTE FUNCTION audit_credential_change();
CREATE TRIGGER native_history AFTER INSERT OR UPDATE OR DELETE ON native_links FOR EACH ROW EXECUTE FUNCTION audit_credential_change();
CREATE TRIGGER evm_history AFTER INSERT OR UPDATE OR DELETE ON evm_links FOR EACH ROW EXECUTE FUNCTION audit_credential_change();
