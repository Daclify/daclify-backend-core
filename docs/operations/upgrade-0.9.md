# Executive governance adoption — 0.9 development release

This is an owner-reviewed adoption procedure. The implementation and local tests do not change existing testnet or mainnet permissions. The 0.9.0-alpha.1 packages are development artifacts, not a qualified production release.

## Compatibility and preparation

Use the matching core, modules and frontend packages. The instruction domain and contract interface remain version 1. Existing member, DAO and Decide election/term row layouts are unchanged. Executive policies, offices, pending handovers, native configuration and voter exclusions use new metered tables. There is no new PostgreSQL migration for this feature.

Follow the existing [resource upgrade procedure](upgrade-0.8.md) for code hashes, RAM observation and installed module pins. Upgrading a module's code invalidates old installed hashes until the reviewed deployment repins them. Build/generated-doc checks and local tests do not qualify a live provider or a production upgrade.

## Initial ownership adoption

1. Identify the runtime's governing DAO and its initial executive member IDs. Shared tenant DAOs do not control native permissions. A new independent runtime has its own governing DAO.
2. Verify the current owner authorities from the target chain. App administrator status does not provide those owner signatures. Do not assume the backend deployer key is the current owner key.
3. In DAO Settings, prepare the owner configuration with the managed contract accounts and a distinct hosting service **public** key. Exclude the runtime itself from the managed list. Include only the accounts whose owners have consented to this transfer. Relay, oracle and fee accounts remain separately scoped unless explicitly included.
4. Review the `nativeOwnershipSetupActions` transaction. It locks runtime `eosio::setcode` and `setabi` to owner, then configures `setnativegov` once. Changing the managed account list afterward requires a separately reviewed code/authority change; it is not a tenant setting.
5. The current deployment authority signs `appoint` for the governing DAO. Set the inactivity timeout and quorum explicitly. Pairing an ordinary member never appoints that member.
6. Each appointed executive pairs a Telos Zero account in the DAO. Email, Telegram and EVM login pairings do not become native owner entries. Keep the hosting key distinct from executive wallet authorities.
7. Prepare and review the atomic owner handover. The app fetches current owner authorities and produces owner-staging actions followed by `handover`, with expected signers, threshold and executive-policy revision. **All actions belong in one transaction. Never broadcast staging alone.** Current owners of the runtime and every managed account must authorize it. A stale roster/activity snapshot rejects the transaction.
8. Verify resulting permissions, executive membership, administrator rights and the scoped hosting service on chain. Configure the backend creation key to match the new service public key. Failure to match must leave creation unavailable.

The runtime's `govern` permission contains the eligible executive wallet accounts at `active`. Runtime owner and active delegate to govern or runtime code; managed owners delegate to runtime govern, and managed active permissions delegate to govern or their own contract code. The hosting service has creation/enrollment/installation links, but governing-DAO enrollment and installation still require native active authority.

## Operating rules

The governing DAO's app administrator rights follow its eligible paired executive roster. Shared DAO administrators remain separate. App administrator actions are individually authorized; native ownership operations require the native quorum. Keep this distinction visible when setting policy.

Time alone cannot rewrite permissions. A signed member instruction, executive heartbeat or public `syncexec` transaction refreshes activity and native authority. Linked native wallets can authorize `submitnat` directly without a vault signing key. When all executives are inactive, retained paired authorities remain as fallback; the first returning executive can become the sole active controller. This is the approved governance policy.

The last eligible paired controller cannot unlink, deactivate or be revoked. Replace its wallet atomically with existing member authorization and incoming wallet consent. Login-only unlink is blocked while an eligible executive binding remains; revoked members do not retain that credential lock.

Use the explicit executive election option, with an appointed policy and pinned Decide `electexec` grant. Other titles remain representative offices. A finalized result stores one pending roster. Until its term starts and an eligible successor pairs, the incumbent retains control. Expired or recalled pending rosters do not take over; recall cannot remove the final current controller. Schedule one pending executive handover at a time.

Native authority delegates to the executives' own account permissions. Their account owners can change those keys outside Daclify. Managed Daclify signing keys can authorize paired-wallet replacement, so a custody provider is part of the executive trust boundary. User-controlled executive accounts avoid delegating that member signing power to a provider.

Keep native RAM available and retain signing/recovery material. Native governance does not recover document decryption keys, make malicious authorized upgrades harmless or replace an operator backup plan.
