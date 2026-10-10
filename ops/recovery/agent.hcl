pid_file = "/run/daclify-recovery/agent.pid"
vault { address = "https://keys.example.invalid:8200" }
auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config {
      role_id_file_path = "/etc/daclify-recovery/role-id"
      secret_id_file_path = "/etc/daclify-recovery/wrapped-secret-id"
      secret_id_response_wrapping_path = "auth/approle/role/daclify-recovery/secret-id"
      remove_secret_id_file_after_reading = true
    }
  }
  sink "file" {
    config { path = "/run/daclify-recovery/token" mode = 0600 }
  }
}
