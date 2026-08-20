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
- `ProfilesSection.tsx` + `useProfiles.ts` — the read-only list from
  `src/lib/profiles`'s device-scoped registry, active one marked. Renders
  even for a single profile (the point is to teach the concept exists).
  Switching/renaming/consolidating are Wave 5+.
- `SecuritySection.tsx` — the real production home for `LockSettings`
  (moved off the dev-only `/kit` route, `specs.md` §10.18). Only the call
  site moved; `LockSettings` itself still lives in `src/features/lock/`,
  which Track G2 retrofitted through i18n in the same wave
  (`specs.md` §10.24 Prerequisite 4).
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
  (`specs.md` §10.24): the `monedaPrincipal`/`primerDiaSemana`/`idioma` rows
  are real `Link`s to `/settings` carrying the current value (the actual
  controls live there — `src/features/settings/`). `tema` is the one row
  that stays inert and plain text, never a `Link` — `index.html` hardcodes
  dark, so there's nowhere to send that tap; it always reads "Oscuro"
  rather than repeating a stored `tema` that has no effect. Reads
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
