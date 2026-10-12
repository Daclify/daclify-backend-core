# Profile key custody, recovery and removal

This is a development implementation. The service is disabled by default; the audience editor and complete privacy journey still require P3 qualification. No production privacy or independent-host recovery qualification is implied.

Profile contents stay encrypted on chain. Every revision uses an independent random 32-byte data key. The trusted client seals that key to the owner's registered P-256 encryption key and at most 63 explicitly chosen active native members. Joining a DAO does not grant profile access. Neither a shared signing key nor canonical account ownership supplies another encryption private key.

The profile SDK uses a distinct authenticated profile domain including full chain/runtime/DAO/member/revision, recipient public key and SHA-256 of the canonical encrypted envelope. The existing P-256/HKDF/AES-GCM delivery primitive is reused; its profile-domain input cannot open a DAO epoch grant. Salt, IV and wrapped-key/tag lengths are exactly 32, 12 and 48 bytes. No plaintext profile, raw profile key, signing private key or immutable key-envelope upload reaches this service.

## Publication and sharing

1. Validate personal fields locally, generate a fresh revision/key, encrypt and seal the owner plus chosen recipient envelopes.
2. Submit `POST /v1/profiles/keys/share` with `{context,grants}` and a fresh original-root account-control proof bound to the exact request body, origin, API and session. The service verifies actual native ownership, registered keys, distinct recipients and the owner envelope. It stages keys for 15 minutes; at most two staged revisions may exist beside one current revision.
3. Publish the ciphertext with the native `setencprof` action. Preserve the prepared cipher/grants when retrying; changing a prepared revision's commitment or recipient wraps is refused.
4. The leased worker or an authorized fetch confirms the exact on-chain cipher commitment. Unpublished expired staging is removed; a matching published cipher is preserved during confirmation/SQL retries. A staged envelope may be returned only after the exact native match and current recipient-key check. SQL cleanup status may still be pending.

Sharing/removal needs the locally unlocked original root even when a paired wallet is selected for governance. Fetching requires an authenticated Daclify session and the explicitly sealed recipient key; ordinary app bearers have no access. The owner must publish a fresh key/revision to revoke future access. Previously obtained keys, plaintext or sealed envelopes remain readable by their holders.

Old live envelopes are removed when a confirmed new revision replaces them. Confirmation failure before publication preserves the previous readable revision. If publication has succeeded while activation retries, its pre-staged envelopes remain recoverable after exact confirmation. These are separate systems, so clients must show the actual pending/failure state rather than claim atomic completion.

## Existing recovery kit

The same account recovery kit restores the original signing and P-256 encryption keys. The restored client fetches its surviving owner envelope and opens the random profile key. It needs no second password or kit. The kit contains no profile data key: after all controlled envelopes are removed, the same kit plus chain ciphertext cannot reconstruct that random key. Lost envelope storage can therefore make a profile unavailable despite intact account keys.

Reconnection preserves the registered account keys and proved historical ownership. It does not rekey native memberships or make a canonical private key decrypt a retired owner's different envelope. A native-key mismatch is refused; a separately supported encryption-key change would need actual continuity proof and owner rewrapping. Shared DAO grants and signing keys are unaffected by profile-key removal.

## Controlled deletion and ordinary restores

`POST /v1/profiles/keys/remove` binds the context and ciphertext commitment to fresh root consent. The service writes an immutable exclusion to its independent journal before deleting live envelopes. Reads consult this journal before returning a grant, including immediately after older SQL rows are restored. Failed journal/storage operations report `unavailable`; callers must retry and must not label removal complete.

The result is `backup-expiry-pending` until the configured maximum recoverable backup age elapses. It becomes `removed` after that deadline. Bounded cleanup purges restored excluded rows and commits their removal before forgetting expired exclusion metadata. This protects the controlled ordinary restore procedure; it cannot stop an unauthorized holder from decrypting a retained backup with an old private key.

Before enabling, inventory all controlled PostgreSQL replicas, snapshots, filesystem copies and any caches. This implementation keeps no plaintext/data-key cache. Set `PROFILE_KEYS_ENABLED=1`, `PROFILE_KEYS_MAX_BACKUP_AGE_SECONDS` (1–7,776,000) and `PROFILE_KEYS_EXCLUSIONS_DIRECTORY`. Enforce that maximum age on every recoverable backup; the configured number does not delete provider snapshots itself. Keep the journal on a durable owner-only mount outside the ordinary SQL snapshot set and restore its latest state before serving keys. Mainnet refuses known temporary directories. A path alone does not establish an independent failure domain.

After a SQL restore, keep the latest journal mounted. Key reads already apply exclusions; run `npm run profiles:restore-exclusions` with the configured database and latest journal before taking a new recoverable snapshot of restored rows. Expired backups must not be restored as ordinary recovery. Journal loss, unknown backup age or an unavailable journal requires withholding envelope access until the controlled restore exclusions are restored and verified. Qualify host loss, backup expiry and provider deletion before public activation.

Current encrypted-profile removal also needs the native `delprofile` action. Neither that live-row removal nor key deletion removes historical plaintext, public aliases/member metadata, historical ciphertext or independently retained copies. The privacy assessment and account-exit component report remain separate acceptance requirements.
