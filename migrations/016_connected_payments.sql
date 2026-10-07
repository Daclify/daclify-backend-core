-- Fiat service ledger. These records never credit native token liabilities.
CREATE TABLE dao_merchants (
  dao_key text PRIMARY KEY,
  dao jsonb NOT NULL,
  creation_request uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  creation_started_at timestamptz,
  stripe_account text UNIQUE CHECK (stripe_account ~ '^acct_[A-Za-z0-9]+$'),
  account_kind text CHECK (account_kind IN ('oauth','v2')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','restricted','disconnected')),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  broker_hash bytea UNIQUE CHECK (broker_hash IS NULL OR octet_length(broker_hash)=32),
  broker_admin uuid REFERENCES accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (dao_key='["' || (dao->>'chainId') || '","' || (dao->>'contract') || '","' || (dao->>'daoId') || '",1]'),
  CHECK (dao ?& ARRAY['chainId','contract','daoId','interfaceVersion'] AND dao->>'interfaceVersion'='1'),
  CHECK ((stripe_account IS NULL)=(account_kind IS NULL)),
  CHECK ((broker_hash IS NULL)=(broker_admin IS NULL))
);
CREATE TABLE dao_payment_oauth (
  state_hash bytea PRIMARY KEY CHECK (octet_length(state_hash)=32),
  dao_key text NOT NULL REFERENCES dao_merchants(dao_key),
  account_id uuid NOT NULL REFERENCES accounts(id),
  session_hash bytea NOT NULL CHECK (octet_length(session_hash)=32),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  used_at timestamptz
);
CREATE INDEX dao_payment_oauth_expiry ON dao_payment_oauth(expires_at);
CREATE TABLE dao_payment_products (
  id uuid PRIMARY KEY,
  dao_key text NOT NULL REFERENCES dao_merchants(dao_key),
  module_id text NOT NULL CHECK (module_id ~ '^[a-z][a-z0-9-]{0,63}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  amount_minor integer NOT NULL CHECK (amount_minor BETWEEN 50 AND 99999999),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dao_payment_products_dao ON dao_payment_products(dao_key, active);
CREATE TABLE dao_payment_orders (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  dao_key text NOT NULL REFERENCES dao_merchants(dao_key),
  product_id uuid NOT NULL REFERENCES dao_payment_products(id),
  customer_reference text NOT NULL CHECK (length(customer_reference) BETWEEN 1 AND 160),
  customer_account uuid REFERENCES accounts(id),
  stripe_account text NOT NULL CHECK (stripe_account ~ '^acct_[A-Za-z0-9]+$'),
  title text NOT NULL, module_id text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor BETWEEN 50 AND 99999999),
  fee_bps integer NOT NULL CHECK (fee_bps BETWEEN 0 AND 9999),
  fee_revision text NOT NULL CHECK (fee_revision ~ '^(0|[1-9][0-9]{0,19})$'),
  application_fee integer NOT NULL,
  checkout_id text UNIQUE CHECK (checkout_id ~ '^cs_[A-Za-z0-9_]+$'),
  checkout_url text,
  payment_intent text UNIQUE CHECK (payment_intent ~ '^pi_[A-Za-z0-9]+$'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','open','paid','failed','expired')),
  refunded_minor integer NOT NULL DEFAULT 0 CHECK (refunded_minor BETWEEN 0 AND amount_minor),
  dispute text NOT NULL DEFAULT 'none' CHECK (dispute IN ('none','open','won','lost')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dao_key,request_id),
  CHECK (application_fee=(amount_minor::bigint*fee_bps/10000)),
  CHECK (checkout_url IS NULL OR checkout_id IS NOT NULL)
);
CREATE INDEX dao_payment_orders_customer ON dao_payment_orders(customer_account, created_at DESC);
CREATE INDEX dao_payment_orders_dao ON dao_payment_orders(dao_key, created_at DESC);
CREATE TABLE dao_payment_refunds (
  request_id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES dao_payment_orders(id),
  amount_minor integer NOT NULL CHECK (amount_minor>0),
  stripe_refund text UNIQUE CHECK (stripe_refund ~ '^re_[A-Za-z0-9]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dao_payment_events (
  event_id text PRIMARY KEY CHECK (event_id ~ '^evt_[A-Za-z0-9]+$'),
  payload_hash bytea NOT NULL CHECK (octet_length(payload_hash)=32),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION keep_dao_payment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.request_id,NEW.dao_key,NEW.product_id,NEW.customer_reference,NEW.customer_account,NEW.stripe_account,NEW.title,NEW.module_id,NEW.amount_minor,NEW.fee_bps,NEW.fee_revision,NEW.application_fee,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.request_id,OLD.dao_key,OLD.product_id,OLD.customer_reference,OLD.customer_account,OLD.stripe_account,OLD.title,OLD.module_id,OLD.amount_minor,OLD.fee_bps,OLD.fee_revision,OLD.application_fee,OLD.created_at) THEN
    RAISE EXCEPTION 'Payment snapshot is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dao_payment_snapshot BEFORE UPDATE ON dao_payment_orders FOR EACH ROW EXECUTE FUNCTION keep_dao_payment_snapshot();
