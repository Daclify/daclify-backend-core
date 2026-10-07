CREATE FUNCTION keep_hosting_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='hosting_prices' THEN
    IF ROW(NEW.policy_key,NEW.pricing,NEW.created_at) IS DISTINCT FROM ROW(OLD.policy_key,OLD.pricing,OLD.created_at)
      OR (OLD.stripe_price IS NOT NULL AND NEW.stripe_price IS DISTINCT FROM OLD.stripe_price) THEN RAISE EXCEPTION 'Hosting price snapshot is immutable'; END IF;
  ELSIF TG_TABLE_NAME='hosting_changes' THEN
    IF ROW(NEW.request_id,NEW.subscription_id,NEW.pricing,NEW.price_key,NEW.extra_slots,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.request_id,OLD.subscription_id,OLD.pricing,OLD.price_key,OLD.extra_slots,OLD.created_at) THEN RAISE EXCEPTION 'Hosting consent snapshot is immutable'; END IF;
  ELSIF TG_TABLE_NAME='hosting_invoices' THEN
    IF ROW(NEW.invoice_id,NEW.subscription_id,NEW.receipt,NEW.members,NEW.expires,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.invoice_id,OLD.subscription_id,OLD.receipt,OLD.members,OLD.expires,OLD.created_at) THEN RAISE EXCEPTION 'Hosting invoice snapshot is immutable'; END IF;
  ELSIF TG_TABLE_NAME='hosting_subscriptions' THEN
    IF ROW(NEW.id,NEW.dao_key,NEW.dao,NEW.created_by,NEW.request_id,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.dao_key,OLD.dao,OLD.created_by,OLD.request_id,OLD.created_at)
      OR (OLD.checkout_id IS NOT NULL AND NEW.checkout_id IS DISTINCT FROM OLD.checkout_id)
      OR (OLD.stripe_subscription IS NOT NULL AND NEW.stripe_subscription IS DISTINCT FROM OLD.stripe_subscription) THEN RAISE EXCEPTION 'Hosting subscription identity is immutable'; END IF;
    IF ROW(NEW.pricing,NEW.price_key,NEW.extra_slots) IS DISTINCT FROM ROW(OLD.pricing,OLD.price_key,OLD.extra_slots)
      AND NOT EXISTS(SELECT 1 FROM hosting_changes c WHERE c.subscription_id=OLD.id AND c.state='applied' AND c.pricing=NEW.pricing AND c.price_key=NEW.price_key AND c.extra_slots=NEW.extra_slots) THEN RAISE EXCEPTION 'Hosting change requires captured consent'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hosting_price_snapshot BEFORE UPDATE ON hosting_prices FOR EACH ROW EXECUTE FUNCTION keep_hosting_snapshot();
CREATE TRIGGER hosting_change_snapshot BEFORE UPDATE ON hosting_changes FOR EACH ROW EXECUTE FUNCTION keep_hosting_snapshot();
CREATE TRIGGER hosting_invoice_snapshot BEFORE UPDATE ON hosting_invoices FOR EACH ROW EXECUTE FUNCTION keep_hosting_snapshot();
CREATE TRIGGER hosting_subscription_snapshot BEFORE UPDATE ON hosting_subscriptions FOR EACH ROW EXECUTE FUNCTION keep_hosting_snapshot();
