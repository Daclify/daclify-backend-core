CREATE TABLE creation_orders (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  reference text NOT NULL UNIQUE CHECK(reference ~ '^[0-9a-f]{64}$'),
  dao_id numeric(20,0) NOT NULL CHECK(dao_id>0 AND dao_id<=18446744073709551615),
  chain_id text NOT NULL CHECK(chain_id ~ '^[0-9a-f]{64}$'),
  runtime text NOT NULL,
  request jsonb NOT NULL,
  checkout_id text UNIQUE,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((checkout_id IS NULL) = (checkout_url IS NULL))
);
CREATE INDEX creation_orders_account ON creation_orders(account_id,created_at);
