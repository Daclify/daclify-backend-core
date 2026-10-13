# One default wallet and one approval setup

The user approved one default wallet and one setup flow: reuse an account's paired wallet, enable it for selected existing DAOs, and finish the same setup when creating or joining another DAO. The current document dialog exposes a disabled authorization button because service pairing and native DAO member bindings are distinct. This design unifies the experience while preserving both proofs.

## Behavior

Account > Access & recovery contains **Approval setup**: choose Daclify keys, Telos Zero or Telos EVM; connect and verify the paired wallet; save it as the default; select active DAO memberships; approve their activation. Show existing authorizations and replacements plainly. Keys, device approval, sign-in recovery and encrypted-kit restoration remain on this same Account screen. Recover the original account keys once when an unbound wallet needs member consent. Do not create replacement identities or enable assisted recovery implicitly.

All action cards use the saved default and link to this screen when setup is incomplete. Preserve the original DAO/action destination. Public documents need no encryption-key unlock once a wallet is authorized. Private uploads still require encryption keys and the permitted epoch grant.

After successful human DAO creation, route an account lacking a ready approval method to setup for the new DAO. Already ready accounts continue to the workspace. Admission instructions lead to the same account screen; newly admitted members see the same setup entry before signing. Opening or refreshing any page never activates a wallet. Every activation starts with an explicit approval gesture and both existing-member and incoming-wallet consent.

Engineering choice: remember the wallet identity and method per account/operator/network in this browser, using nonsecret local storage. A new device may choose its paired wallet again. The saved preference conveys no authority: recheck pairing, current membership and chain binding. This avoids a new server preference API or contract/global-authority registry. Backend custody, keys, recovery and membership policies remain unchanged.

## Safety and recovery

Use the existing producer instructions, native transaction validation and EIP-712 binding format. Refresh membership/nonces before each activation, verify the wallet's account pairing and exact scope, and reject account/network/location/wallet changes before signing or submission. Skip already matching current bindings. Stop a batch at its first failure, preserve selections, and refresh confirmed state so retry does not rebind successful rows. User selection explicitly authorizes any displayed wallet replacement. At most 20 memberships are activated per gesture.

No provider session alone becomes native signing authority. A sign-in-only account needs existing recovery for activation, but remains able to create its shared DAO under the previously approved session-based creation policy. No automatic conversion to managed custody, wallet replacement, key rotation, new membership, role, credit, vote or treasury action is included.

## Acceptance

- A chosen default survives reload and moving between DAOs, without crossing account/operator/network boundaries; invalid or blocked browser storage cannot grant authority.
- One setup screen verifies account pairing, completes explicitly selected native/EVM activations, reports progress and permits safe retry.
- Wrong wallet, changed account/network, missing original signing key, inactive membership, foreign deployment and failed pairing prevent activation.
- Create, join, workspace and document cards lead to the same setup screen and preserve the intended destination. Successful sign-in inside setup does not skip remaining authorization.
- Desktop/mobile keyboard and accessibility checks pass; private-content access and last-native-executive safeguards remain intact.

Implementation and verification are inline under the existing continuous-work authorization. Commit/push dev and publish the checked frontend to testnet; no production or native contract change is included.
