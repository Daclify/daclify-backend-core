#!/usr/bin/python3
"""Validate isolation and live prerequisites, then enable the selected API."""
import os
import pathlib
import subprocess
import sys
from urllib.parse import urlsplit


def read_env(path):
    if path.stat().st_mode & 0o077:
        raise ValueError("ENV_FILE_PERMISSIONS")
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def check_separation(mainnet, testnet):
    fields = ["RELAY_PRIVATE_KEY", "BOOTSTRAP_PRIVATE_KEY", "STRIPE_SECRET_KEY",
              "STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_WEBHOOK_SECRET",
              "DACLIFY_HOSTING_WEBHOOK_SECRET", "DACLIFY_STORAGE_WEBHOOK_SECRET",
              "DACLIFY_RAM_WEBHOOK_SECRET", "PINATA_JWT", "CONTENT_GATEWAY_KEY", "SMTP_PASSWORD",
              "ARCHIVE_BACKUP_KEY", "TELEGRAM_OIDC_CLIENT_SECRET", "TELEGRAM_BOT_TOKEN",
              "OPENROUTER_API_KEY"]
    left = {mainnet[key] for key in fields if mainnet.get(key) and "replace" not in mainnet[key]}
    right = {testnet[key] for key in fields if testnet.get(key) and "replace" not in testnet[key]}
    if left & right:
        raise ValueError("SHARED_ENVIRONMENT_SECRET")
    for field in ["password", "username"]:
        if getattr(urlsplit(mainnet["DATABASE_URL"]), field) == getattr(urlsplit(testnet["DATABASE_URL"]), field):
            raise ValueError("SHARED_DATABASE_CREDENTIAL")
    accounts = ["RUNTIME_ACCOUNT", "HUB_ACCOUNT", "RELAY_ACCOUNT", "BOOTSTRAP_OWNER"]
    if {mainnet[k] for k in accounts if mainnet.get(k)} & {testnet[k] for k in accounts if testnet.get(k)}:
        raise ValueError("SHARED_BLOCKCHAIN_ACCOUNT")


def main():
    if os.geteuid() != 0 or len(sys.argv) != 2 or sys.argv[1] not in ("mainnet", "testnet"):
        raise ValueError("Usage as root: start-api.py mainnet|testnet")
    environment = sys.argv[1]
    directory = pathlib.Path("/data/daclify-env")
    check_separation(read_env(directory / "mainnet.env"), read_env(directory / "testnet.env"))
    selected = pathlib.Path("/data/daclify-api") / environment / "current"
    if not selected.exists():
        raise ValueError("SELECT_VERIFIED_ENVIRONMENT_RELEASE_FIRST")
    release = selected.resolve(strict=True)
    if not release.is_relative_to(selected.parent / "releases"):
        raise ValueError("RELEASE_ENVIRONMENT_MISMATCH")
    core = release / "daclify-backend-core"
    compiled = core / "dist/tools/host/preflight.js"
    if not compiled.is_file():
        raise ValueError("API_BUILD_REQUIRED")
    child_env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "DACLIFY_ENV_FILE": str(directory / (environment + ".env"))}
    subprocess.run(["/usr/local/bin/node", str(compiled), environment], env=child_env, cwd=core, check=True)
    subprocess.run(["systemctl", "enable", "--now", "daclify-api-" + environment + ".service"], check=True)


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("API_START_PREREQUISITE_FAILED", file=sys.stderr)
        sys.exit(1)
