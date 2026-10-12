CREATE SCHEMA IF NOT EXISTS mini_app;
CREATE TABLE IF NOT EXISTS mini_app.bindings (
 namespace text PRIMARY KEY CHECK(namespace ~ '^[0-9a-f]{64}$'),
 value jsonb NOT NULL CHECK(octet_length(value::text)<=2048)
);
CREATE TABLE IF NOT EXISTS mini_app.actors (
 namespace text NOT NULL REFERENCES mini_app.bindings(namespace),
 subject uuid NOT NULL,
 member_id numeric(20,0) NOT NULL CHECK(member_id>0 AND member_id<=18446744073709551615),
 PRIMARY KEY(namespace,subject,member_id),
 UNIQUE(namespace,subject), UNIQUE(namespace,member_id)
);
CREATE TABLE IF NOT EXISTS mini_app.tasks (
 namespace text NOT NULL REFERENCES mini_app.bindings(namespace),
 id text NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
 value jsonb NOT NULL CHECK(octet_length(value::text)<=32768),
 PRIMARY KEY(namespace,id)
);
CREATE TABLE IF NOT EXISTS mini_app.outbox (
 namespace text NOT NULL REFERENCES mini_app.bindings(namespace),
 event_id text NOT NULL CHECK(event_id ~ '^[0-9a-f]{64}$'),
 source_id text NOT NULL CHECK(source_id ~ '^[0-9a-f]{64}$'),
 member_id numeric(20,0) NOT NULL, subject uuid NOT NULL,
 intent jsonb NOT NULL CHECK(octet_length(intent::text)<=8192),
 snapshot jsonb NOT NULL CHECK(octet_length(snapshot::text)<=65536),
 needs_evidence boolean NOT NULL DEFAULT false, confirmed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(namespace,event_id), UNIQUE(namespace,source_id),
 FOREIGN KEY(namespace,subject,member_id) REFERENCES mini_app.actors(namespace,subject,member_id)
);
-- These indexes enforce scope/ownership and serve the example's exact lookups.
-- source_id is unique only because this example permits one completion per task.
