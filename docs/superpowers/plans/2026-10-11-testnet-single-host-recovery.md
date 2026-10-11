# Testnet single-host recovery

User decision: the testnet API, PostgreSQL and recovery key service may share the current VM. Mainnet will use separate API/database and key-service servers plus backups outside both. This is an explicit testnet exception to the independent-host runbook, not independent restore qualification.

Implementation: `RECOVERY_MODE=testnet-single-host` requires the actual Telos testnet chain ID and deployment environment, loopback TLS OpenBao, a protected restricted-token file and current source/version/site/storage-bound local restore evidence. Evidence states `independentHost:false`, expires within seven days and cannot qualify wallets/passkeys. Existing independent qualification remains the default and is mandatory on mainnet. Signup exposes a development notice through its existing `assisted.reason` field; the browser shows it before consent. Native membership, managed-custody admission and permanent assisted-authority history remain unchanged.

Execution stays inline. Preserve existing connected-app rollout and key/SDK pins. Core/frontend get a new development version; public module package gets a compatible exact core peer version without rebuilding any native module.

- [x] Reproduce rejection of the requested local mode; add acceptance, mainnet/other-chain, wrong-mode/origin, expired/tampered evidence regressions.
- [x] Implement explicit mode and signup notice. Initial configuration/schema checks: 2 files/9 tests passed; TypeScript passed.
- [x] Provision persistent loopback TLS OpenBao with Raft, audit logging, restricted renewable API credentials and an operator unseal procedure. Keep secret state outside Git/chat.
- [x] Perform an actual same-host original-key snapshot restore and record it honestly; configure API only after success.
- [ ] Refresh versioned consumer artifacts and run affected API/database/browser checks, both feature flows and public testnet checks.
- [ ] Archive matching source, enable testnet development recovery and publish matching frontend; document service restart/unseal and mainnet migration requirements.

- Actual OpenBao 2.7.1 setup uses checksum-verified binary, loopback TLS, Raft and audit logging. The actual snapshot restore recovered the original key with the source service stopped; four API-policy denial checks and audit plaintext exclusion passed. A post-unseal readiness race initially stopped the restart helper; bounded ready checks fixed it, and service plus restricted-token restart passed. Local evidence binds core alpha.6 and expires 2026-10-17T14:46:09.233Z, with independentHost:false. Persistent AppRole bootstrap/retained shares are testnet-only conveniences documented in the runbook.
- Core final new-version full suite: 139 files/872 tests passed; combined actual PostgreSQL apps/signup/recovery: 3 files/53 tests passed. A frontend artifact test caught the missed module producer VERSION increment; correct it and regenerate consumer artifacts before delivery.

- Combined desktop/mobile browser qualification: 52/52 passed, including both account entry paths, quick email/Telegram signup, key-preserving opt-out and app consent/membership controls. These use owned cryptographic provider fixtures. Frontend full suite passed 42 files/275 tests and testnet build. Module native/business cases passed 177/179; its two release/doc failures were stale version/qualification metadata, corrected with 8/8 focused checks and regenerated references. Final SDK review reproduced explicit no-snapshot keyEpoch=0 being rejected; canonical Uint64 validation now admits the native zero sentinel, and loss/retry tests pass 2/2. Regenerate unpublished alpha.6/alpha.22 artifacts before final install; old alpha.5/alpha.21 archives remain immutable.
