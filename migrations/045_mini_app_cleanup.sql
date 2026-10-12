-- Only app-scoped pointers are kept through the finite exit-report window.
ALTER TABLE connected_app_subjects ADD COLUMN member_id numeric(20,0) CHECK(member_id>0 AND member_id<=18446744073709551615);
ALTER TABLE account_exit_app_subjects ADD COLUMN member_id numeric(20,0) CHECK(member_id>0 AND member_id<=18446744073709551615);
ALTER TABLE connected_app_subjects ADD COLUMN configuration_hash text CHECK(configuration_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE account_exit_app_subjects ADD COLUMN configuration_hash text CHECK(configuration_hash ~ '^[a-f0-9]{64}$');
CREATE FUNCTION require_stable_app_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.member_id IS NOT NULL AND NEW.member_id IS DISTINCT FROM OLD.member_id THEN
  RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='connected_app_subject_member_immutable',MESSAGE='App native member binding is immutable';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER connected_app_subject_stable_member BEFORE UPDATE ON connected_app_subjects FOR EACH ROW EXECUTE FUNCTION require_stable_app_member();
CREATE TABLE mini_app_cleanup_notices (
 event_id uuid PRIMARY KEY,
 operation_id uuid NOT NULL REFERENCES account_exit_operations(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 subject uuid,member_id numeric(20,0) CHECK(member_id>0 AND member_id<=18446744073709551615),
 binding jsonb CHECK(octet_length(binding::text)<=2048),
 configuration jsonb CHECK(octet_length(configuration::text)<=8192),
 configuration_hash text CHECK(configuration_hash ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN('membership-left','account-erased')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','confirmed','retained','unavailable')),
 reason text NOT NULL DEFAULT 'APP_CLEANUP_PENDING' CHECK(length(reason)<=64),
 acknowledgment jsonb CHECK(octet_length(acknowledgment::text)<=2048),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 12),
 due_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 lease_owner uuid,lease_until timestamptz,
 UNIQUE(operation_id,client_id,subject),
 CHECK((lease_owner IS NULL)=(lease_until IS NULL))
);
CREATE INDEX mini_app_cleanup_due ON mini_app_cleanup_notices(operation_id,due_at) WHERE state='pending';
CREATE INDEX mini_app_cleanup_expiry ON mini_app_cleanup_notices(expires_at) WHERE subject IS NOT NULL;
