CREATE TABLE ram_card_orders (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  dao_key text NOT NULL,
  approval jsonb NOT NULL,
  reference text NOT NULL UNIQUE CHECK(reference ~ '^[0-9a-f]{64}$'),
  stripe_account text NOT NULL CHECK(stripe_account ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','paid','provisioning','settled','review')),
  checkout_id text UNIQUE CHECK(checkout_id ~ '^cs_[A-Za-z0-9_]+$'),
  checkout_url text,
  payment_intent text UNIQUE CHECK(payment_intent ~ '^pi_[A-Za-z0-9_]+$'),
  acquired_bytes numeric(20,0) CHECK(acquired_bytes>0 AND acquired_bytes<=18446744073709551615),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(checkout_url IS NULL OR checkout_id IS NOT NULL),
  CHECK((acquired_bytes IS NULL)=(settled_at IS NULL)),
  CHECK(state<>'settled' OR settled_at IS NOT NULL),
  CHECK(approval->>'requestId'=id::text AND approval->>'consent'='true'),
  CHECK((approval->>'totalUsdCents')::bigint BETWEEN 500 AND 99999999)
);
CREATE INDEX ram_card_orders_dao ON ram_card_orders(dao_key,created_at,id);
CREATE FUNCTION protect_ram_card_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'RAM_ORDER_IMMUTABLE'; END IF;
  IF ROW(NEW.id,NEW.account_id,NEW.dao_key,NEW.approval,NEW.reference,NEW.stripe_account,NEW.livemode,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.dao_key,OLD.approval,OLD.reference,OLD.stripe_account,OLD.livemode,OLD.created_at)
    OR (OLD.checkout_id IS NOT NULL AND ROW(NEW.checkout_id,NEW.checkout_url) IS DISTINCT FROM ROW(OLD.checkout_id,OLD.checkout_url))
    OR (OLD.payment_intent IS NOT NULL AND NEW.payment_intent IS DISTINCT FROM OLD.payment_intent)
    OR (OLD.settled_at IS NOT NULL AND ROW(NEW.acquired_bytes,NEW.settled_at) IS DISTINCT FROM ROW(OLD.acquired_bytes,OLD.settled_at))
    OR (OLD.settled_at IS NOT NULL AND NEW.state NOT IN ('settled','review'))
  THEN RAISE EXCEPTION 'RAM_ORDER_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ram_card_order_immutable BEFORE UPDATE OR DELETE ON ram_card_orders FOR EACH ROW EXECUTE FUNCTION protect_ram_card_order();
