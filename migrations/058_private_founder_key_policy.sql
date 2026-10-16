-- Strict-private founder checks match either known public key, including an agent identity.
CREATE INDEX accounts_encryption_key ON accounts(encryption_key);
