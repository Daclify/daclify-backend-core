CREATE TABLE module_fee_orders (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  dao_key text NOT NULL CHECK(length(dao_key)<=128),
  module_account text NOT NULL CHECK(module_account ~ '^[a-z1-5.]{1,12}$'),
  approval jsonb NOT NULL CHECK(jsonb_typeof(approval)='object' AND approval->>'schemaVersion'='1'),
  stripe_account text NOT NULL CHECK(stripe_account ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','paid','active','refunding','refunded','revoked','expired','review')),
  checkout_id text UNIQUE,
  checkout_url text,
  payment_intent text,
  receipt text CHECK(receipt ~ '^[0-9a-f]{64}$'),
  expected_receipt text CHECK(expected_receipt ~ '^[0-9a-f]{64}$'),
  starts bigint CHECK(starts BETWEEN 0 AND 4294967295),
  expires bigint CHECK(expires BETWEEN 0 AND 4294967295),
  created_at timestamptz NOT NULL DEFAULT now(),
  next_check_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((receipt IS NULL AND starts IS NULL AND expires IS NULL AND expected_receipt IS NULL) OR
         (receipt IS NOT NULL AND starts IS NOT NULL AND expires>starts AND expected_receipt IS NOT NULL)),
  CHECK((checkout_id IS NULL)=(checkout_url IS NULL)),
  UNIQUE(stripe_account,livemode,payment_intent)
);
-- One unfinished purchase per module prevents competing checkouts charging for the same month.
CREATE UNIQUE INDEX module_fee_pending ON module_fee_orders(dao_key,module_account)
  WHERE state IN ('pending','paid','refunding','review');
-- Bounded payment recovery polling; completed history is not scanned.
CREATE INDEX module_fee_due ON module_fee_orders(next_check_at,id)
  WHERE state IN ('pending','paid','active','revoked','refunding');
