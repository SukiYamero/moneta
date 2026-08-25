# src/features/profile

The profile/account sheet (`specs.md` §10.18) — the access point for
identity, profiles, security and data, opened from the Profile slot in
`BottomNav` (state owned by `src/routes/AppShell.tsx`, not this feature —
see `ProfileSheet.tsx`'s own comment for why). It is a door, not its
features: most of what it shows either reads another track's module
directly or is a deliberately inert stub.

- `ProfileSheet.tsx` — the `BottomSheet` shell (`open`/`onClose` props),
  composing the five sections below in order. `BottomSheet` already caps
  itself at `max-h-[88dvh]` with `overflow-y-auto`, so the sheet growing to
  five sections still scrolls inside its own bounds and never pushes
  `BottomNav` off-screen — nothing extra needed here for that.
- `IdentitySection.tsx` — the Google account (name/email from the real
  `authStore.user`, with a "loading" placeholder for the
  `authenticated`-with-`session: null` edge case) and a real sign-out
  button, or an honest "Invitado" state with the sign-in row that is guest
  mode's only exit (`specs.md` §10.10). The CTA/error copy is read from the
  `auth` namespace (`loginErrorCopy`), not duplicated — it's the same
  `authStore.login()` `WelcomeScreen` already exposes, reachable from a
  second place. Sign-out itself goes through `useSignOutConfirm.ts`
  (`specs.md` §10.20), not straight to `authStore.logout()`.
- `useSignOutConfirm.ts` — decides whether sign-out needs the
  `ConfirmDialog` (`specs.md` §10.20): with Drive connected, or with
  nothing unsynced, it calls `authStore.logout()` directly; otherwise it
  opens the dialog, naming the count of distinct movements
  (`src/lib/outbox.ts`'s `listPendingOperations()`, deduplicated by
  `entityId` so two queued edits to the same movement read as one) that
  exist only on this device. The dialog's primary action signs out while
  keeping that data — `authStore.logout()` already keeps it
  (`specs.md` §10.15's "nothing is ever replaced"); this hook only decides
  whether to say so first.
- `ProfilesSection.tsx` + `useProfiles.ts` — the list from
  `src/lib/profiles`'s device-scoped registry, active one marked, **and the
  switcher** (`specs.md` §10.31): tapping any non-active row rebinds the app
  to it via `profiles/switchProfile.ts`'s `switchToProfile()` — no PIN, no
  confirmation, no second rebind path (it reuses `boot.ts`'s own). A
  profile whose database has been cleared reports itself as gone
  (`switchToProfile()`'s owner-marker pre-check finding the marker
  genuinely absent) and offers removal through a `ConfirmDialog` rather
  than failing opaquely. That pre-check's storage read failing (not
  finding the marker absent, but failing to read at all) is a distinct
  `'switch-check-failed'` outcome, surfaced as a toast instead — it must
  never reach the same removal dialog, since a transient read failure is
  not evidence the database is gone (`specs.md` §11, 2026-08-24). The local/default
  profile's name is derived at render time (`profiles.localLabel`, "this
  device"), never the registry's own stored `label: 'Local'` — that string
  is internal bookkeeping, not user-facing copy (`specs.md` §12's
  unlocalized-label finding, closed here). Renders even for a single
  profile (the point is to teach the concept exists). Renaming/consolidating
  are still later work.
- `SyncSection.tsx` + `useSyncWatermark.ts` — the Drive status row
  (`specs.md` §10.26 §4): last sync, pending/syncing/up-to-date, offline.
  Renders nothing for a guest or a signed-in user who never connected
  Drive — no status row promising sync where none exists. **Also renders a
  distinct "sync off — different account" row** (`specs.md` §10.31 §4) when
  the bound profile's `accountKey` doesn't match the currently
  authenticated account — the switcher can bind a Google profile you're not
  signed into, or the local one, while still authenticated as someone else;
  this is said explicitly rather than left to be inferred from a pill that
  never turns green. The three-state indicator comes from `sync/status.ts`'s
  pure `deriveSyncIndicator()` reading `useSyncStore`'s `phase` and
  `useOutboxStore`'s `dirty` directly
  (both reactive); the watermark (`lastPullAt`/`lastPushAt`, for "last
  synced N ago") is not reactive on its own — `ProfileRecord` lives in the
  device-scoped registry, not a store — so `useSyncWatermark.ts` re-reads
  it via `getProfile()` whenever `phase` cycles back to `'idle'`, the one
  moment it could actually have changed.
- `SecuritySection.tsx` — the real production home for the PIN lock's entry
  point (moved off the dev-only `/kit` route, `specs.md` §10.18). Branches on
  identity (`specs.md` §10.2.1, user 2026-08-20): an authenticated account
  gets a row (icon, "Bloqueo con PIN", the `lockStateLabel`
  "Activado"/"Desactivado" status chip) that opens `LockSettings`
  (`src/features/lock/`), the full-screen panel from the design export
  (`docs/ui/design-export-reference.md` §4); a guest gets a single row +
  toggle for the session-less biometric lock (`lockStore.enableGuestLock`/
  `disableGuestLock`, `GuestLockRow` local to this file) — rendered only
  when `lockStore.biometricAvailable`, absent entirely otherwise, never a
  disabled control. `idle`/`authenticating`/`error` render nothing (no
  session yet to protect). A guest never sees a lock control that can only
  fail (closes the backlog item CONFIRMED by the operator, `specs.md`
  §11/§12, 2026-08-20).
- `DataSection.tsx` — the first real caller of
  `exportMovimientosToCsv()` (`src/lib/export`, `specs.md` §10.12), which
  had no UI trigger for a whole stage. Catches its rejection itself (the
  export module doesn't self-catch) and routes it to a toast
  (`docs/error-handling.md` §7): a `RepoError` reuses the exact copy
  Home/Search/History already show for that `RepoErrorCode`
  (`src/lib/errorCopy.ts`'s `repoErrorCopyKey`), anything else falls back
  to one generic `profile:data.exportFailed` key. Also carries the
  "delete stored data" control (`specs.md` §10.20) — the borrowed-device
  answer, shipped visibly inert: a native `disabled` destructive `Button`
  (never wired to an `onClick`) with a `STUB(wave5)` comment on what the
  real thing needs. Never a side effect of signing out.
- `PreferencesSection.tsx` — the entry point into `/settings`
  (`specs.md` §10.24): all four preference rows (`tema`, `monedaPrincipal`,
  `primerDiaSemana`, `idioma`) are real `Link`s to `/settings` carrying the
  current value (the actual controls live there —
  `src/features/settings/`). `tema` joined the other three once Track AE
  shipped the real light theme and the `/settings` picker (`specs.md`
  §10.30, Wave 4.1) — before that `index.html` hardcoded dark, leaving the
  row inert with nowhere to send the tap. Reads
  `LOCALE_LABEL` (`src/lib/i18n/localeLabels.ts`), the one endonym table
  this section and `/settings`'s own language picker both share, and
  `src/lib/weekStart.ts`'s `WEEK_START_KEY` for the `primerDiaSemana` row's
  label — the same shared mapping `/settings`'s `PreferencesEditor.tsx`
  writes through in the other direction.
- `ProfileSectionHeading.tsx` — the one small heading style every section
  above shares (mirrors `FilterSheet.tsx`'s local `SectionHeading`).
- `index.ts` — the public barrel: `ProfileSheet` only. Sections are this
  sheet's own composition, not meant to be reused standalone.

Reads `authStore`, `src/lib/profiles`, `src/lib/outbox` (read-only —
`listPendingOperations()`), `useDataStore`'s `config`, and
`useLocaleFormatting()`/`i18next` directly. Writes nothing to `Repo`/
`Config` — the only state changes this feature makes are `authStore.login`/
`logout` (identity) and whatever `LockSettings` already owned before the
move.
