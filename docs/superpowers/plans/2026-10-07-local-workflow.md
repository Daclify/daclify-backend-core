# Local verification and frontend development

User decision, 2026-10-07: build and test on the Mac, upload frontend artifacts to Netlify and run backend services on Hetzner. GitHub pushes must not trigger builds/tests. Develop against the hosted testnet API before pushing source.

1. Make the three application verification workflows and the landing website's verification workflow manual-only. Preserve local checks and release qualification gates.
2. Reuse the API's explicit origin list for both CORS and POST validation. Expose a validated additional-origin setting; no wildcard or rewritten browser Origin. Regression-check allowed and rejected preflights and POSTs.
3. Add a development-only single HTTPS API override, isolated CSRF storage and optional local TLS certificate settings to the existing frontend configuration. Keep deployed network-file behavior unchanged. Check malformed endpoints, build isolation and certificate pairing.
4. Document existing bootstrap/check commands, prebuilt Netlify uploads and same-site HTTPS development with a loopback hostname. Include hosted provider callback and payment-return limits.
5. Run affected checks locally, review the diff and integrate. No remote deployment, provider configuration, mainnet authority changes or credential changes are included.

The hosted API address, server and final frontend hostnames are not available yet. The local certificate and host mapping are operator setup; browser/provider tests against Hetzner remain pending until that environment exists. GitHub is source storage and optional manually requested verification, not evidence of a qualified release.

## Verification, 2026-10-07

- Regression-first checks exposed the existing CORS mismatch and missing frontend override/TLS support before implementation.
- Core `npm run verify`, `npm run format:check` and `npm run build` passed: 402 unit tests in 59 files; generated documentation unchanged; publication still refused and qualification false.
- Frontend `npm run verify`, `npm run format:check` and `npm run build` passed: 92 unit tests in 21 files. The build includes the SPA `_redirects` file. Existing large-chunk warnings remain.
- Core HTTP/sign-in integration suites passed 32 tests against a newly created owned local database ending in `_test`; that database was then dropped. Developer-origin login, secure cookies, CORS and origin-bound account-control issuance were exercised through the API harness, not a live browser/provider.
- YAML formatting and diff whitespace checks passed for modules and the website. No modules/website application source changed; their full suites were not rerun for a workflow/documentation-only change.
- No Hetzner/Netlify deployment, local trust-store installation, secret-file edit or mainnet operation was performed. Live hosted cookie/provider flows remain unverified.
