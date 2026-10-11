-- Origin preserves recovery checks while allowing a new native profile to return before joining a DAO.
ALTER TABLE accounts ADD COLUMN wallet_origin text CHECK (wallet_origin IS NULL OR wallet_origin='signup');
ALTER TABLE native_login_intents DROP CONSTRAINT native_login_intents_purpose_check;
ALTER TABLE native_login_intents DROP CONSTRAINT native_login_intents_check;
ALTER TABLE native_login_intents ADD CONSTRAINT native_login_intents_purpose_check CHECK (purpose IN ('login','pair','signup'));
ALTER TABLE native_login_intents ADD CONSTRAINT native_login_intents_check CHECK (
  (purpose IN ('login','signup') AND account_id IS NULL AND session_hash IS NULL) OR
  (purpose='pair' AND account_id IS NOT NULL AND session_hash IS NOT NULL)
);
