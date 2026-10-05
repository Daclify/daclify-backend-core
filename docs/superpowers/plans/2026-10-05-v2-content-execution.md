# Bounded hosted content implementation

WP11/WP12 continue with a backend-mediated upload path allowed by the storage policy. Pinata's reviewed signed-URL documentation does not establish a single-use guarantee. Direct URLs stay gated until their replay and cost behavior is verified. The tradeoff is backend bandwidth and a deliberately bounded request size.

1. Implement a typed Pinata public upload/list/retrieve/delete adapter, fixed CIDv1 profile, generic file names, bounded reads and redacted provider errors. Use fault fixtures; do not count them as live Pinata evidence.
2. Add canonical hosted-content request/receipt/status schemas. Validate reconstructed byte commitments and private envelope structure before publication. A DAG CID is not a raw-file digest.
3. Add an immutable follow-up PostgreSQL migration for upload intent identity, content coordinates and retry binding. Serialize quota reservation per full DAO reference and preserve pending reservations after ambiguous provider failures.
4. Implement authenticated upload, status/reconciliation and orphan handling. Derive membership from the authoritative chain. Keep provider identifiers and credentials on the backend. Existing content access and financial exits remain separate from a new-upload allowance.
5. Connect public/private file upload, retrieval, byte verification and client decryption to the UI. Private file names and payloads are encrypted before reaching the service. Use generic ciphertext names externally.
6. Extend generated documentation, local functional/provider fault tests and browser journeys. Record live-provider and operational retention evidence separately.

Initial hosted file limit: 5 MiB of stored bytes per request. This is an implementation bound, not a measured commercial allowance. The total storage allowance is explicit operator configuration; no final pricing or retention guarantee is asserted.
