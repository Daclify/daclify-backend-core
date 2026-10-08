# Hosted storage accounting — development branch

The backend counts one verified CID once per DAO, regardless of how many document versions or other hosted roles reference it. Different DAOs each count those bytes against their own capacity. A global ledger within the environment keeps every provider file ID for shared or duplicate pins. Multiple provider IDs do not multiply the DAO's logical usage.

Files count at their final stored size: private files include the encrypted envelope. Provider size, retrieved length and SHA-256 commitment must agree before a reference becomes verified. A CID is not assumed to be the SHA-256 of the original file; DAG imports can produce different CIDs. Only objects from the configured public CID-v1 single-file import profile can be reused, and reused bytes are retrieved and checked again.

An upload whose provider outcome is unknown still holds its expected bytes. Expiration or an empty provider listing cannot release that reservation. Externally supplied on-chain CIDs do not create Pinata ownership or storage charges. Archived content, versions, branding and media share normal storage pricing when they have hosted references; the Archive lifecycle is still being implemented.

`GET /v1/daos/:id/storage` requires an authenticated active member of that exact deployment. It returns configured capacity, unique verified bytes, unresolved held bytes, object/reference counts and the disabled cleanup state. No filenames or provider credentials are returned. Storage capacity is a server allowance at this checkpoint; the planned independent prepaid storage subscription is not yet enabled.

## Provider ownership

Mainnet and testnet use **separate Pinata accounts**, credentials, gateways, stable `PINATA_ACCOUNT_ID` values and databases. Keep an ownership ID unchanged when rotating credentials for the same account. Use a different ID for a different provider account. This ID is an operator-supplied namespace, not proof that a JWT belongs to that account; live credential/ownership qualification is required before destructive cleanup.

Do not run two independent reference databases against the same Pinata account. Their local reference counts cannot protect each other's pins. Every DAO using one account must participate in that environment's global ledger.

Configure all three `PINATA_JWT`, `PINATA_ACCOUNT_ID` and `CONTENT_GATEWAY`, or none. `CONTENT_FREE_STORAGE_BYTES=100000000` is the approved 100 MB decimal launch allowance per DAO. The examples retain `0` until the operator funds/configures hosting. Files remain bounded to 5 MiB per request.

## Existing uploads

Migration `022_storage_ledger.sql` preserves upload IDs, provider IDs, CIDs, commitments and full unresolved reservations. It does not infer provider ownership or trust old declared bytes. Previously verified receipts remain readable, but ordinary workers place unclaimed rows in manual review. Unversioned rows without a complete intent require manual reconstruction and cannot be claimed by this tool.

After applying the migrations and confirming which Pinata account originally owned an upload, use its private backend API environment:

```sh
DACLIFY_ENV_FILE=/absolute/path/to/private-api.env npm run storage:claim -- --claim-upload <upload-UUID>
```

This is an explicit operator write for one selected upload. It requires exactly one matching provider listing with the original ID/CID when known, retrieves bytes and validates the complete commitment. It then records ownership and the DAO reference atomically, preserving publication state. Wrong ownership, ambiguity or corrupt/unavailable bytes keeps the hold. Retry with the same account is safe. The tool does not change accounts, contract state, payment terms or remove provider files. Back up the database first; the command above is prepared tooling, not a command executed against live providers during development.

## Retention boundary

Automatic unpinning is disabled. Object generations and `removing` state prepare the reference fence: verification rejects a new reference to an object being removed. They do not yet implement the thirty-day billing grace, staged ciphertext backup, provider leases or compensation. No file is deleted because of an expired upload reservation or unpaid membership subscription in this checkpoint.
