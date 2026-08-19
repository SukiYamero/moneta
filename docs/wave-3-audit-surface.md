# Wave 3 audit — product-surface foundations

Read-only audit, 2026-08-19. Scope: light theme, the preferences write
path, the guest exit hatch, the shared UI kit's Wave-4 readiness, i18n
completeness, and accessibility as a system — what Track F (movement
sheets + voice), Track G (tags/profile/settings), and Track H (groups)
will trip over on day one. Excludes offline/PWA/storage/repoProvider/auth
and lock internals — see `docs/wave-3-audit-runtime.md` for that half. No
code was changed; §12 items are not re-reported except where materially
worse than recorded.

Confidence key: **CONFIRMED** = traced directly in the code (file/line
cited). **PLAUSIBLE** = reasoned, not traced to a concrete failure.

---

## Ranked findings

### 1. The data store has no write path at all — CONFIRMED, highest priority

`src/lib/dataStore.ts` is 100% read-only: it exposes `movimientos`,
`activos`, `config`, `status`, `error`, and exactly one method, `load()`.
There is no `updateConfig`, no `addMovimiento`, no optimistic-update
helper — nothing. `repo.updateConfig` exists on the `Repo` port
(`src/lib/repo.ts:52`) and is implemented by both `repo.local.ts` and
`repo.fake.ts`, but is called from **zero** production files — only test
mocks (`grep -rl updateConfig src` returns nine files, all `*.test.ts(x)`
or the repo implementations themselves).

This is bigger than "the preferences write path is missing" as framed —
it's "there is no write path for _anything_ yet," and all three Wave 4
tracks need one on day one: Track G for preferences and tags, Track F for
movements, Track H for groups. Today each would independently invent its
own store-mutation pattern, which is exactly the shape of defect
`AGENTS.md` warns about ("fixed in one function, its twin left unfixed in
a sibling").

**What the minimum plumbing looks like**, following the conventions
already established elsewhere in `src/lib` (`docs/error-handling.md` §7,
"an async store/hook method fully owns its own error handling"):

- `dataStore` gains one generic pattern, not five bespoke ones — e.g. a
  `updateConfig(patch)` action that calls `repo.getRepo().updateConfig(patch)`,
  updates `config` in place on success, and on failure raises a toast
  (`src/lib/toastStore.ts`) rather than throwing past the caller, matching
  how `load()` already owns its own error handling end to end.
  `movimientos`/`activos` CRUD (Track F's job) should follow the same
  shape when it lands, not a second convention.
- **Optimistic update is a real decision, not a detail.** `dataStore`'s
  own doc comment says it holds "no derived totals cached here" but does
  cache the raw arrays — a `updateConfig` patch has to decide whether the
  local `config` updates before or after the repo call resolves. Given
  Tier 3 loading (`specs.md` §10.9) puts the busy state on the pressed
  control, not a blocking overlay, the natural fit is: write-through after
  success, control shows its own busy state meanwhile, revert display on
  failure via the existing toast. This is a five-minute decision now;
  after three tracks have each guessed differently, it's a rewrite.
- This blocks item 2 below (preferences) and item 3 (`Config.preferencias`
  needs a fourth field, `idioma`, added before Track G can persist a
  language choice — see item 5) equally; building the write path once,
  generically, serves both plus Track F/H's movement/group writes.

**Take this before Track G starts.** It is a few hours of work
(`dataStore.updateConfig` + a toast-on-failure convention) that removes a
decision three parallel tracks would otherwise each make differently.

### 2. `Config.preferencias.tema` has no runtime effect, and this is a recorded but easy-to-miss trap for Track G — CONFIRMED

`index.html:2` hardcodes `<html class="dark">`. Nothing in `src` ever
touches `classList`, `data-theme`, or `matchMedia('(prefers-color-scheme)')`
— confirmed by grep across `src/**/*.ts(x)`. This is a **recorded, deliberate
decision** (`specs.md` §11, 2026-08-18 "Dark theme actually applied" entry):
"Reading `Config.preferencias.tema` to switch themes at runtime stays
deferred until a light design exists (Track G, settings)." So this is not a
gap nobody noticed — it is explicitly Track G's job, correctly scoped.

Where the audit adds value beyond `specs.md` §12's existing entry (which
only calls out `--chart-1..5` as zero-chroma grey): **the entire `:root`
palette is untouched shadcn scaffold**, not just the chart tokens.
`--primary` is black-on-white (`oklch(0.205 0 0)`), not the app's green;
`--background`/`--card`/`--popover`/`--border` are all generic greys with
no relationship to the dark theme's real `#0c0d10`/`#16181d` palette;
`--success`/`--danger`/`--info`/`--warning` do carry _some_ hue in
`:root` (not flat grey) but are shadcn's own default guesses, not colors
derived from the actual brand. If `.dark` were ever removed or a real
`prefers-color-scheme` check added, the result is not "the design looks
washed out" — it's "a different, un-designed app" (default shadcn look).

**Recommendation, direct:** don't build the light palette now (no design
exists — correctly deferred). Do have Track G's Settings/Profile spec
explicitly decide, before building, whether `claro` is offered as a real
user-facing option at all in Wave 4. Given `:root` is unreviewed scaffold,
shipping a working "claro" toggle now means shipping a broken-looking
screen on purpose. The cheap fix: Track G's `tema` control offers
`oscuro`/`sistema` only for now (with `sistema` behaving as `oscuro` until
the runtime-switch + light values both land), or ships all three with an
explicit "no está terminado" caveat — either is fine, but it should be a
decision written into Track G's `specs.md` §10 entry, not discovered
mid-build. This is a scoping note, not new plumbing work.

