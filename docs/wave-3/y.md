# Track Y — profile / account screen — report

## What was built and why

A new `src/features/profile/**` (the access point, per `specs.md` §10.18),
opened from the Profile slot in `BottomNav` (its `open` state owned by
`src/routes/AppShell.tsx` — see below for why not `BottomNav` itself), plus
moving `LockSettings` off the dev-only `/kit` route into it.

- `ProfileSheet.tsx` — the `BottomSheet` shell, composing five sections.
  `BottomSheet` already caps at `max-h-[88dvh]` with `overflow-y-auto`, so
  the sheet growing from the original design's two sections to five still
  scrolls inside its own bounds and never pushes `BottomNav` off-screen —
  confirmed by opening it in a real browser at a 390×750 viewport (see
  "Manual verification" below), not just by reading the CSS.
- `IdentitySection.tsx` — **real.** Google account (name/email from
  `authStore.user`) with a sign-out button for an authenticated session, or
  an honest "Invitado" state with the sign-in row that is guest mode's only
  exit (`specs.md` §10.10). Reuses `auth`'s CTA/error copy
  (`loginErrorCopy`) rather than duplicating it — same `login()` action
  `WelcomeScreen` already exposes.
- `ProfilesSection.tsx` + `useProfiles.ts` — **real.** Read-only list from
  `src/lib/profiles`'s device-scoped registry, active one marked. Renders
  even for the single-profile case (confirmed manually: a fresh guest
  session shows one row, "Local" / "On this device" / "Active").
- `SecuritySection.tsx` — **real**, and it's the whole point: wraps the
  moved `LockSettings`.
- `DataSection.tsx` — **real.** First caller of `exportMovimientosToCsv()`
  (`specs.md` §10.12), which had no UI trigger for a whole stage. Catches
  the rejection itself and routes it to a toast (see "Decisions" below).
- `PreferencesSection.tsx` — **deliberately inert**, per row, see next
  section.
- `ProfileSectionHeading.tsx`, `index.ts`, `README.md`.

Edits outside the new folder (all within the brief's blast radius):

- `src/components/shared/BottomNav.tsx` — the Profile slot's `disabled`
  stub (`// STUB(trackG)`) is now real: it takes `profileOpen`/
  `onOpenProfile` props and calls the sheet open, with the same active-tint
  treatment (`text-primary` + heavier stroke) the other tabs already use.
  **Deliberate deviation from the obvious approach:** I initially had
  `BottomNav` import `ProfileSheet` and own its own `open` state directly.
  That's wrong — `src/components/shared/**` is feature-agnostic (no other
  file there imports from `src/features/**`), so a shared shell component
  reaching into one specific feature inverts the intended dependency
  direction and would make `BottomNav` no longer safely reusable outside
  this one wiring. Moved the `open` state and the `<ProfileSheet>` render
  to `AppShell.tsx` (the shell route) instead, which already legitimately
  depends on both `BottomNav` and now `ProfileSheet`. `BottomNav` only
  takes a callback.
- `src/routes/AppShell.tsx` — owns `profileOpen` state, passes it to
  `BottomNav`, renders `<ProfileSheet>`.
- `src/routes/Kit.tsx` / `Kit.test.tsx` — `LockSettings` demo section
  removed; the gallery test now just proves Kit still mounts.
- `src/lib/i18n/index.ts` — added `'profile'` to `I18N_NAMESPACES`.
- `src/lib/i18n/locales/{es,en,es-AR,pt-BR}.json` — new `profile` namespace,
  key-parity verified by the existing `resources.test.ts` (part of the
  green `bun run check` below).
- `src/lib/i18n/README.md` — updated (not operator-owned, see its own
  section list) to mention the new namespace and to correct the stale
  "Out of scope" note about `idioma` (it referenced this exact spec item
  before it existed).

## Which rows are real, which are inert, and why each inert one is inert

**Real:** Identity (account + sign-in/sign-out), Profiles (read-only list),
Security (the moved `LockSettings`), Data (CSV export with a real error
surface).

**Inert, and each for a _different_ already-decided reason** — this was a
deliberate choice: a single blanket "preferences aren't built yet" comment
would have hidden that these are four unrelated blockers, not one:

