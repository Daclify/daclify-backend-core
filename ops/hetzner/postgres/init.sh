#!/bin/bash
set -euo pipefail
export MAINNET_PASSWORD TESTNET_PASSWORD
MAINNET_PASSWORD=$(cat /run/secrets/mainnet_password)
TESTNET_PASSWORD=$(cat /run/secrets/testnet_password)
psql --username postgres --dbname postgres --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
\getenv mainnet_password MAINNET_PASSWORD
\getenv testnet_password TESTNET_PASSWORD
CREATE ROLE daclify_mainnet_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE daclify_testnet_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE daclify_mainnet_app PASSWORD :'mainnet_password';
ALTER ROLE daclify_testnet_app PASSWORD :'testnet_password';
CREATE DATABASE daclify_mainnet OWNER daclify_mainnet_app;
CREATE DATABASE daclify_testnet OWNER daclify_testnet_app;
REVOKE ALL ON DATABASE daclify_mainnet FROM PUBLIC, daclify_testnet_app;
REVOKE ALL ON DATABASE daclify_testnet FROM PUBLIC, daclify_mainnet_app;
REVOKE ALL ON DATABASE postgres FROM PUBLIC, daclify_mainnet_app, daclify_testnet_app;
REVOKE ALL ON DATABASE template1 FROM PUBLIC, daclify_mainnet_app, daclify_testnet_app;
SQL
unset MAINNET_PASSWORD TESTNET_PASSWORD
for database in daclify_mainnet daclify_testnet; do
  psql --username postgres --dbname "$database" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
done
