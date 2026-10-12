-- One bounded row per revision; no data keys or profile plaintext are stored.
CREATE TABLE profile_key_revisions (
  chain_id text NOT NULL CHECK (chain_id ~ '^[0-9a-f]{64}$'),
  runtime text NOT NULL CHECK (runtime ~ '^[a-z1-5][a-z1-5.]{0,12}$'),
  dao_id numeric(20,0) NOT NULL CHECK (dao_id BETWEEN 1 AND 18446744073709551615),
  member_id numeric(20,0) NOT NULL CHECK (member_id BETWEEN 1 AND 18446744073709551615),
  profile_revision uuid NOT NULL,
  owner_account_id uuid NOT NULL REFERENCES accounts(id),
  ciphertext_commitment text NOT NULL CHECK (ciphertext_commitment ~ '^[0-9a-f]{64}$'),
  grants jsonb NOT NULL CHECK (
    jsonb_typeof(grants)='array' AND jsonb_array_length(grants) BETWEEN 1 AND 64
    AND octet_length(grants::text)<=65536
  ),
  state text NOT NULL CHECK (state IN ('staged','active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CHECK ((state='staged' AND expires_at IS NOT NULL) OR (state='active' AND expires_at IS NULL)),
  PRIMARY KEY(chain_id,runtime,dao_id,member_id,profile_revision)
);
-- Exact current-profile selection and concurrent activation uniqueness.
CREATE UNIQUE INDEX profile_key_current ON profile_key_revisions(chain_id,runtime,dao_id,member_id) WHERE state='active';
-- Account erasure and bounded orphan cleanup; recipient fetches use the primary key.
CREATE INDEX profile_key_owner ON profile_key_revisions(owner_account_id);
CREATE INDEX profile_key_expiry ON profile_key_revisions(expires_at) WHERE state='staged';
