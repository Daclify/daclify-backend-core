# The API can encrypt/decrypt under one pre-created key. It cannot create,
# export, rotate, delete or back up transit keys or change its own permissions.
path "transit/encrypt/content-recovery-v1" { capabilities = ["update"] }
path "transit/decrypt/content-recovery-v1" { capabilities = ["update"] }
path "auth/token/renew-self" { capabilities = ["update"] }
path "auth/token/lookup-self" { capabilities = ["read"] }
