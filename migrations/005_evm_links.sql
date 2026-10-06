CREATE TABLE evm_challenges (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  chain_id integer NOT NULL CHECK (chain_id IN (40, 41)),
  nonce text NOT NULL CHECK (char_length(nonce) BETWEEN 16 AND 32),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evm_challenges_open ON evm_challenges(account_id, chain_id) WHERE consumed_at IS NULL;
CREATE TABLE evm_links (
  account_id uuid NOT NULL REFERENCES accounts(id),
  chain_id integer NOT NULL CHECK (chain_id IN (40, 41)),
  address text NOT NULL CHECK (address ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, chain_id)
);
CREATE UNIQUE INDEX evm_links_address ON evm_links(chain_id, address);
