# Review — General pass over Wave 2 / 2.1 / 2.2 (all eleven tracks)

Scope: everything that landed today, read at its current end state (not as
diffs) — Track M (locale wiring) through Track Q (guest entry), plus the
operator's own follow-up commits (`9f74153`, `74ddcbe`). Every track already
got its own scoped review; this pass hunts only for what a single-track
reviewer structurally cannot see: drift between tracks, a rule applied once
and not on its twin, dead seams, and consistency of the shared surface.
Rigor: high. `git log` reviewed back through `1af5117` ("close Wave 2");
read the current state of every file named in `docs/wave-2.1/*.md` and
`docs/wave-2.2/*.md`, `specs.md` §10.7–§10.10/§11/§12, `ARCHITECTURE.md`,
and every `README.md` under `src/`.

## Findings

### 1. CONFIRMED, fixed — Search and History's inline error state was two byte-identical, independently-owned copies

`SearchScreen.tsx` had a local `ErrorState` component; `HistoryScreen.tsx`
had the exact same JSX (same wrapper classes, same `role="alert"` paragraph,
same retry-button classes) inlined directly, not extracted. Diffed the two
byte-for-byte — identical except for the prop names feeding `t()`. Traced
when this happened: Track P's restructure (`a023e13`) touched the
surrounding loading logic in both files and explicitly left this markup
alone in each (visible in the diff — the loading state was unified, the
error state was not). This is the same shape as the tint-table duplication
this wave already fixed once (Track O, `docs/wave-2.1/review-o.md` finding

1. and the calibration example in this pass's brief — "the same concept
   solved the same way twice, un-shared" rather than "two ways," but the fix
   is the same: one file, one source.

**Fixed.** Extracted `src/components/shared/InlineErrorState.tsx`
(`message`/`retryLabel`/`onRetry` props, unchanged markup/classes — no
visual or behavioral change), exported from the barrel, and pointed both
`SearchScreen.tsx` and `HistoryScreen.tsx` at it. TDD: wrote
`InlineErrorState.test.tsx` first, watched it fail (`Failed to resolve
import`), then implemented. Existing `SearchScreen.test.tsx`/
`HistoryScreen.status.test.tsx` error/retry tests pass unchanged — they
query by `role`/text, not component identity.

**Left alone, escalating:** `HomeErrorState.tsx` renders the same
situation (a content region failing to load while the screen's chrome
stays mounted — verified `Home.tsx` keeps `HomeHeader` + the search link
mounted through the error state, same as Search/History) with a visibly
different treatment: a card, a danger-tinted icon badge, and a
primary-colored button, versus `InlineErrorState`'s bare text and a
secondary-outlined button. This is a real three-screen inconsistency, not
a structural difference I can resolve by inspection — whether Home should
adopt the lighter treatment, or Search/History should adopt Home's card,
is a design call. I deduplicated the redundant copies; I did not unify
the two distinct visual treatments.

### 2. CONFIRMED — `docs/waves.md`'s Wave 2.2 status and worktree log are stale

Not touched (frozen for this review) — exact lines for you to apply:

- The worktree log (`docs/waves.md`, "Worktree log" table) still lists:
  ```
  | 2026-08-19 | Wave 2.2 · Track P (loading) | `../moneta-worktrees/loading` | `feat/w22-loading` | active | Spec: `specs.md` §10.9.  |
  | 2026-08-19 | Wave 2.2 · Track Q (guest)   | `../moneta-worktrees/guest`   | `feat/w22-guest`   | active | Spec: `specs.md` §10.10. |
  ```
  `git worktree list` (run from the main worktree) shows neither path
  exists on disk — only `main` and this review's own worktree are
  registered. Both tracks' feature branches and both review branches are
  merged to `main` (`f78d09e`, `b1197a0`, `53908be`, `a665aa4`). Both rows
  should be deleted.
- The `## Wave 2.2 — active (user-reported adjustments, 2026-08-19)`
  section header is stale for the same reason: both tracks shipped, both
  were reviewed, and the one seam the section calls out between them
  ("the operator swaps one for the other after both merge") was already
  closed by `9f74153`. This wave should get the same closing treatment
  Wave 2.1 got (`## Wave 2.1 — ✅ COMPLETE (merged to main, 2026-08-19)`).

### 3. CONFIRMED — four "doc lines to add" from N/O/P/Q reviews are still unapplied; two of the drafted lines are now themselves wrong

Checked the current content of every README named in `docs/wave-2.1/*.md`
and `docs/wave-2.2/*.md`'s "Doc lines to add" sections directly (not
trusted from the reports) — none of the following have landed:

- `src/lib/i18n/README.md` — Track N's three items (the `detectRegion()`
  addendum on the `detectLocale.ts` bullet, the new `regionCurrency.ts`
  bullet, the "Out of scope" caveat). Still exactly as drafted in
  `docs/wave-2.1/track-n.md` — apply verbatim.
- `src/lib/README.md` — Track N's `seedConfig.ts` bullet and the
  `repo.local.ts` note; Track Q's `authStore.ts` append (`continueAsGuest()`).
  Still exactly as drafted — apply verbatim.
