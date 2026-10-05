ALTER TABLE uploads
  ADD COLUMN request_id uuid,
  ADD COLUMN intent jsonb,
  ADD COLUMN request_hash text,
  ADD COLUMN member_id numeric(20,0),
  ADD COLUMN last_error_code text;

ALTER TABLE uploads ADD CONSTRAINT uploads_versioned_intent CHECK (
  (request_id IS NULL AND intent IS NULL AND request_hash IS NULL AND member_id IS NULL)
  OR (request_id IS NOT NULL AND intent IS NOT NULL AND request_hash IS NOT NULL AND member_id IS NOT NULL
      AND jsonb_typeof(intent)='object' AND (intent->>'schemaVersion') IS NOT DISTINCT FROM '1'
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND member_id>0 AND member_id<=18446744073709551615)
);
CREATE UNIQUE INDEX uploads_account_request ON uploads(account_id,request_id) WHERE request_id IS NOT NULL;
