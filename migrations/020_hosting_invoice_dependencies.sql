ALTER TABLE hosting_invoices ADD COLUMN base_invoice text REFERENCES hosting_invoices(invoice_id);
ALTER TABLE hosting_invoices ADD CONSTRAINT hosting_invoice_not_own_base CHECK(base_invoice IS NULL OR base_invoice<>invoice_id);
CREATE INDEX hosting_invoice_base ON hosting_invoices(base_invoice) WHERE base_invoice IS NOT NULL;
CREATE FUNCTION keep_hosting_base() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.base_invoice IS DISTINCT FROM OLD.base_invoice THEN RAISE EXCEPTION 'Hosting invoice dependency is immutable'; END IF;
  IF NEW.base_invoice IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hosting_invoices b WHERE b.invoice_id=NEW.base_invoice AND b.base_invoice IS NULL AND b.subscription_id=NEW.subscription_id AND b.expires=NEW.expires) THEN RAISE EXCEPTION 'Hosting invoice requires its own period base'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hosting_invoice_base_snapshot BEFORE INSERT OR UPDATE ON hosting_invoices FOR EACH ROW EXECUTE FUNCTION keep_hosting_base();