### 3. The shared kit has zero form-input story — CONFIRMED, high cost if deferred

`src/components/ui/` has exactly one shadcn primitive installed:
`button.tsx` (confirmed by `ls` and the directory's own README). No
`Input`, `Label`, `Textarea`, `Select`, `Dialog`/`AlertDialog`. No
`react-hook-form`/`zod`/any form-validation library in `package.json`
(only `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge` as
UI-adjacent deps — cheap to add more via `bunx shadcn@latest add`, but
nothing has been).

The one place in the whole repo that renders a text-entry field is the
dev-only `src/routes/Kit.tsx:405`, a raw `<input type="number">` styled
inline (`className="min-h-11 rounded-md border ... "`), no `Label`
association beyond a wrapping `<label>` text node, no error-state
convention, no `aria-describedby` for a validation message. It isn't a
reusable component — it's a one-off demo — and it's the closest thing to
prior art Track F has for the Add/Edit sheet's amount input.

The delete-confirm demo (`Kit.tsx:356-384`) makes the same point from a
different angle: `button.tsx` **already has** a `destructive` variant
(`bg-destructive/10 text-destructive ...`) and a `secondary` variant, but
the demo hand-rolls two raw `<button>` elements with inline Tailwind
classes instead of using them. There is no shared `ConfirmDialog` built on
`CenterModal` — every future delete confirmation (Track F's movement
delete, Track H's group delete) starts from a blank `CenterModal` and
reinvents title/message/cancel/confirm layout, and on today's evidence
won't even reach for the `Button` variants that already exist.

**What Track F/G/H actually need on day one:**

- A `TextField`/`AmountInput` pattern (label + input + error text +
  `aria-describedby`, 44px touch target) — Track F's amount/description
  inputs and Track G's tag-name input both need this same shape.
  `type="number"` for money is itself a known-bad default (native
  spinner arrows, no control over locale grouping); worth deciding now
  whether Track F builds a text input with `inputMode="decimal"` and a
  manual parse, rather than re-discovering this mid-implementation.
- A `ConfirmDialog` (built on `CenterModal`, using `Button`'s existing
  `destructive`/`secondary` variants) — Track F's delete-movement and
  Track H's delete-group both need one; building it once now means both
  tracks consume it instead of each hand-rolling their own.
- A settings-row/list-item pattern for Track G's "Personalizar" screen —
  nothing today establishes what a labeled row with a trailing
  control (toggle/chevron/value) looks like as a reusable primitive; every
  existing screen is bespoke layout, not a list of settings rows.

None of this needs to be fully built now — but the _first_ of Track F/G/H
to touch a form field will otherwise invent the pattern for all three, the
same "shared kit built one wave early" reasoning that already justified
building Toast and the overlay stack ahead of schedule (`docs/waves.md`
Wave 3 intro). Given all three land in the same wave, one short session
building `TextField` + `ConfirmDialog` (a day, not a track) removes a
three-way collision. This is the single highest-value item in this audit.

### 4. `Config.preferencias` is missing the locale field Track G needs to persist a language choice — CONFIRMED, small but easy to miss

`src/lib/schema.ts`'s `Preferencias` interface has exactly three fields:
`tema`, `monedaPrincipal`, `primerDiaSemana`. There is no `idioma`. This
matches a recorded decision (`specs.md` §11, 2026-08-19, "the chosen
locale is not persisted in Wave 2... persistence, the `Preferencias`
field, and the picker land together in Track G") — so this is expected,
not a surprise. Flagging it here only because it's concrete prep: Track G
needs an additive `schema.ts` change (`idioma?: SupportedLocale` or
similar) before it can wire a language picker to anything, and per
`AGENTS.md` that's a `specs.md` §10 addendum to write first, same as
Track H's `Grupo` type. Cheap (minutes), but worth naming explicitly so it
doesn't get discovered mid-implementation the way the write path would be.

### 5. i18n key parity IS enforced — correcting a possible misreading, not a gap

Worth stating plainly since the brief asks "is key parity enforced or only
by hand": **it is enforced**, by `src/lib/i18n/resources.test.ts`, which
flattens all four locale JSON files to dotted key paths and asserts
`en`/`es-AR`/`pt-BR` match `es` exactly (including treating an empty
namespace `{}` as distinct from an absent one). This runs under `bun run
test`/`bun run check`. The `i18n/README.md`'s own "Adding a key" section
says the other three files must be kept in parity "by hand (or a future
lint pass, not built yet)" — that line is now **stale**; the lint pass
exists as a test. Small doc fix, not a Wave 4 blocker, but worth a
one-line correction next time that README is touched so a future agent
doesn't believe parity is unguarded when it isn't.

What genuinely remains ungoverned, beyond what `specs.md` §12 already logs
(the lock feature entirely un-i18n'd; `DateChipPicker`'s three aria-labels):

- `src/components/shared/InfoButton.tsx:16` — `label = 'Más información'`
  is a hardcoded Spanish default prop, in the **shared kit**, not a
  feature screen. It isn't used in any production screen yet (only
  `Kit.tsx`), but Track G's Settings/info affordances are the obvious
  first real caller (`docs/ui/implementation-plan.md`'s Settings section
  mentions "?" tooltips), so this will surface the moment it's used
  outside the dev gallery. Worth a translation-key default before that.
- No other production hardcoded Spanish found outside `Kit.tsx` (dev-only,
  fine) and the already-logged lock feature — the sweep across
  `src/features/**` and `src/routes/**` came back clean otherwise.

**Not itself a blocker for Track G's language picker** — the picker only
needs `resources.ts`/`detectLocale.ts`'s existing `SupportedLocale` type
plus `i18next.changeLanguage()`, both already wired and tested
(`localeFormatting.test.ts` confirms components re-render correctly on a
language change). The gap is narrow and already mostly closed.

### 6. Accessibility is a real system at the overlay level; forms have no equivalent yet — mixed, not a one-off-fixes story

Correcting the framing in the brief: overlay-level a11y is **not**
one-off case-by-case fixes. `useOverlay.ts`'s module-level stack (Escape,
Tab-trap, focus restore, refcounted scroll-lock, ordered by render depth
so nesting resolves correctly) is a genuine, tested system
(`useOverlay.test.tsx`'s "nested overlays" suite), and every current
overlay (`BottomSheet`, `CenterModal`, `DateChipPicker`'s popover,
`YearMenu`) goes through it or its `useEscapeToClose` sibling. `Toast`
uses `role="alert"`/`role="status"` correctly and stays keyboard-dismissible
per WCAG 2.2.1. This part does not need Wave 4 pre-work — Track F's
Movement sheet and Track H's Group editor can build directly on
`BottomSheet`/`CenterModal` and inherit correct focus/Escape/scroll-lock
for free, including the nested case (delete-confirm inside the movement
sheet — already demoed and tested).

What has **no equivalent system yet**, because no form field exists yet
(same root cause as item 3): label-to-input association,
`aria-describedby` for a validation error, `aria-invalid` on a bad amount
entry, a live-region announcement for a save success/failure beyond the
already-solid toast. This isn't "one-off fixes were made instead of a
system" — it's "the system doesn't exist because there's been nothing to
build it against." It becomes real the moment `TextField` (item 3) gets
built, so it's the same work, not separate work — no additional
recommendation beyond item 3.

---

## What I would explicitly not do before Wave 4

- **Do not build the light theme's real color values.** No design exists;
  guessing values now is wasted work the moment a real light design lands,
  and it's explicitly deferred in `specs.md` §11 already. The only
  pre-work worth doing is the scoping note in item 2 (don't expose a
  broken `claro` toggle).
- **Do not build guest-mode persistence (a device marker for
  `status: 'guest'` surviving reload) ahead of Track G.** Mechanically
  it's trivial — `src/lib/deviceStore.ts` already has the exact pattern
  (`hasLoggedInBefore`/`markLoggedIn`, an additive Dexie version bump) to
  copy for a `wasGuest` marker — but persisting it _before_ Track G's
  Profile screen exists would trap a guest with literally no in-app path
  to sign in with Google (the only such affordance today is
  `WelcomeScreen`, which a persisted guest would never see again). Track G
  owns both halves already (`docs/waves.md`: "profile sheet (including the
  Drive reconnect row...)"); building persistence without the exit hatch
  in the same change would recreate the exact problem the current
  no-persistence choice avoids. This is correctly sequenced as-is — not a
  Wave 3 foundational gap.
- **Do not add `react-hook-form`/`zod` speculatively.** `TextField`/
  `ConfirmDialog` (item 3) don't need a form library for a handful of
  simple fields (amount, description, tag name) — a library is worth
  evaluating once Track F's actual validation needs are known (e.g. is
  "amount must be positive" the only rule, or does Track G's settings
  screen need more), not decided in the abstract now.

