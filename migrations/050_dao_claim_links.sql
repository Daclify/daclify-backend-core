-- id is also the reserved creation-order id; no second order-id field/index is needed.
CREATE TABLE dao_claim_links (
  id uuid PRIMARY KEY,
  issuer_account_id uuid NOT NULL REFERENCES accounts(id),
  claimant_account_id uuid REFERENCES accounts(id),
  request jsonb CHECK(request IS NULL OR octet_length(request::text)<=32768),
  chain_id text NOT NULL CHECK(chain_id ~ '^[0-9a-f]{64}$'),
  runtime text NOT NULL CHECK(runtime ~ '^[a-z1-5.]{1,12}$'),
  token_hash text UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
  revoked_at timestamptz,
  method text CHECK(method IN('free','card','tlos')),
  completed_at timestamptz,
  CHECK((claimant_account_id IS NULL)=(method IS NULL)),
  CHECK(completed_at IS NULL OR claimant_account_id IS NOT NULL)
);
-- Bounded issuer lists and small expiry batches are the only scans.
CREATE INDEX dao_claim_links_issuer ON dao_claim_links(issuer_account_id,expires_at DESC);
CREATE INDEX dao_claim_links_expiry ON dao_claim_links(expires_at) WHERE token_hash IS NOT NULL;
