ALTER TABLE signin_challenges ADD COLUMN context_hash bytea CHECK (context_hash IS NULL OR octet_length(context_hash)=32);
-- Outstanding challenges predate browser/session binding; users can request a new one.
UPDATE signin_challenges SET consumed_at=now() WHERE consumed_at IS NULL;
