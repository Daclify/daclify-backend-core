-- A manifest and its verified chunks form one retained hosting unit.
CREATE TABLE hosted_archive_members (
 dao_key text NOT NULL,
 provider_scope text NOT NULL,
 bundle_key text NOT NULL CHECK(length(bundle_key) BETWEEN 1 AND 256),
 object_id uuid NOT NULL,
 PRIMARY KEY(dao_key,provider_scope,bundle_key,object_id),
 FOREIGN KEY(object_id,provider_scope) REFERENCES hosted_objects(id,provider_scope)
);
CREATE INDEX hosted_archive_member_object ON hosted_archive_members(object_id,dao_key);
