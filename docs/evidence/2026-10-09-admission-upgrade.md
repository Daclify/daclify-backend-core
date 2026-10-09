# Historical endorsement applications — compiled-WASM qualification

The modules repository rebuilt the actual old core/Endorsement sources and passed **27 files / 144 tests**, including two new upgrade cases, with lint, strict TypeScript and generated documentation checks. The old sources are core `6145da8` and modules `4a43786`; test pins require old core code `5a7d037c3e9557b123edfaedbc1248b9a01f8c27f85c11f99d1e63acd5dd3c1a` and Endorsement `1933fae4f474abe3fe1fb22ed3f5dbdf5752da66a77256b83e6b756814289086`.

Each case creates the DAO, internal credentials, document, admission policy, pending application and two endorsements using those older compiled contracts. After replacement and observer/source rebinding, original application fields, member state and policy are unchanged. Current source-owned document-reference backfill creates the missing reference without rewriting the application. Repeating a completed backfill changes neither references nor core counters.

The second case offboards an original witness after upgrade. Admission then refuses with `ENDORSEMENT_THRESHOLD` and preserves the application, all original members/nonces and counters. Reactivating that witness permits admission. Both cases create exactly one ordinary member with the original applicant signing/encryption keys, no native account, no administrator/reviewer powers and no credits. Repeated admission and a direct source-key callback reject, preserving final DAO/application/member/counter state and document references.

Reproduce in modules with `npx tsx tools/build-document-upgrade.ts`, followed by `npx vitest run tests/admission-upgrade.test.ts tests/completion-upgrade.test.ts` or `npm run verify`. The builder now includes the actual old Endorsement contract; it preserves the separately retained historical Decide election fixture.

These are VERT executions of actual compiled C++ artifacts. They do not calibrate native RAM, enforce physical exhaustion, qualify every historical/agent/custody combination or establish live wallet/provider behavior. Current runtime/module code, public schemas and dependencies are unchanged. Public deployment and immutable release remain gated.