- `src/features/history/README.md` — Track N's `BreakdownCard.tsx` sign
  note and Track P's `HistoryScreen.tsx` chrome-stays-mounted rewrite.
  Still exactly as drafted — apply verbatim.
- `src/features/home/README.md` — Track P's `HomeLoadingState.tsx` append
  and review-q's `HomeHeader.tsx` guest-label append. Still exactly as
  drafted — apply verbatim.
- `src/features/auth/README.md` — review-q's guest-entry paragraph on the
  `RequireAuth.tsx` bullet. **Needs a correction before applying**: the
  drafted text still describes the closed-over `SEAM(track-p)` inline
  boot placeholder ("renders a minimal inline boot placeholder (marked
  `SEAM(track-p)`)... instead of flashing `WelcomeScreen`"). `9f74153`
  already replaced that placeholder with the real `ScreenLoading`. Apply
  the paragraph with that sentence swapped to: "`RequireAuth` also renders
  the shared `ScreenLoading` (Tier 1, specs.md §10.9) while the mount-time
  `restore()` attempt is still settling, instead of flashing
  `WelcomeScreen` — gated by a `booted`/`attemptedBoot` ref pair, not
  `status` alone, so an explicit `login()` from an already-visible
  `WelcomeScreen` (or a `StrictMode` double-invoke) isn't mistaken for the
  boot span."
- `src/features/search/README.md` — Track P's `SearchScreen.tsx` loading
  append. Still accurate as drafted — apply verbatim.
- `src/components/shared/README.md` — Track P's `Skeleton.tsx`/
  `ScreenLoading.tsx`/`usePendingDelay.ts` block, and Track O's
  `TagChip.tsx` tint append. **The Track O line needs a correction, not
  verbatim application**: it says the pill's tint table is "kept alongside
  (not merged into) `IconAvatar`'s `TINT_CLASSES`" — that was true when
  Track O wrote it, but `docs/wave-2.1/review-o.md`'s own fix consolidated
  both into one `src/components/shared/tintClasses.ts` the same day.
  Pasting the draft verbatim would introduce a fresh inaccuracy on arrival.
  Apply instead: "Takes a required `tint: IconAvatarTint` (from
  `movimientoView.getMovimientoVisual`, or its type-based fallback) — the
  icon is always tinted; selecting tints the whole pill in that family via
  the shared `TINT_CLASSES` table in `src/components/shared/tintClasses.ts`
  (also used by `IconAvatar`, not a separate copy)." Also add, after the
  `Toaster.tsx` bullet: the `Skeleton.tsx`/`ScreenLoading.tsx`/
  `usePendingDelay.ts` block from `docs/wave-2.2/track-p.md`'s "Doc lines
  to add", **with its `ScreenLoading.tsx` bullet's last sentence corrected**
  the same way as the auth README above (`RequireAuth.tsx`'s own
  `BootScreen` placeholder → drop the sentence entirely, or replace with
  "used directly, ungated, at both its call sites: boot (`RequireAuth.tsx`)
  and the `/kit` lazy route's `Suspense` fallback (`router.tsx`)"). Also
  add a `tintClasses.ts` bullet (not drafted by either track): "Single
  source of truth for tint name → Tailwind class strings, in the `icon`/
  `badge`/`pill` shapes `IconAvatar.tsx` and `TagChip.tsx` each need —
  not part of the public barrel (`docs/wave-2.1/review-o.md`)." Also add
  an `InlineErrorState.tsx` bullet for this review's own extraction (see
  finding 1): "the minimal inline error state Search and History share
  for a mid-screen load failure (`message`/`retryLabel`/`onRetry`) —
  distinct from `HomeErrorState`'s card treatment, whether intentionally
  is an open question (this review, `docs/wave-2.2/review-general.md`)."

