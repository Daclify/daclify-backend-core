-- Run on an isolated restored database after applying all migrations and with API/workers stopped.
-- Retain account/provider records and replay markers; invalidate every restored live ceremony.
BEGIN;
UPDATE sessions SET revoked_at=COALESCE(revoked_at,now());
DELETE FROM vault_recovery_grants;
DELETE FROM vault_recovery_handoffs;
DELETE FROM vault_recovery_devices;
-- Keep encrypted originals, but do not resurrect permissions from stale pairings.
UPDATE vault_recovery_methods SET quarantined=true;
UPDATE challenges SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE signin_challenges SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE account_control_intents SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE native_login_intents SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE evm_signin_intents SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE evm_challenges SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE vault_attach_intents SET consumed_at=COALESCE(consumed_at,now()),expires_at=now();
UPDATE telegram_oidc_attempts SET consumed_at=COALESCE(consumed_at,now()),
  confirmed_at=COALESCE(confirmed_at,now()),expires_at=now(),
  proof_expires_at=CASE WHEN proof_expires_at IS NOT NULL THEN now() ELSE NULL END;
COMMIT;
