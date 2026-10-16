-- Sealed setup includes ciphertext and the founder's wrapped epoch key, never plaintext keys.
ALTER TABLE creation_orders ADD CONSTRAINT creation_orders_request_bytes CHECK(octet_length(request::text)<=65536);
ALTER TABLE dao_claim_links DROP CONSTRAINT dao_claim_links_request_check;
ALTER TABLE dao_claim_links ADD CONSTRAINT dao_claim_links_request_check CHECK(request IS NULL OR octet_length(request::text)<=65536);