This is the same process gap `specs.md` §12 already names ("'Doc lines to
add' is a checklist to execute, not a section to read") recurring across
four more tracks after the one instance already logged — worth noting as
confirmation it's systemic, not a one-off, rather than a new finding in
its own right.

## Seams checked and found clean

- **Locale key parity.** Diffed the full key set of all four
  `src/lib/i18n/locales/*.json` files programmatically (not eyeballed) —
  identical across `en`/`es`/`es-AR`/`pt-BR`, including the keys Track Q
  added and the `auth:boot.loading` key Track Q added and `9f74153` then
  removed from all four consistently (no orphan in any one file).
- **Dangling seams.** Grepped for `SEAM(` and `STUB(` across `src/` —
  zero `SEAM()` markers remain (the one that existed, `SEAM(track-p)` in
  `RequireAuth.tsx`, was closed by `9f74153`); every remaining `STUB()` is
  a legitimate forward-reference to an unbuilt Wave 3 feature
  (`repoProvider.ts`, `AreasBanner.tsx`, `HomeHeader.tsx`'s notification
  bell, `BottomNav.tsx`'s Add/Profile slots, `SearchScreen.tsx`'s result
  rows), not a cross-track handoff left open.
- **`ScreenLoading` usage consistency.** Now used identically, ungated by
  `usePendingDelay`, at both its call sites — boot (`RequireAuth.tsx`,
  since `9f74153`) and the `/kit` lazy route's `Suspense` fallback
  (`router.tsx`). Track P's review flagged that gating boot's loader would
  have been "a new pattern, not a copy of an existing one" if the operator
  chose to gate it; the operator instead made both call sites match by
  leaving both ungated — consistent either way, and now actually
  consistent rather than hypothetically so.
- **Guest cannot bypass the PIN lock.** Re-traced independently of
  `docs/wave-2.2/review-q.md`'s finding 2, same conclusion:
  `continueAsGuest()` is only reachable from `WelcomeScreen`, which
  `AppLock` withholds behind `LockScreen` whenever a vault exists
  (`lockStore.init()`'s phase resolution depends only on `hasVault()`,
  never `authStore.status`). Structurally impossible for a guest to exist
  "behind" an unresolved lock, not merely untested.
- **The `HomeHeader.tsx` guest-name fix (review-q finding 3) is complete.**
  Re-ran the sweep independently: `rg '\.user\b'` across `src/`, excluding
  tests and `authStore.ts`/`lockStore.ts`/`src/features/auth/**` — zero
  hits outside `HomeHeader.tsx`, which now branches on
  `status === 'guest'` before reading `user`. Nothing else reads `user`
  past the guard.
- **`tintClasses.ts` stayed the single source.** Grepped every
  `TINT_CLASSES`/`Record<IconAvatarTint` reference introduced since
  Track O's consolidation — only `IconAvatar.tsx` and `TagChip.tsx`
  import it, nothing reintroduced a local copy. `BreakdownCard.tsx`'s
  `FILL_CLASS` (the fourth, pre-existing copy) is unchanged and already
  logged in `specs.md` §12 — correctly out of scope for every track today,
  including this one (not part of any Wave 2.1/2.2 track's files).
  Confirms the calibration example the brief named is fully accounted for:
  three copies became one (Track O), the fourth remains logged, not
  rediscovered as new.
- **Locale-namespaced `loading` strings are not a duplicate of
  `common.loading`.** Each of `home`/`search`/`history`'s `loading` keys
  is screen-specific copy ("Cargando tu resumen…" / "Cargando
  movimientos…" / "Cargando tu historial…"), read by that screen's
  `SkeletonGroup` label; `common.loading` ("Cargando…") is the separate,
  intentionally generic string `ScreenLoading` uses for Tier 1. Two
  different keys serving two different tiers, not the same fact stored
  twice.
- **`authGeneration`, `logout()`/`lockStore.lock()`, `DateChipPicker`
  aria-labels, selected-`neutral` contrast, `BreakdownCard`'s `FILL_CLASS`,
  the light-theme achromatic `chart-*` tokens, and the `HistoryScreen`
  `semana`-scope seed-default flip** — all already in `specs.md` §12 or
  §11, all still accurately described there against the current code. Not
  re-reported.

## What I applied vs. escalated

**Applied** (see finding 1): extracted `InlineErrorState.tsx`, wired into
`SearchScreen.tsx`/`HistoryScreen.tsx`, TDD'd, zero behavior/markup change.

**Escalated, not touched:**

- Finding 1's remainder — whether `HomeErrorState` and `InlineErrorState`
  should look the same (design call).
- Finding 2 — `docs/waves.md`'s stale Wave 2.2 header and worktree-log rows
  (frozen file for this review).
- Finding 3 — the outstanding README doc lines, two with corrections
  (frozen files for this review).

## Systematic blind spot, visible only from the aggregate

Every one of the four still-unapplied "doc lines to add" sets (N, O, P,
Q) was correctly _drafted_, in most cases precisely — the individual
tracks did their job. The gap is structural: **the wave plan makes
existing-README edits operator-owned specifically so tracks don't
clobber each other's in-flight edits to the same file, but nothing in the
process re-surfaces those drafted lines once the operator is past the
track that wrote them.** Five wave-2/2.1 doc-line sets are now sitting
unapplied at once, two of them already stale relative to the code they
describe by the time anyone would apply them (the `BootScreen` seam
closing out from under Track P's own draft, Track O's consolidation
closing out from under its own draft). A README that's "still accurate"
the day it's written and quietly wrong three commits later is worse than
one that was never updated — it reads as trustworthy. The fix isn't
another instruction to remember to apply doc lines; it's that "doc lines
to add" drift the moment the code they describe changes again, so the
operator either needs to apply them same-day, every time, or the next
general review (this pass) needs to re-verify each one against current
code before handing it over rather than re-forwarding the original draft
— which is what this pass did, and how the two corrections above were
caught.

## `bun run check` — real output

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  75 passed (75)
      Tests  700 passed (700)
```

Rebased on `main`'s tip (`74ddcbe`) immediately before this run — re-checked
`main` had not moved since (`git fetch origin main`, still `74ddcbe`)
before finalizing, per the process fix `specs.md` §12 already names for
review dispatch racing a moving `main`. The one oxlint warning is the
pre-existing, accepted shadcn-generated `button.tsx` exception every prior
review in this wave also notes — untouched here. Up from the prior 699
(Track P review's final count): +1 for `InlineErrorState.test.tsx`.
