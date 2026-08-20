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
  second place.
- `ProfilesSection.tsx` + `useProfiles.ts` — the read-only list from
  `src/lib/profiles`'s device-scoped registry, active one marked. Renders
  even for a single profile (the point is to teach the concept exists).
  Switching/renaming/consolidating are Wave 5+.
- `SecuritySection.tsx` — the real production home for `LockSettings`
  (moved off the dev-only `/kit` route, `specs.md` §10.18). Only the call
  site moved; `LockSettings` itself still lives in `src/features/lock/` and
  is untouched, including its still-hardcoded Spanish copy
  (`specs.md` §12) — this section's own heading is the only i18n-routed
  part of this block.
- `DataSection.tsx` — the first real caller of
  `exportMovimientosToCsv()` (`src/lib/export`, `specs.md` §10.12), which
  had no UI trigger for a whole stage. Catches its rejection itself (the
  export module doesn't self-catch) and routes it to a toast
  (`docs/error-handling.md` §7): a `RepoError` reuses the exact copy
  Home/Search/History already show for that `RepoErrorCode`
  (`src/lib/errorCopy.ts`'s `repoErrorCopyKey`), anything else falls back
  to one generic `profile:data.exportFailed` key.
- `PreferencesSection.tsx` — read-only current values for
  `tema`/`monedaPrincipal`/`primerDiaSemana` (`Config.preferencias`) plus
  the _detected_ app language (`idioma` is not a `Preferencias` field yet).
  Deliberately inert this wave — each row carries its own `STUB(wave3)`
  comment explaining why _that_ row specifically can't write yet (three
  different reasons, not one blanket "not built"). Rendered as plain text,
  never a button: a disabled control with a chevron reads as a dead tap
  target, which `specs.md` §11 already ruled out once (the Home
  notification dot).
- `ProfileSectionHeading.tsx` — the one small heading style every section
  above shares (mirrors `FilterSheet.tsx`'s local `SectionHeading`).
- `index.ts` — the public barrel: `ProfileSheet` only. Sections are this
  sheet's own composition, not meant to be reused standalone.

Reads `authStore`, `src/lib/profiles`, `useDataStore`'s `config`, and
`useLocaleFormatting()`/`i18next` directly. Writes nothing to `Repo`/
`Config` — the only state changes this feature makes are `authStore.login`/
`logout` (identity) and whatever `LockSettings` already owned before the
move.
