ui = false
disable_mlock = true
api_addr = "https://keys.example.invalid:8200"
cluster_addr = "https://keys.example.invalid:8201"
storage "raft" {
  path = "/var/lib/openbao"
  node_id = "daclify-recovery-1"
}
listener "tcp" {
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_cert_file = "/etc/openbao/tls/fullchain.pem"
  tls_key_file = "/etc/openbao/tls/privkey.pem"
  tls_min_version = "tls12"
}
audit "file" "recovery" {
  options {
    file_path = "/var/log/openbao/audit.jsonl"
    log_raw = "false"
  }
}
