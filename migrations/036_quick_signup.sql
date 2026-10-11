ALTER TABLE signin_challenges DROP CONSTRAINT signin_challenges_purpose_check;
ALTER TABLE signin_challenges ADD CONSTRAINT signin_challenges_purpose_check
 CHECK (purpose IN ('passkey-register','passkey-login','email-link','email-login','email-signup'));
ALTER TABLE telegram_oidc_attempts DROP CONSTRAINT telegram_oidc_attempts_purpose_check;
ALTER TABLE telegram_oidc_attempts ADD CONSTRAINT telegram_oidc_attempts_purpose_check CHECK (purpose IN ('login','pair','signup'));
ALTER TABLE telegram_oidc_attempts DROP CONSTRAINT telegram_oidc_attempts_check;
ALTER TABLE telegram_oidc_attempts ADD CONSTRAINT telegram_oidc_attempts_check
 CHECK ((purpose IN ('login','signup') AND account_id IS NULL AND session_hash IS NULL)
 OR (purpose='pair' AND account_id IS NOT NULL AND session_hash IS NOT NULL));

-- Browser-bound ceremonies expire; account rows retain any committed assistance history.
CREATE TABLE quick_signup_attempts (
 id uuid PRIMARY KEY,
 credential_key text NOT NULL CHECK (length(credential_key)<=512 AND credential_key ~ '^(email|telegram):[^[:cntrl:]]+$'),
 browser_hash bytea NOT NULL CHECK (octet_length(browser_hash)=32),
 origin text NOT NULL CHECK (length(origin)<=2048),
 planned_account_id uuid NOT NULL,
 staged_account_id uuid REFERENCES accounts(id),
 context jsonb CHECK (octet_length(context::text)<=4096),
 message text CHECK (length(message)<=4096),
 private_wrap text CHECK (length(private_wrap)<=8192),
 recipient jsonb CHECK (octet_length(recipient::text)<=1024),
 authorized_at timestamptz, completed_at timestamptz,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((context IS NULL)=(message IS NULL)),
 CHECK ((private_wrap IS NULL)=(recipient IS NULL)),
 CHECK (completed_at IS NULL OR authorized_at IS NOT NULL)
);
CREATE INDEX quick_signup_expiry ON quick_signup_attempts(expires_at,id);
CREATE INDEX quick_signup_pending_account ON quick_signup_attempts(staged_account_id)
 WHERE staged_account_id IS NOT NULL AND completed_at IS NULL;

-- This small marker survives ceremony cleanup and prevents incomplete accounts from opening sessions.
CREATE TABLE quick_signup_pending_accounts (
 account_id uuid PRIMARY KEY REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