- **Tema** — `tema` has no runtime effect on the app at all (`specs.md`
  §11, 2026-08-18) and the light palette is unreviewed shadcn scaffold
  (`docs/wave-3-audit-surface.md` §2). A working toggle here would ship a
  control that visibly lies the moment it's tapped.
- **Moneda principal** — no currency-picker control exists yet to write
  through; that's Wave 4+ work, not a one-line addition to this screen.
- **Primer día de la semana** — gated on the `specs.md` §12 History
  `semana`-scope bug, which a working picker would make immediately
  reachable (the seed default rendering, then visibly flipping).
- **Idioma** — not a field on `Preferencias` at all. The row shows the
  _detected_ `i18next` language, not a stored preference, and needs a
  schema addition before a real picker can exist.

Every row is a plain, non-interactive `<div>` (no `disabled` button, no
chevron) — the AreasBanner/BottomNav-stub convention of a disabled button
with a chevron still implies "leads somewhere," which none of these four
rows do. A `role`-less info row reads as "shown for reference," which
`preferences.readOnlyNote` also says explicitly above the list.

## Is the lock now genuinely configurable in a production build?

**Yes — this is the headline change.** Before this track, `LockSettings`
only rendered on `/kit`, which is gated on `import.meta.env.DEV` in
`src/router.tsx` and therefore absent from a production build entirely —
`specs.md` §12's own words: "the lock is only configurable at `/kit` in
dev." It now renders inside `SecuritySection`, reachable from `BottomNav`'s
Profile slot on every route, in every build. Confirmed manually (see
below): opening the sheet as a guest shows the real "PIN (4 dígitos)" /
"Activar lock" controls, not a stub.

The one thing that did **not** change: `LockSettings`' own copy is still
hardcoded Spanish (`src/features/lock/errorCopy.ts`), a documented
exception (`specs.md` §12) this track was told not to expand into. Moving
it into an otherwise fully-translated sheet makes that gap **more visible**,
not less — every other row around it now reads in the user's own language
(confirmed in the manual walkthrough below, running the app in English:
"PIN (4 dígitos)" sits directly under an English "Security" heading). This
is worth the operator's attention as a follow-up, not something I fixed —
retrofitting the lock's i18n is explicitly out of this track's scope.

## Manual verification (not just the test suite)

Ran the app for real (`bun run dev`), entered as guest, tapped the Profile
tab, and inspected the rendered accessibility tree plus a screenshot at a
390×750 mobile viewport:

- Dialog opens with `role="dialog"`, labelled "Profile"/"Perfil".
- Identity: "Guest" + description + a real, focusable "Continue with
  Google" button.
- Profiles: one row, "Local" / "On this device" / "Active" badge — proves
  the single-profile case renders, not just multi-profile.
- Security: the real PIN keypad + "Activar lock" (Spanish, as expected).
- Data: "Export movements (CSV)" button present and enabled.
- Preferences: "System" / "COP" / "Monday" / "English" — all read as plain
  text, zero buttons in that section (`role="button"` query in the
  colocated test returns none).
- The Profile nav button stayed visible and un-obscured behind the sheet
  the whole time — confirms the "never push the nav off-screen" edge case
  by direct observation, not just by reading `BottomSheet`'s CSS.

## Decisions made (for `specs.md` §11)

1. **`BottomNav` stays feature-agnostic; `AppShell` owns the profile
   sheet's `open` state and renders it.** `src/components/shared/**` has no
   existing precedent of importing from `src/features/**`, and inverting
   that direction for one wiring would make `BottomNav` no longer safely
   reusable/context-free. `BottomNav` now takes `profileOpen`/
   `onOpenProfile` props instead.
2. **CSV export failures reuse `home:error.codes.*` for a `RepoError`, one
   generic `profile:data.exportFailed` key for anything else** — not a
   full parallel `error.codes` tree under the new `profile` namespace. The
   likely failure (`repo.ready()`/`list()`) already has reviewed, correct
   copy on three other screens; duplicating it risks the two drifting
   apart, and a second full error-code tree for a failure this rare is
   exactly the "more surface than the blast radius allows" the wave plan
   warns against (`docs/wave-3-plan.md` §0).
