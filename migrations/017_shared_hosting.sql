-- Approved recurring service capacity; no token treasury or membership identities are changed.
CREATE TABLE hosting_prices (
  policy_key text PRIMARY KEY CHECK (policy_key ~ '^[a-f0-9]{64}$'),
  pricing jsonb NOT NULL,
  stripe_price text UNIQUE CHECK (stripe_price ~ '^price_[A-Za-z0-9]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE hosting_subscriptions (
  id uuid PRIMARY KEY,
  dao_key text NOT NULL,
  dao jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES accounts(id),
  request_id uuid NOT NULL UNIQUE,
  pricing jsonb NOT NULL,
  extra_slots integer NOT NULL CHECK (extra_slots BETWEEN 1 AND 4999),
  price_key text NOT NULL REFERENCES hosting_prices(policy_key),
  stripe_subscription text UNIQUE CHECK (stripe_subscription ~ '^sub_[A-Za-z0-9]+$'),
  checkout_id text UNIQUE CHECK (checkout_id ~ '^cs_[A-Za-z0-9_]+$'),
  checkout_url text,
  invoice_url text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','active','past-due','canceling','ended','review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (dao_key='["' || (dao->>'chainId') || '","' || (dao->>'contract') || '","' || (dao->>'daoId') || '",1]'),
  CHECK (dao ?& ARRAY['chainId','contract','daoId','interfaceVersion'] AND dao->>'interfaceVersion'='1'),
  CHECK ((pricing->>'freeSlots')::integer BETWEEN 1 AND 5000 AND extra_slots+(pricing->>'freeSlots')::integer<=5000),
  CHECK (checkout_url IS NULL OR checkout_id IS NOT NULL)
);
CREATE UNIQUE INDEX hosting_one_current_subscription ON hosting_subscriptions(dao_key) WHERE state<>'ended';
CREATE INDEX hosting_subscriptions_operator ON hosting_subscriptions(created_by);
CREATE TABLE hosting_changes (
  request_id uuid PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES hosting_subscriptions(id),
  pricing jsonb NOT NULL,
  price_key text NOT NULL REFERENCES hosting_prices(policy_key),
  extra_slots integer NOT NULL CHECK (extra_slots BETWEEN 0 AND 4999),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','applied','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (extra_slots+(pricing->>'freeSlots')::integer<=5000)
);
CREATE UNIQUE INDEX hosting_one_pending_change ON hosting_changes(subscription_id) WHERE state='pending';
CREATE TABLE hosting_invoices (
  invoice_id text PRIMARY KEY CHECK (invoice_id ~ '^in_[A-Za-z0-9]+$'),
  subscription_id uuid NOT NULL REFERENCES hosting_subscriptions(id),
  receipt text NOT NULL UNIQUE CHECK (receipt ~ '^[a-f0-9]{64}$'),
  members integer NOT NULL CHECK (members BETWEEN 2 AND 5000),
  expires bigint NOT NULL CHECK (expires BETWEEN 1 AND 4294967295),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','settled','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE hosting_events (
  event_id text PRIMARY KEY CHECK (event_id ~ '^evt_[A-Za-z0-9]+$'),
  payload_hash bytea NOT NULL CHECK (octet_length(payload_hash)=32),
  received_at timestamptz NOT NULL DEFAULT now()
);
