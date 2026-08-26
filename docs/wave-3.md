# Wave 3

**Goal.** Lay the runtime plumbing every later feature assumes exists: offline entry, a write path, form primitives, per-profile data isolation, export, and the profile/account screen.

**Why.** Two audits found the app still had no real offline entry and no write path at all — Wave 2's screens were read-only against a fake repo.

- **Track R** (§10.11) — offline entry: a `networkStore` tracks connectivity and the 7-hour offline-write window; a returning user with no network reaches the dashboard from local data instead of bouncing to login; unified error copy across all three screens.
- **Track S** (§10.12) — CSV export: UTF-8 BOM, `;` separator, locale-aware decimal separator, CSV-injection escaping on user-written free text.
- **Track T** (§10.13) — the write path: `dataStore`'s create/update/delete/config mutations apply optimistically, roll back with an inverse transform (not a snapshot) on failure, and enqueue an outbox entry (a hybrid logical clock timestamp) for the future Drive sync to consume.
- **Track U** (§10.14) — form primitives (`TextField`, locale-aware `AmountField`) and `ConfirmDialog`, built on the existing overlay stack rather than a new one.
- **Track V** (§10.15) — local data scoping: one dexie database per profile instead of a `profileId` column, so deleting a profile is deleting a database and cross-profile reads are impossible rather than merely discouraged.
- **Track W** (§10.16) — service-worker updates prompt through the existing Toast instead of silently auto-updating.
- **Track Y** (§10.18) — the Profile/account sheet: identity + sign-out, the read-only profile list, the lock settings (moved out of the dev-only kit route), and the CSV export's first real UI trigger.
