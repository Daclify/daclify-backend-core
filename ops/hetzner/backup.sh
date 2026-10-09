#!/bin/bash
set -euo pipefail
umask 077
exec 9>/run/lock/daclify-backup.lock
flock -n 9 || exit 0
cd /data/daclify-backend-core/ops/hetzner
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for environment in mainnet testnet; do
  directory=/var/backups/daclify/$environment
  install -d -m 700 "$directory"
  pending=$(mktemp "$directory/.pending.XXXXXX")
  trap 'rm -f "$pending"' EXIT
  docker compose exec -T --user postgres postgres pg_dump -U postgres -d "daclify_$environment" --format=custom --no-owner --no-acl > "$pending"
  docker compose exec -T --user postgres postgres pg_restore --list < "$pending" > /dev/null
  target="$directory/$stamp.dump"
  mv "$pending" "$target"
  sha256sum "$target" > "$target.sha256"
  trap - EXIT
done
# No automatic deletion: select retention and off-VM backup storage explicitly.