3. **The sign-in CTA/error copy stays in the `auth` namespace, not
   duplicated into `profile`.** It's the identical `authStore.login()`
   action `WelcomeScreen` already calls with reviewed, tested copy —
   reusing it via a second `useTranslation('auth')` call in
   `IdentitySection` is more consistent than a second Spanish string to
   keep in sync across four locales.
4. **A locale-code → endonym table (`LOCALE_LABEL` in
   `PreferencesSection.tsx`) is a plain lookup `Record`, not routed through
   `i18next`.** A language's name in itself ("Português (Brasil)") doesn't
   change based on which language the surrounding UI is showing in — same
   class of value as a currency code, which the Moneda row also shows
   un-translated.
5. **Preference rows render as plain `<div>`s, not disabled buttons.** The
   existing disabled-button-with-chevron stub convention
   (`AreasBanner`/`BottomNav`) still implies "leads somewhere." A row with
   no destination at all, ever, in this wave, reads more honestly as plain
   informational text plus the explicit `preferences.readOnlyNote` line
   above it.

## Backlog / deferred (for `specs.md` §12)

- ✅ **Closes**: "The PIN lock has no production entry point once Home is
  rebuilt (Wave 2, Track L)" (`specs.md` §12, the paragraph starting "The
  real Settings entry is Track G's job (Wave 3)"). The lock is now
  reachable and configurable in every build via the profile sheet.
- ✅ **Closes**: "CSV export has no caller-visible error surface yet.
  `exportMovimientosToCsv()` can reject… and nothing catches it because
  nothing calls it. §10.18's button must route that to the toast" —
  `DataSection.tsx` is that button and does exactly that.
- **New, small finding — not fixed by this track (out of blast radius):**
  `src/lib/profiles/profileRegistry.ts`'s `defaultProfileRecord()` hardcodes
  `label: 'Local'` — always literally the Spanish word "Local", regardless
  of the active app language. Confirmed in the manual walkthrough while the
  app was running in English: the Profiles row still read "Local." Whether
  profile labels are domain data (never translated, like a currency code)
  or UI copy (should localize) is a real open question for whoever owns
  `src/lib/profiles/` next — this track only reads and displays the field
  verbatim, per its "no data touched beyond reading the registry" blast
  radius.
- **Not done, correctly out of scope:** switching/renaming/deleting
  profiles, consolidating local data into an account, any working
  preference control, `idioma` on `Preferencias`, the lock's i18n
  retrofit. All per the brief's "do not build"/"decisions already made"
  list, unchanged.

## Doc lines to add (exact file, exact place, exact text)

