# DAO pricing page

The Create a DAO screen has a Pricing button that opens `/pricing` in a new tab, preserving the original setup form. Pricing is public and does not require an account.

The page reads the selected deployment's `/v1/platform/status` through the pinned public SDK. It shows shared setup pricing, independent deployment contact options, included member capacity, graduated monthly paid slots, storage units, RAM purchase margins and allowances, module catalogue prices, Connect commission and conversion premiums. An expandable section includes configured legacy setup values, module revenue shares and name resale settings; these are distinguished from an available checkout quote.

Member tiers apply after the included slots: the first forty paid slots, the next two hundred, and the remainder. Monthly billing covers approved capacity, including unused slots. Existing subscriptions can retain an earlier approved schedule. Prices on this page do not approve purchases or change DAO subscriptions, fees or permissions.

The member card shows actual member numbers, including the free allowance, and example monthly totals using the public SDK's billing calculation. With the current 10 free places, the ranges are members 11–50, 51–250 and 251 onward. For example, 100 approved places cost $65/month: 10 free, 40 at $1.00, and 50 at $0.50. Examples update with configured rates and allowances and cover membership charges only. The card explains that approved empty places are billed too.

The API reports effective built-in member and Connect rates when no override is stored, using the same defaults as its billing readers. Stored governance overrides take precedence. Connect defaults are reported only for a linked platform DAO with the supported payment-policy table. Storage and RAM prices remain unavailable when their resource policy is absent; missing values are not displayed as zero-priced products.

The browser checks the selected chain/runtime and verified runtime code before displaying prices. Refresh clears previous prices while loading. Failed, mismatched or unverified reads show an unavailable state with retry. Stale conversion rates are labelled and are not used to invent TLOS estimates. Payment-provider charges and optional AI services require their own quotes.

Qualification is recorded in [the execution ledger](../superpowers/plans/2026-10-11-dao-pricing-page.md). This is a testnet frontend/API rollout with unchanged public SDK archives and native contracts.

On 2026-10-11, the operator activated testnet's existing native resource policy and Pinata gateway allowance. The page now reports 100 MB included storage per DAO and $1 per additional decimal GB per month. The provider account itself has shared limits; see [testnet IPFS storage](testnet-ipfs.md). The catalogue's legacy TLOS prices do not represent the proposed monthly module fees.
