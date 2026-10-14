CREATE TABLE connected_app_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES connected_apps(id),
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 revision numeric(20,0) NOT NULL CHECK(revision>0 AND revision<=18446744073709551615),
 invitation_id numeric(20,0) NOT NULL CHECK(invitation_id>0 AND invitation_id<=18446744073709551615),
 request jsonb NOT NULL, revoke boolean NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(client_id,invitation_id,revoke)
);
-- Finite ceremony retention and bounded worker cleanup; native receipts own consumption.
CREATE INDEX connected_app_invitations_expiry ON connected_app_invitations(expires_at);
