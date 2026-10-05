# Custody provider investigation

The user prefers an open-source provider. AWS KMS is not selected. OpenBao 2.7.1 is the leading candidate, under its verified MPL-2.0 license. Its pinned local image digest is `sha256:6d2b93856e3fcf7b18ad855a0b51eaba474dc8b79cf554379ea32034797d2acf`.

| Candidate | Verified facts | Assessment |
| --- | --- | --- |
| OpenBao | Built-in Transit P-256 signing and AES-GCM key wrapping. No built-in secp256k1 is listed. Five real local provider tests passed, including conversion/recovery of Antelope R1 signatures. | Test R1 on native Spring. Keep managed signing separate from content wrapping. Nonexportable signing keys leave through authorized rotation, not a promised private-key export. |
| Infisical | Open repository; GitHub license metadata returned `NOASSERTION`, so a blanket license claim is not established. | Requires feature/license/curve verification before treating it as a drop-in signing provider. No signing prototype passed. |
| BNB tss-lib | MIT-licensed lower-level threshold ECDSA/EdDSA library. | Not an operated recovery/signing service. Threshold protocols, participant state, recovery, auditing and maintenance add substantial scope; not justified for the first release. |

Sources: [OpenBao Transit API](https://openbao.org/docs/api/secret/transit/), [OpenBao source/license](https://github.com/openbao/openbao), [Infisical source](https://github.com/Infisical/infisical), [tss-lib](https://github.com/bnb-chain/tss-lib).

The successful OpenBao checks used an ephemeral development server and a disposable local token. They do not verify a production cluster, TLS, AppRole policies, unseal/backup/restore, audit logs, recovery authorization, availability or operating cost. Production requires a separate least-privilege signing boundary, durable audited operations and a recovery/exit rehearsal. OpenBao is self-hosted software, not an outsourced operating responsibility.

User-controlled clients use distinct signing/encryption keys and encrypted backups. Social authentication alone cannot decrypt their vault. Managed encryption recovery permits service access to private content and is disallowed by a user-controlled-only DAO policy. Browser compromise and malicious client updates remain explicit limits.
