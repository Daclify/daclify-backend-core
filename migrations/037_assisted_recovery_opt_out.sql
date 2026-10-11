-- Revokes consent requests that were authorized before an account-wide opt-out.
ALTER TABLE vault_recovery_state ADD COLUMN assisted_revision integer NOT NULL DEFAULT 0 CHECK (assisted_revision>=0);
