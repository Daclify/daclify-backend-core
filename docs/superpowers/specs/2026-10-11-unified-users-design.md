# Unified public Users directory

The Users page presents people who belong to Daclify DAOs, including members who have not published a profile. Each person has one card containing their published avatar, name, introduction summary, location, public contact details, links to their DAOs, and latest successful DAO action. The user selected DAO activity rather than sign-in activity. Both cards and list views remain available.

## Existing data and identity

The Hub registers deployments, not people. Membership and profile records currently belong to a runtime and DAO. Private service accounts may pair several memberships, but those pairings are not public identity evidence. This feature uses existing records; it does not introduce a Hub identity registry or change admission, credentials, profiles, balances or permissions.

Group memberships within the same chain and runtime using the same native account, or the same current signing public key. The API exposes a SHA-256 fingerprint of that public key, never signing/encryption secrets or service account identifiers. Distinct native accounts sharing a key remain separate; an ambiguous key cannot attach an unpaired membership to either account. Similar names, contact details and avatars never establish identity. Different unlinked keys remain separate until a future explicitly authorized public identity mechanism exists.

Select a published profile deterministically by ascending DAO/member ID; preserve each original profile and its editing ownership. Aggregate all proven memberships and the maximum recorded activity time. A direct membership profile URL may display that membership's own profile while showing its proven community connections. Private pairings may mark the viewer's own cards, but do not combine other people's records.

## Public data and presentation

Include every public on-chain membership, regardless of profile publication or active status. Encrypted DAO contents stay encrypted; their already-public membership facts remain visible. Show inactive membership status separately from activity. Contact fields come exclusively from published profiles. HTTPS social links and validated email/Telegram links must be safe; malformed contact text may be displayed without turning it into a URL.

Automatically read up to 20 bounded membership pages per loading batch, progressively showing results. Continue automatically to completion for small directories, including the current testnet DAOs. Larger directories have an explicit load-more button and truthful partial-search/membership copy. Reject repeated or backwards cursors, ignore responses from an old deployment/account or unmounted page, retain prior results on an error, and retry the failed cursor. Independent operator deployments remain restricted to their configured DAO.

Use accessible profile links and separate DAO/contact links, without nested anchors. Preserve the existing visual theme, avatar error fallback, mobile layout, keyboard access, search and persisted cards/list preference. The detail page shows community memberships with DAO links and per-membership profile links. Editing remains available only for the viewer's own membership.

## Authoritative activity

Existing ordinary members have no action timestamp. Add a separate DAO-scoped `memberacts` table with member ID and uint32 chain time, preserving the serialized `members` layout consumed by modules. New enrollment reserves an activity row with zero time; enrollment itself is not user activity. Every authenticated instruction dispatch updates the actor's existing row, covering native, signing-key, scoped-session and EVM submissions as well as installed module actions. Transaction failure rolls back the activity timestamp and nonce together. Direct administrative calls and sign-ins do not count as member activity.

Existing rows are initialized to zero using a bounded governance-authorized `initactivity(dao_id, after, limit)` action (maximum 50 members per call). Initialization is idempotent and never rewrites known timestamps. Until initialized, legacy dispatch continues without allocating RAM on a withdrawal or completion path. The API returns null for absent or zero activity; the UI says “DAO activity not recorded.” Historical activity is not fabricated or reconstructed from executive appointments. Initialization and new enrollment use ordinary metered RAM accounting; timestamp updates have a constant row size.

## Delivery and authorization

Implement and review inline, test actual compiled WASM and native signed transactions, update producer-owned SDKs and all pinned consumers, and update generated references and user guides. The standing workspace authorization covers source commits and pushes on `dev`. Preparing a tested runtime/API/frontend rollout is authorized; broadcasting the new runtime or restarting public services requires approval of the concrete new packet. The earlier audit rollout approval does not cover this feature. Oracle runtime pins must move together with any eventual runtime upgrade.
