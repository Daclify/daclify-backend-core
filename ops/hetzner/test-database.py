#!/usr/bin/python3
"""Verify real isolation and restore synthetic accounts in disposable databases."""
import hashlib
import os
import pathlib
import subprocess
import tempfile
import time

OPS = pathlib.Path(__file__).resolve().parent


def run(*args, input=None, env=None, check=True):
    return subprocess.run(["docker", "compose", "exec", "-T", *args], cwd=OPS,
                          input=input, env=env, capture_output=True, check=check)


def admin(*args, input=None):
    return run("--user", "postgres", "postgres", *args, input=input).stdout


def main():
    for environment in ("mainnet", "testnet"):
        password = (pathlib.Path("/etc/daclify/postgres") / (environment + "-password")).read_text().strip()
        peer = "testnet" if environment == "mainnet" else "mainnet"
        for database in ("daclify_" + environment, "daclify_" + peer, "postgres"):
            result = run("--env", "PGPASSWORD", "postgres", "psql", "-X", "-h", "127.0.0.1",
                         "-U", "daclify_" + environment + "_app", "-d", database, "-At", "-c", "SELECT current_user;",
                         env=dict(os.environ, PGPASSWORD=password), check=False)
            assert (result.returncode == 0) == (database == "daclify_" + environment)
        privileged = admin("psql", "-X", "-U", "postgres", "-d", "postgres", "-At", "-c",
                           "SELECT count(*) FROM pg_roles WHERE rolname='daclify_" + environment + "_app' "
                           "AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls);")
        assert privileged.strip() == b"0"
        # Grants must deny cross-database CONNECT independently of HBA rejection.
        grant = admin("psql", "-X", "-U", "postgres", "-d", "postgres", "-At", "-c",
                      "SELECT has_database_privilege('daclify_" + environment + "_app','daclify_" + peer + "','CONNECT');")
        assert grant.strip() == b"f"
        source = "daclify_backup_fixture_" + environment + "_" + str(int(time.time()))
        admin("createdb", "-U", "postgres", "-O", "daclify_" + environment + "_app", source)
        try:
            ids = b"10000000-0000-4000-8000-000000000001\n10000000-0000-4000-8000-000000000002\n"
            admin("psql", "-X", "-U", "postgres", "-d", source, "-v", "ON_ERROR_STOP=1", input=(
                "SET ROLE daclify_" + environment + "_app;\nCREATE TABLE accounts(id uuid PRIMARY KEY);\n"
                "INSERT INTO accounts VALUES ('10000000-0000-4000-8000-000000000001'),"
                "('10000000-0000-4000-8000-000000000002');\n").encode())
            dump = admin("pg_dump", "-U", "postgres", "-d", source, "--format=custom", "--no-owner", "--no-acl")
            with tempfile.TemporaryDirectory(prefix="daclify-restore-fixture-") as temporary:
                path = pathlib.Path(temporary) / "fixture.dump"
                path.write_bytes(dump)
                path.chmod(0o600)
                subprocess.run([str(OPS / "restore-check.sh"), environment, str(path), hashlib.sha256(ids).hexdigest()], check=True)
        finally:
            admin("dropdb", "-U", "postgres", "--if-exists", source)
    print("Real PostgreSQL: dedicated nonprivileged roles, cross-database denial and restores preserving fixture account IDs passed.")


if __name__ == "__main__":
    main()
