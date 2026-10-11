# Testnet IPFS activation — 2026-10-11

The operator requested working IPFS documents and DAO images and confirmed their current Pinata Free plan with the account's billing screenshot. Activation used the existing provider adapter, native resource-policy action and PostgreSQL gateway allowance. No provider purchase, native code upgrade or account-authority change was needed.

## Installed configuration

- Network: Telos testnet, chain `1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f`.
- Runtime: `daclifycore1`; unchanged code hash `4235158cdd149a4bebf1006a69b5f3943a842a9b437db14abf823acbd6cc277b`; unchanged raw ABI hash `2f8433050a4e63af0366d460d23b9d7d50a176bbc30fb2e7c402b4ea7599c0c1`.
- API source remains `e69f89981e5a6247a78e138ad284a3fa2d1037aa`, API/core SDK 0.13.0-alpha.6. Frontend remains `7a4a198e11cb440000d174cc08780147cfda6cdd`, version 0.13.0-alpha.8. Modules remain `6962c884cf57a00546edeaf5d1361f4438d02736`, SDK 0.9.0-alpha.22. Immutable public archives were not repackaged.
- Native `resourcecfg` is now revision 1. Storage: 100,000,000 free bytes per DAO, 1,000,000,000 bytes per paid unit, 100 USD cents per unit monthly. Other canonical resource defaults: 500/2000 basis-point native/card RAM margins, 262,144 activity bytes, 2,048 identity bytes per member slot, 300-second quote lifetime and 2,592,000-second grace period.
- Platform DAO 1's existing native administrator signed `submitnat → govresources`, guarded by expected revision 0. Transaction `bb0d376cf3a5f6695f831a8745cd1702f2987d9d9d3bdb9b05f03dde8b4d5226`, block 449669951, was confirmed irreversible; the resulting row matched the prepared canonical policy.
- The first shared gateway allowance is 500,000,000 payload bytes / 1,000 attempts, `2026-10-11T17:05:36.198Z` through `2026-10-18T17:05:36.198Z`. This short, operator-attested period uses the confirmed free plan conservatively. Actual remaining monthly bandwidth and the provider reset date were not established.
- Private API environment changes were limited to `CONTENT_GATEWAY_BUDGET_ID` and `CONTENT_FREE_STORAGE_BYTES=100000000`. Provider/issuer/recovery credentials and service source paths were preserved. Only the API was restarted; automated storage cleanup remains disabled.

A private environment backup and consistent PostgreSQL backup preceded activation. Funding descriptors and detailed qualification records are under `/data/daclify-runtime/ipfs-testnet-activation-20261011`, with restricted permissions. They contain no newly issued provider credentials. Existing account and recovery material stays outside Git and ordinary logs.

## Verification

| Check | Observed result |
| --- | --- |
| Pinata authentication and pinned-data total | Both actual authenticated provider endpoints returned 200. Initial usage was 31 files / 18,912,704 bytes; the Daclify hosted-object ledger had no objects for this provider scope. |
| Owned provider qualification | Uploaded a synthetic 115-byte object, verified its upload ownership and read back identical bytes. Gateway reads without the server key returned 401, including when sending the frontend origin. Removed only this owned probe after qualification. |
| Actual HTTPS document flow | Logged in with the owned DAO's active member 2, uploaded and verified a 63-byte public document, signed native `putdoc`, downloaded through the public API and matched the bytes. Repeating the upload returned the same receipt/CID. |
| Actual HTTPS branding flow | Uploaded and verified a 68-byte public PNG, signed native `setmeta`, served it through the public branding API and matched the bytes. Repeating the upload returned the same receipt/CID. |
| Real browser flow | At 1440×1000 and 390×844, the public Hub rendered the published DAO logo, Documents downloaded the correct filename and exact bytes, and Pricing showed 100 MB included / $1 per additional decimal GB monthly. Both viewports had no page errors; Pricing had no horizontal overflow and zero main-content Axe violations. Completed at `2026-10-11T17:10:44.581Z`. |
| Gateway accounting | Public verification/reads increased persisted request and byte reservations; allowance remained available. |
| Signup and services | `/v1/sign-up/options` still reported assisted signup available with its existing single-VM testnet qualification. API, OpenBao, recovery agent and Names timer were active. |
| Focused regression checks | `vitest run tests/gateway-policy.test.ts tests/dao-branding.test.ts tests/resource-policy.test.ts tests/storage-config.test.ts tests/content-fixture.test.ts`: 5 files / 14 tests passed. Generated core documentation check and `git diff --check` passed. |

The retained review fixture is public DAO `8122199153663004859`, “Connected apps qualification — owned testnet fixture”. Document 1 has CID `bafkreidmk5hga2udymc7fh3dwxqflizjayayhzlfky6xykkbzj45qbgr5a` and publication transaction `752fb06d54aae0a300595f59830fb734a011d93b6143e39809a492ac286eab2a`. Its logo has CID `bafkreif67uhmlpu5rg5qcza3y4trjykcte4xn7di4awciddelkjweu7kiq` and metadata transaction `f634833d0afa529df610654de411ab0048fe929a61088136f223277874ee56e8`. Both contain synthetic content and remain pinned for review. Other provider files were untouched.

The initial API harness used an older managed-membership fixture whose current login account was user-controlled. The API rejected it with `MEMBER_REQUIRED`; qualification used the fixture's consistent user-controlled administrator instead. Authorization was not weakened. Initial browser harness assumptions about the tab label and visible filename were corrected to the actual Documents route and downloaded filename.

## Limits and follow-up

This verifies real public documents and public branding through Pinata, the HTTPS API, native publication and the browser. A new encrypted-document live flow, provider monthly reset/remaining bandwidth, paid storage checkout and full repository/native suites were not exercised in this configuration-only activation. No implementation code or native binary changed. Existing private-document encryption and admission checks remain in force.

The provider's 1 GB / 500-file limits are global and include other files and recovery backups. A 100 MB DAO quota is not reserved provider capacity. The shared gateway period must be renewed after checking provider usage; expiry/exhaustion stops reads and verification without unpinning files. See [the operating guide](../operations/testnet-ipfs.md).

Monthly first-party module fees are separate unfinished work. The user selected free modules through ten active members and separate configured monthly fees above ten; proposed dollar values await their pricing answer. The current six `0.0000 TLOS` catalogue prices are legacy usage prices, not a monthly billing implementation. No module fees were activated here.
