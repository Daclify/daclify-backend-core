ALTER TABLE dao_payment_orders ADD COLUMN return_url text CHECK(return_url IS NULL OR length(return_url)<=4096);
CREATE FUNCTION keep_checkout_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.return_url IS NOT NULL AND NEW.return_url IS DISTINCT FROM OLD.return_url THEN RAISE EXCEPTION 'Checkout return snapshot is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER checkout_return_snapshot BEFORE UPDATE ON dao_payment_orders FOR EACH ROW EXECUTE FUNCTION keep_checkout_return();
