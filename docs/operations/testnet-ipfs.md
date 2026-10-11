# Testnet IPFS storage

IPFS is active on the shared Telos testnet deployment. The existing Pinata integration hosts DAO documents and public directory images; the API verifies the uploaded bytes before returning a receipt. A member then signs the document or DAO metadata update. The chain stores the CID, byte count, integrity commitment and attribution rather than the complete file.

The activation and real API/browser checks are recorded in [the evidence report](../evidence/2026-10-11-testnet-ipfs.md).

## Capacity and prices

The operator confirmed the Pinata Free plan from their account's billing screen: 1 GB total storage, 500 pinned files, 10 GB monthly bandwidth and 10,000 monthly requests. These limits belong to the provider account and are shared by all DAOs, account recovery backups and other pinned files. They are not separate allowances for each DAO. No provider upgrade was purchased.

Each DAO's free hosted-storage quota is 100,000,000 bytes (100 MB). The native resource policy configures additional decimal GB units at $1 per month, separately from membership hosting. This is Daclify's configured price, not Pinata's provider price. Testnet card payments remain in test mode. A provider plan must have sufficient aggregate capacity before paid storage can be offered for real payments; a DAO purchasing a unit does not buy or upgrade the Pinata account.

The current provider account is a small pilot. The sum of DAO quotas is not a reservation of provider capacity. Monitor the provider's total pinned bytes and file count; its plan can fill before every DAO reaches its individual quota. Upstream upload failures remain pending for reconciliation and do not establish a verified publication.

## Upload a document or DAO image

1. Open the DAO's **Documents** tab as an active member, select a file and upload it. The current file limit is 5 MiB. Review the verified receipt and sign **Publish** to record its CID and author on chain.
2. For a DAO logo or cover, an administrator opens **Settings → Public directory card**, selects a PNG, JPEG or WebP image up to 2 MiB and explicitly consents to public storage. Upload the image, then sign the card update. The image remains public even when the DAO's documents are private.
3. Read or download published files through Daclify. The server keeps provider credentials and the gateway key out of the browser. Private documents are encrypted before upload and require the relevant membership and epoch key to decrypt; activating storage does not change that policy.

## Shared reads and renewal

The first application allowance runs from **2026-10-11 17:05:36.198 UTC** until **2026-10-18 17:05:36.198 UTC**, with 500,000,000 payload bytes and 1,000 gateway attempts shared by the deployment. It is an operator-attested budget within the confirmed free plan, not a claim about the provider's exact remaining monthly balance or reset date. Retries and unsuccessful reads retain their reservations.

Before expiry or exhaustion, check provider usage and register a subsequent non-overlapping period using [the shared gateway allowance procedure](gateway-allowance.md). Keep the provider scope and gateway unchanged, update the private `CONTENT_GATEWAY_BUDGET_ID`, then restart the API. Counters are persisted in PostgreSQL and cannot be replenished by restarting. An expired or exhausted allowance stops reads and upload verification; it does not unpin files.

Only `CONTENT_GATEWAY_BUDGET_ID` and `CONTENT_FREE_STORAGE_BYTES` changed in the private API environment during this activation. The latter is now `100000000`, matching the native policy. Provider credentials, account keys, issuer keys, recovery configuration and existing service paths were preserved. Automated storage cleanup remains disabled.

## Module pricing is separate

The user selected a policy in which existing first-party modules are free through ten active DAO members and have separately configured monthly fees above ten. The proposed starter prices are Decide $2, Works $3, Payroll $3, Grants $2, Endorsement $1 and Community Activity $1 per DAO per month. The six-module total would be $12, excluding member hosting and storage.

Those prices remain a proposal awaiting the user's pricing answer. The current native catalogue's six prices are `0.0000 TLOS`; those are legacy usage prices and do not implement monthly subscriptions or a membership threshold. This IPFS activation does not introduce module charges. The monthly entitlement and billing implementation must preserve existing reviews, approved work and payouts, require administrator consent and use authoritative membership counts.
