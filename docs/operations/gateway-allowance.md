# Shared gateway allowance

Hosted Pinata reads use one operator-funded allowance for an explicit period, shared by this API's DAOs and verification/recovery jobs. This is separate from each DAO's stored-byte allowance and prepaid IPFS subscription. It adds no bandwidth invoice or automatic provider purchase.

Before a gateway request, PostgreSQL atomically reserves the expected payload bytes and one request. Every retry costs another reservation. Failed, canceled, corrupt and short responses retain the original reservation: a network failure is not proof that the provider served zero bytes. Concurrent API processes share the same counters. Restarting the service or retrying registration does not replenish them. A missing, mismatched, exhausted, future or expired allowance stops reads before the upstream request. Files remain pinned; verification/export/recovery that requires that gateway must wait or use a separately verified provider/copy.

These are application reservations, not a Pinata billing meter. Protocol overhead, oversized/malicious upstream responses, other provider clients and direct gateway access are outside the payload counter. The request ceiling bounds admitted attempts. An operator must keep headroom and reconcile actual provider analytics; do not advertise an exact upstream-cost guarantee or unlimited access.

## Register a funded period

1. Verify the Pinata plan/account, available allowance and provider reset dates. A free plan can fund a bounded testnet pilot; a paid plan is not required by this mechanism. Set application limits below the verified provider allowance, leaving headroom for other clients, verification and recovery. If the remaining monthly allowance or reset date is unknown, use a short, conservative period and monitor actual provider usage before renewing it. Mainnet and testnet use separate accounts. Confirm that the gateway requires the server-only key; requests without it must fail. Remove alternative browser-origin/public access rules: Pinata combines access controls with **OR**, so another rule can bypass the key. Restrict the provider credential and keep it off the frontend. [Pinata access controls](https://docs.pinata.cloud/gateways/gateway-access-controls), [bandwidth analytics](https://docs.pinata.cloud/sdk/analytics/bandwidth).
2. Apply the reviewed core migrations, including `031_gateway_allowances.sql`. Registration never applies migrations implicitly.
3. Save a non-secret funding descriptor such as the following. The values are synthetic examples, not a recommended plan, proof of payment or an available allowance:

```json
{
  "id": "613c972c-d56c-4e01-8e5f-a2a73e01cfe7",
  "providerScope": "your-stable-pinata-account-id",
  "gateway": "https://your-gateway.mypinata.cloud",
  "startsAt": "2026-11-01T00:00:00.000Z",
  "endsAt": "2026-12-01T00:00:00.000Z",
  "byteLimit": "1000000000",
  "requestLimit": "10000",
  "fundingReference": "non-secret-operator-payment-reference"
}
```

4. Select the intended private environment file using `DACLIFY_ENV_FILE`, review the plan, then register it only after the operator confirms the provider allowance. For a free plan, the funding reference records that confirmation rather than a payment:

```sh
DACLIFY_ENV_FILE=.env.testnet npm run gateway:allowance -- funding.json
DACLIFY_ENV_FILE=.env.testnet npm run gateway:allowance -- funding.json --apply
```

5. Set `CONTENT_GATEWAY_BUDGET_ID` to that ID, configure `CONTENT_GATEWAY_KEY` and restart the API. The provider account/gateway must match the saved grant exactly. The API cannot create grants. Registration retries preserve consumption; changed descriptors and overlapping periods reject. Periods are at most 31 days. Register each renewal separately and switch to its ID at the boundary; time alone never grants more capacity.
6. Inspect the public Status page. It reports the shared period, request/byte reservations and **operator-attested** funding, never the funding reference or credentials. A database failure reports unavailable rather than a fabricated zero-usage allowance.

Provider payment and access-control verification remain separate release gates. Local SQL/HTTP tests do not establish those facts.

## Exhaustion and recovery

An operator reviews exhausted or expired allowances and registers a separately funded non-overlapping period. Do not edit counters or limits to force more reads; the database rejects reductions in consumption or changes to funding terms. This cap does not delete content, reset a DAO's grace period or authorize an overage charge.

Include `gateway_allowances` in encrypted database backups and restore it before resuming gateway reads. An empty replacement database has no allowance even if its environment retains the old ID; reads fail closed. Reconstruct actual consumption conservatively from retained/provider evidence before an operator explicitly registers replacement funding. Do not register the old descriptor into an empty database and assume its unconsumed capacity is available. Native contracts and member recovery kits do not reconstruct this provider-cost ledger.
