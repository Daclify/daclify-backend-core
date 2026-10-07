# Daclify public protocol

Strict boundary schemas, full DAO references, integer amounts, account and encryption envelopes, generated Antelope runtime types/codecs, and a public ABI compiler. This package contains no database, session, relayer, or custody implementation.

Import schemas from `@daclify/core-protocol`, contract codecs from `@daclify/core-protocol/sdk`, and the build-time generator from `@daclify/core-protocol/compiler`. Generated contract types and runtime validators originate from the same compiled C++ ABI. Native RPC reads normalize exact integer transport, `0`/`1` booleans, and legacy public keys; instruction inputs remain strict.

The current development package is 0.6.0-alpha.1 with contract interface 1. `AccountSchema` includes vault accounts with public keys and user-controlled wallet-only accounts with both key fields null; narrow that union before signing or encryption. `VaultAccountSchema` and `JoinIdentitySchema` still require keys. Wallet recovery retains chain DAO/member IDs while a rebuilt service can have a new account UUID. Vault-attachment schemas bind origin, session intent and incoming keys; the API separately verifies current wallet control and signing-key possession.

The development version is unreleased and its interfaces may change. Released consumers must pin an immutable registry version and a tested release manifest. The package does not represent a production security audit or a deployed chain capability.

`@daclify/core-protocol/help` supplies the generated versioned guides and references; `@daclify/core-protocol/documentation` is the producer's build-time documentation generator. API routes and validators are exported from the protocol root. ABI reference hashes identify the source JSON bytes, not Antelope's separately encoded ABI hash. Generated JSON Schema describes structural constraints; contract rules and custom runtime refinements still require their validators and tests.