**`specs.md` §12** — replace the "PIN lock has no production entry point"
paragraph (currently reading "…until it lands, the lock is only
configurable at `/kit` in dev.") with:

> - ✅ **The PIN lock has a production entry point** — closed 2026-08-19
>   (Track Y, Wave 3 stage 3). `LockSettings` moved from the dev-only
>   `/kit` route into `src/features/profile/SecuritySection.tsx`, reachable
>   from `BottomNav`'s Profile slot in every build. Its own copy is still
>   hardcoded Spanish (`specs.md` §12's i18n item, unchanged) — moving it
>   into an otherwise-translated sheet made that gap more visible, not
>   less.

**`specs.md` §12** — mark the "CSV export has no caller-visible error
surface yet" bullet done, append:

> ✅ Closed 2026-08-19 (Track Y). `src/features/profile/DataSection.tsx` is
> the button; it catches `exportMovimientosToCsv()`'s rejection and routes
> a `RepoError` through the existing `home:error.codes.*` copy, anything
> else through one generic `profile:data.exportFailed` toast.

**`docs/waves.md`** — mark Track Y / §10.18 done, Wave 3 stage 3 complete
(same line style as the other completed stage-3 tracks).

**`ARCHITECTURE.md`** — no change needed; `src/features/` is already
listed and this is a new folder inside it, not a new top-level directory.

**`src/lib/README.md`** — no change; this track didn't touch `src/lib`
beyond `src/lib/i18n/` (its own `README.md`, not operator-owned, already
updated directly).

**`src/components/shared/README.md`** — update the `BottomNav.tsx` entry.
Replace:

> Add and Profile have no destination until Wave 3 — rendered `disabled`
> with an `aria-label` and a `// STUB(trackF|trackG)` marker, per the stub
> convention, rather than as dead enabled buttons.

with:

> Add has no destination yet and stays a disabled stub
> (`// STUB(trackF)`). Profile opens the real profile/account sheet
> (`specs.md` §10.18, `src/features/profile`) — `BottomNav` takes
> `profileOpen`/`onOpenProfile` as props rather than owning the sheet
> itself or importing the feature directly, since `src/components/shared/**`
> stays feature-agnostic; `src/routes/AppShell.tsx` owns the `open` state
> and renders `<ProfileSheet>`.

**`src/routes/README.md`** — update the `Kit.tsx` entry. Remove the
sentence "Also hosts `LockSettings`, the only UI that can enable, disable
or manually re-lock the PIN vault — it moved here off `Home` when the
shell was rebuilt, so rebuilding Home's content cannot silently delete the
feature. Its real production home is the profile/account sheet
(`specs.md` §10.18, not yet built)." and replace with:

> `LockSettings` no longer lives here — it moved to
> `src/features/profile/SecuritySection.tsx` (`specs.md` §10.18, Wave 3
> stage 3), the profile sheet reachable from `BottomNav`'s Profile slot in
> every build, not just `/kit`.

Also add an `AppShell.tsx` bullet noting it now owns the profile sheet's
`open` state and renders `<ProfileSheet>` alongside `BottomNav`.

## Spec deltas (where `specs.md` §10.18 or the brief turned out stale)

- §10.18 was written before stage 1/2 landed and doesn't mention a
  **sign-out** control at all — only "the Google account, or 'Invitado'
  with the sign-in row." I added sign-out anyway: it's the direct
  counterpart of the sign-in row the spec does ask for, `authStore.logout()`
  is synchronous and already documented as safe for "a manual UI trigger
  (e.g. a Settings 'sign out' action)" in `lockStore.ts`'s own comments,
  and an Identity section with no way to leave an account would be a
  half-built door. Flagging this as a delta rather than silently doing it:
  if the operator disagrees, it's a two-line removal.
- The brief's "Blast radius… It reads stores; it writes nothing" reads
  literally as "no store writes at all," which would rule out the sign-in/
  sign-out buttons the spec explicitly asks for (`authStore.login`/
  `logout` are store writes). Read this as "no `Repo`/`Config` data
  writes" (matching §10.18's own "Data touched: none directly. Reads
  `Config.preferencias`, the profile registry, and `authStore`" line one
  paragraph up) — identity/session actions are `authStore`'s normal
  surface, the same one `WelcomeScreen` already uses.
- `docs/ui/implementation-plan.md`'s older "Profile sheet" section (written
  before Wave 3 stage 1/2) describes a smaller sheet with a Drive-status
  stub row and working notification/dark-theme toggles — all superseded by
  the newer, larger §10.18 spec this track actually built against. No
  action needed; noting it so a future reader doesn't treat that section
  as current.

## Open questions for the operator

1. Should `profileRegistry.ts`'s default profile label ("Local") be
   localized, or is it correctly domain data (like a currency code)? See
   the backlog item above — I left it untouched since `src/lib/profiles/`
   isn't in this track's blast radius.
2. Is a `LockSettings` i18n retrofit worth prioritizing now that moving it
   here made the hardcoded-Spanish gap more visible (it now sits inside an
   otherwise fully-translated screen, in every locale)? Still explicitly
   out of scope per the brief; flagging the visibility change for a
   prioritization call.
3. I added a sign-out control not explicitly listed in §10.18 (see "Spec
   deltas" above) — confirm that's wanted, or it's a trivial revert.

## `bun run check` output (pasted, real)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:74:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-y

 Test Files  97 passed (97)
      Tests  912 passed (912)
   Start at  20:56:40
   Duration  16.55s (transform 2.55s, setup 17.21s, import 47.01s, tests 20.78s, environment 47.05s)
```

The single `oxlint` warning on `button.tsx` is pre-existing baseline noise
(confirmed present before this track's first commit, unrelated to any file
this track touched). `bun run build` also succeeds (not part of the gate,
run manually to confirm the production bundle isn't broken by the `/kit`
edit).
