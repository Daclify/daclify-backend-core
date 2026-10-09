#!/bin/bash
# Restore only into a unique disposable database, never an application database.
set -euo pipefail
umask 077
environment=${1:?Usage: restore-check.sh mainnet|testnet /absolute/path/to/backup.dump}
dump=${2:?A custom-format pg_dump file is required}
[[ "$environment" == mainnet || "$environment" == testnet ]] || exit 2
[[ -f "$dump" && "$dump" == /* ]] || exit 2
cd /data/daclify-backend-core/ops/hetzner
database="daclify_restore_${environment}_$(date +%s)_$$"
role="daclify_${environment}_app"
compose() { docker compose exec -T --user postgres postgres "$@"; }
compose createdb -U postgres -O "$role" "$database"
cleanup() { compose dropdb -U postgres --if-exists "$database"; }
trap cleanup EXIT
compose pg_restore -U postgres --role "$role" --dbname "$database" --single-transaction --exit-on-error --no-owner --no-acl < "$dump"
compose psql -U postgres -d "$database" -X -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS restored_tables FROM pg_tables WHERE schemaname = '\''public'\'';'
if [[ -n ${3:-} ]]; then
  expected=$3
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || exit 2
  actual=$(compose psql -U postgres -d "$database" -X -At -v ON_ERROR_STOP=1 -c 'SELECT id::text FROM accounts ORDER BY id;' | sha256sum)
  [[ "${actual%% *}" == "$expected" ]] || { echo 'Restored account IDs differ from expected IDs' >&2; exit 1; }
fi
echo "Restore completed in disposable database $database; cleanup follows."
