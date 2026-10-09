#!/bin/bash
set -euo pipefail
umask 077
exec 9>/run/lock/daclify-haproxy-cert.lock
flock 9
lineage=${RENEWED_LINEAGE:-/etc/letsencrypt/live/daclify-api}
# Ignore unrelated certificate renewals.
[[ "$lineage" == /etc/letsencrypt/live/daclify-api ]] || exit 0
target=/etc/haproxy/certs/daclify-api.pem
candidate=$(mktemp /etc/haproxy/certs/.daclify-api.XXXXXX)
validation=$(mktemp /etc/haproxy/.daclify-validate.XXXXXX)
backup=$(mktemp /etc/haproxy/certs/.daclify-backup.XXXXXX)
had_old=false
published=false
success=false
cleanup() {
  if [[ "$published" == true && "$success" != true ]]; then
    if [[ "$had_old" == true ]]; then
      mv -f "$backup" "$target"
      systemctl reload haproxy || true
    else
      rm -f "$target"
    fi
  fi
  rm -f "$candidate" "$validation" "$backup"
}
trap cleanup EXIT
cat "$lineage/fullchain.pem" "$lineage/privkey.pem" > "$candidate"
chmod 600 "$candidate"
openssl x509 -in "$candidate" -noout -checkend 86400 > /dev/null
openssl x509 -in "$candidate" -noout -checkhost api.daclify.com > /dev/null
openssl x509 -in "$candidate" -noout -checkhost testnet.api.daclify.com > /dev/null
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt -untrusted "$lineage/chain.pem" "$lineage/cert.pem" > /dev/null
cert_public=$(openssl x509 -in "$candidate" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum)
key_public=$(openssl pkey -in "$candidate" -pubout -outform DER | sha256sum)
[[ "$cert_public" == "$key_public" ]] || { echo 'Certificate/key mismatch' >&2; exit 1; }
sed "s|$target|$candidate|g" /etc/haproxy/haproxy.cfg > "$validation"
/usr/sbin/haproxy -c -f "$validation"
if [[ -f "$target" ]]; then
  cp -p "$target" "$backup"
  had_old=true
fi
mv -f "$candidate" "$target"
published=true
/usr/sbin/haproxy -c -f /etc/haproxy/haproxy.cfg
systemctl reload haproxy
systemctl is-active --quiet haproxy
success=true
