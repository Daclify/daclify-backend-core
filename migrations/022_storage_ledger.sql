CREATE TABLE hosted_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_scope text NOT NULL CHECK(length(provider_scope) BETWEEN 1 AND 128),
  import_profile text NOT NULL CHECK(import_profile='public-cidv1-file-v1'),
  cid text NOT NULL CHECK(length(cid) BETWEEN 1 AND 128),
  verified_bytes bigint NOT NULL CHECK(verified_bytes>0 AND verified_bytes<=5242880),
  commitment text NOT NULL CHECK(commitment ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'pinned' CHECK(state IN ('pinned','removing','removed','review')),
  generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_scope,import_profile,cid),
  UNIQUE(id,provider_scope)
);
CREATE INDEX hosted_objects_digest ON hosted_objects(provider_scope,import_profile,commitment,verified_bytes) WHERE state='pinned';
CREATE TABLE hosted_pins (
  provider_scope text NOT NULL,
  provider_id uuid NOT NULL,
  object_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'pinned' CHECK(state IN ('pinned','removing','removed','review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider_scope,provider_id),
  FOREIGN KEY(object_id,provider_scope) REFERENCES hosted_objects(id,provider_scope)
);
CREATE INDEX hosted_pins_object ON hosted_pins(object_id,state);
CREATE TABLE hosted_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES hosted_objects(id),
  dao_key text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('document-version','branding','media','archive')),
  reference_key text NOT NULL CHECK(length(reference_key) BETWEEN 1 AND 256),
  upload_id uuid UNIQUE REFERENCES uploads(id),
  generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dao_key,kind,reference_key,object_id)
);
CREATE INDEX hosted_references_usage ON hosted_references(dao_key,object_id);
CREATE INDEX hosted_references_global ON hosted_references(object_id);
ALTER TABLE uploads DROP CONSTRAINT uploads_provider_id_key;
ALTER TABLE uploads
  ADD COLUMN provider_scope text,
  ADD COLUMN import_profile text,
  ADD COLUMN storage_object_id uuid,
  ADD CONSTRAINT uploads_storage_scope CHECK (
    (provider_scope IS NULL AND import_profile IS NULL AND storage_object_id IS NULL)
    OR (provider_scope IS NOT NULL AND length(provider_scope) BETWEEN 1 AND 128 AND import_profile IS NOT NULL AND import_profile='public-cidv1-file-v1')
  ),
  ADD CONSTRAINT uploads_storage_object FOREIGN KEY(storage_object_id,provider_scope) REFERENCES hosted_objects(id,provider_scope);
CREATE INDEX uploads_storage_object ON uploads(storage_object_id);
-- Legacy rows keep their full reservation. Ownership and bytes must be explicitly reconciled, never inferred from a CID.
UPDATE uploads SET last_error_code='STORAGE_OWNERSHIP_REVIEW' WHERE request_id IS NOT NULL;
