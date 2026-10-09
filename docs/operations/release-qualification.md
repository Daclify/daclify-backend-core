# Release evidence and immutable packaging

Development builds are not qualified releases. The default manifest remains refused, and `npm run package:release` without evidence fails. A complete operator-reviewed evidence bundle can now qualify an exact candidate for local immutable packaging. Neither command publishes to a registry, deploys contracts, enables cleanup, or authorizes production spending.

Build all three sibling repositories with the pinned Node/npm/CDT/Spring toolchain. Generate docs, bootstrap exact producer packages, build the frontend, run the required checks, review and commit all source/lockfile changes. Keep all three tracked checkouts clean. Changing a source commit, lockfile, runtime WASM/ABI, module WASM/ABI, public package, SDK build or frontend output changes the evidence subject. Rebuilding different ignored artifacts therefore invalidates earlier evidence too.

From core, inspect the candidate:

```sh
npx tsx tools/release/manifest.ts > .artifacts/candidate-manifest.json
```

Its top-level `subject` is the SHA-256 identity used in reports. `checks.held` lists the twelve required gates; their stable IDs are `social`, `wallets`, `custody`, `chain`, `connect`, `subscriptions`, `independent`, `artifacts`, `ram`, `migration`, `billing`, and `content`. Read their descriptions in `tools/release/manifest.ts`. Local tests, emulator results and authenticated API preflight are evidence only for their stated scope; they cannot replace real client, production custody, provider consent or selected public-chain checks.

For each genuinely completed gate, retain the detailed command output, exact targets and relevant provider/restore records outside public source if they contain private data. Review those records before making the following bounded summary. A command summary has exactly these fields:

```json
{
  "schemaVersion": 1,
  "check": "ram",
  "subject": "REPLACE_WITH_EXACT_CANDIDATE_SUBJECT",
  "status": "passed",
  "method": "command",
  "assertions": 1,
  "failed": 0,
  "skipped": 0,
  "exitCode": 0
}
```

Replace the example count with the actual meaningful assertion count. Manual provider/client review uses `method: "operator"` and a nonempty `reviewer` instead of `exitCode`. This is an explicit operator attestation, not an automated security certification. The verifier cannot prove that a reviewer told the truth or that a command covered an entire gate. Do not manufacture passed reports from partial checks or the synthetic packaging-policy tests.

Save one report per ID and create a bundle alongside those files:

```json
{
  "schemaVersion": 1,
  "subject": "REPLACE_WITH_EXACT_CANDIDATE_SUBJECT",
  "checks": [
    { "id": "ram", "path": "ram.json", "sha256": "REPLACE_WITH_SHA256_OF_REPORT_BYTES" }
  ]
}
```

The example is deliberately incomplete and will fail. All twelve unique IDs are required. Paths must resolve inside the bundle directory; outside files, modified report bytes, unknown/duplicate/missing IDs, zero assertions, failures, skips and stale subjects reject. Evidence files are bounded. Plain free-text pass labels and caller-set `qualified` booleans grant nothing.

Validate and package from core:

```sh
npx tsx tools/release/manifest.ts --evidence /private/release-evidence/bundle.json
npm run package:release -- --evidence /private/release-evidence/bundle.json
```

Packaging revalidates the reports and clean source pins, and requires newly packed SDK bytes to match the previously tested public package. Output is `.artifacts/releases/<version>/`: the SDK tarball and qualification manifest with its package checksum. Retrying identical bytes is allowed; replacing any existing version's artifact with different bytes or writing through a symlink rejects. The manifest also pins the separately built module package, all contract artifacts and frontend build; retain those exact bytes with the release packet. Publish/install only the reviewed bytes, never rebuild silently after acceptance.

`npm run package:protocol` continues to produce explicitly mutable local development artifacts. Historical dated manifests are records of previous checkpoints, not automatically eligible combinations. Keep `docs/releases/compatibility.json` unqualified until the full real evidence is reviewed. Production authorization, target authority review, off-host backup restore and destructive-retention enablement are separate steps.