## Single highest-value recommendation

Build the shared kit's missing **form primitives** (`TextField`/
`AmountInput` pattern + `ConfirmDialog` on `CenterModal`, using `Button`'s
already-existing `destructive`/`secondary` variants) and the **generic
write path** on `dataStore` (`updateConfig` + one write-then-toast
convention other writes follow) before Wave 4 starts. Both are small
(day-scale, not track-scale), both are things all three of Track F/G/H
independently need on their first day, and both are exactly the kind of
shared-foundation-built-one-wave-early move that already paid off for
Toast and the overlay stack this wave (`docs/waves.md`'s own stated
reasoning for building Toast ahead of Track F/G/H). Skipping this means
three parallel tracks each invent a text-input pattern, a delete-confirm
layout, and a config-write convention independently — precisely the
"fixed in one function, its twin left unfixed in a sibling" defect shape
`AGENTS.md` calls out as the project's most expensive recorded lesson.

## Where I think the Wave 4 framing itself is slightly off

Track G's brief (`docs/waves.md`) lists "Tag picker, custom tag modal,
profile sheet..., 'Personalizar' settings screen" but doesn't explicitly
name the preferences write path or the `idioma` schema field as
deliverables — they're implied by "settings screen" but easy to treat as
in-scope-when-convenient rather than a hard prerequisite the screen can't
function without. Given item 1 (no write path exists anywhere) and item 4
(`idioma` doesn't exist in the schema), I'd make both explicit line items
in Track G's `specs.md` §10 write-up when that track starts, rather than
leaving them to be discovered as blocking dependencies mid-build.
