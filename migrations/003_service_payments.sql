-- Card receipts for the configured Stripe price. They do not change DAO votes,
-- permissions, withdrawals, treasury obligations, or storage entitlements.
CREATE TABLE service_payments (
  checkout_id text PRIMARY KEY CHECK (checkout_id ~ '^cs_[A-Za-z0-9_]+$'),
  account_id uuid NOT NULL REFERENCES accounts(id),
  price_id text NOT NULL CHECK (price_id ~ '^price_[A-Za-z0-9]+$'),
  currency text CHECK (currency IS NULL OR currency ~ '^[a-z]{3}$'),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  status text NOT NULL CHECK (status IN ('paid', 'failed')),
  payment_status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_payments_account ON service_payments(account_id, updated_at DESC);
