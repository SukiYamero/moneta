# Wave 3

**Goal.** Lay the runtime plumbing every later feature assumes exists: offline entry, a write path, form primitives, per-profile data isolation, export, and the profile/account screen.

**Why.** Two audits found the app still had no real offline entry and no write path at all — Wave 2's screens were read-only against a fake repo.

- Offline entry — a `networkStore` tracks connectivity and the 7-hour offline-write window; a returning user with no network reaches the dashboard from local data instead of bouncing to login; unified error copy across all three screens (specs.md §10.11).
- CSV export — UTF-8 BOM, `;` separator, locale-aware decimal separator, CSV-injection escaping on user-written free text (specs.md §10.12).
- The write path — `dataStore`'s create/update/delete/config mutations apply optimistically, roll back with an inverse transform (not a snapshot) on failure, and enqueue an outbox entry (a hybrid logical clock timestamp) for the future Drive sync to consume (specs.md §10.13).
- Form primitives (`TextField`, locale-aware `AmountField`) and `ConfirmDialog`, built on the existing overlay stack rather than a new one (specs.md §10.14).
- Local data scoping — one dexie database per profile instead of a `profileId` column, so deleting a profile is deleting a database and cross-profile reads are impossible rather than merely discouraged (specs.md §10.15).
- Service-worker updates prompt through the existing Toast instead of silently auto-updating (specs.md §10.16).
- The Profile/account sheet — identity + sign-out, the read-only profile list, the lock settings (moved out of the dev-only kit route), and the CSV export's first real UI trigger (specs.md §10.18).
