# Review — Track O (per-category `TagChip` color)

## Done-when verification (ran, not read)

`specs.md` §10.8 "Done when": every category chip shows its own color in
the filter sheet, selected chips are tinted per category rather than
uniformly green, an unknown category falls back to its type tint, and
`bun run check` is green.

Baseline before any review edits: `bun run check` green, 68 files / 638
tests. Then, before trusting any test, broke three separate production
sites by hand and watched the right test fail before reverting:

- Removed `tint` from `FilterSheet.tsx`'s `getMovimientoVisual` destructure
  and the `<TagChip>` call (reproducing the exact original bug — tint
  computed and thrown away) → `FilterSheet.test.tsx`'s tint/fallback tests
  failed with `tintClasses` undefined. Reverted, passes.
- Hardcoded `TagChip`'s selected branch back to the old
  `'border-primary/40 bg-primary/15 text-primary'` → both
  `TagChip.test.tsx`'s "not a uniform primary color" test and
  `FilterSheet.test.tsx`'s two tint assertions failed on the received
  class list. Reverted, passes.
- Deleted the `?? FALLBACK_TINT[m.tipo]` fallback in
  `movimientoView.getMovimientoVisual` → `FilterSheet.test.tsx`'s
  "falls back to the type-based tint" test failed (`tintClasses`
  undefined for the unmapped category). Reverted, passes.

All three fail for the reason the test claims to guard, not a fixture
accident. The suite is load-bearing.

`bun run check` — real output, after my own fixes, rebased to `main`'s tip
(`5dbef1c`, which already includes Track O's merge — Track N had not
landed on `main` as of this review):

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run
 Test Files  68 passed (68)
      Tests  638 passed (638)
```

(The `button.tsx` warning is the pre-existing, accepted shadcn-generated
exception — unchanged by this review. No new lint warnings.)

## Findings

1. **CONFIRMED (fixed) — two independently-authored tint tables, verified
   to agree today, consolidated into one.** Compared
   `TagChip.tsx`'s `TAG_TINT_CLASSES` against `IconAvatar.tsx`'s
   `TINT_CLASSES` key-by-key: every chart-N pairing matched
   (`emerald→chart-1`, `blue→chart-2`, `amber→chart-3`, `rose→chart-4`,
   `purple→chart-5`, plus `success`/`danger`/`info`/`neutral`). No
   mismatch shipped. But nothing enforced that agreement beyond manual
   care, and this was already the **third** independent copy of the same
   "tint name → chart token" fact in the codebase —
   `src/features/history/BreakdownCard.tsx`'s `FILL_CLASS` (Track E4,
   pre-existing, merged before this wave) is a third `Record<IconAvatarTint,
string>` doing the same mapping for a solid-fill progress bar. Rule of
   three: this is a pattern, not a one-off.

   Track O's own report frames the choice as "one table per shape" vs.
   "reuse `IconAvatar`'s exact string," and picks a second table because
   Tailwind's static class scanner needs each full class name as a source
   literal — string interpolation (`` `bg-${x}/15` ``) genuinely doesn't
   work, confirmed correct. But that only rules out _building_ the strings
   from a shared fragment at runtime; it doesn't require the _literal
   tables_ to live in two different files. Extracted a new
   `src/components/shared/tintClasses.ts` exporting one exhaustive
   `TINT_CLASSES: Record<IconAvatarTint, { icon; badge; pill }>` — still
   full literal strings (Tailwind-safe), still exhaustive over
   `IconAvatarTint` (a new tint is still a compile error everywhere), but
   now asserted in exactly one place. `IconAvatar.tsx` reads `.badge`,
   `TagChip.tsx` reads `.icon`/`.pill`. Verified the merge can't silently
   drift again: changed `purple`'s chart number in the new single table
   and watched `TagChip.test.tsx`'s "Compras" test fail immediately — with
   two separate tables that same edit to only one of them would have
   passed every existing test while the row avatar and the chip disagreed
   on Compras' color.

   `BreakdownCard.tsx`'s `FILL_CLASS` is **left alone** — it's Track E4's
   file, out of this track's scope and not part of the diff under review,
   and folding it in too would be a bigger-scoped refactor of an unrelated
   feature. Flagging it for the operator: a follow-up that has
   `BreakdownCard` read `.badge`-adjacent classes from the same
   `tintClasses.ts` (e.g. add a `fill` shape: `'bg-chart-1'` etc.) would
   close out the pattern for good instead of leaving a third, still-
   independent copy standing.

2. **PLAUSIBLE, reasoned from tokens (not rendered) — selected-`neutral`
   is real but marginal in dark mode; moot in light mode.** Computed exact
   WCAG contrast/luminance from `src/styles/index.css`'s actual `.dark`
   values rather than trusting the track's reasoning:
   - Unselected pill: `border-border-subtle` (`rgba(255,255,255,0.04)`),
     `bg-secondary` (`#0f1115`), `text-fg-secondary` (`#c9cbd0`).
   - Selected-neutral pill: `border-border-strong`
     (`rgba(255,255,255,0.1)`), `bg-muted` (`#16181d`),
     `text-foreground` (`#f4f4f5`).
   - Background contrast between `secondary` and `muted` alone: **1.06:1**
     — essentially indistinguishable as a fill; the border-alpha jump
     (0.04→0.1, 2.5×, still faint in absolute terms) and text-color jump
     do the real work.
   - Text self-contrast, `fg-secondary` vs `foreground` side by side:
     **1.48:1**. Both individually read fine against their own background
     (11.6:1 and 16.2:1 respectively, both well past AA), but the
     difference _between_ the two states is a real, correctly-directioned
     signal, not a strong one — well under the ~3:1 that would make it
     unambiguous at a glance.

   This matches what the track's own report already said in its own
   words ("worth a visual glance") — saying so plainly rather than
   upgrading it to a pass. Left unchanged: strengthening it further
   without a new token is a real design tradeoff (e.g. a heavier
   `border-2` instead of `border`, changing every chip's rendered size by
   a hairline) that belongs to the operator's visual judgment, not this
   review's unilateral call. Recommend a literal glance at `/kit`'s new
   neutral-selected demo chip in dark mode before shipping, per the
   track's own open question.

   Light theme is **out of scope entirely**, not a Track O defect:
   `src/styles/index.css`'s `:root` block is an explicitly-labeled
   placeholder (comment: "Light theme is an UNSPECIFIED PLACEHOLDER — no
   light design exists yet", `specs.md` §11 2026-08-18), and its
   `--chart-1`..`--chart-5` tokens are literally achromatic
   (`oklch(0.87/0.556/0.439/0.371/0.269 0 0)` — zero chroma). Every
   category tint renders as a shade of gray in light mode today,
   independent of anything this track touched — the premise of "scan by
   color" simply doesn't hold there yet. Not this track's bug to fix.

3. **CONFIRMED — tests prove the behavior, not just the implementation.**
   Reproduced under "Done-when verification" above: the original bug
   (`FilterSheet` discarding `tint`), the hardcoded-primary regression,
   and the fallback path all make a real test fail for the right reason
   when broken by hand.

4. **CONFIRMED — 44px touch-target split is intact, unmodified by this
   diff.** `TagChip.tsx`'s outer `<button>` still carries `min-h-11`
   (44px) as the sole hit-area sizing class; the inner `<span>` still
   carries `min-h-9` (36px) as the visible-pill size. The diff only added
   `tintClasses` to existing class strings — it never touched the
   button/span split introduced in §10.5.1. `TagChip.test.tsx`'s existing
   "meets the 44px touch-target floor" test still asserts both classes
   independently and passes.

5. **Contrast/legibility, dark theme — no issue found.** Computed WCAG
   contrast from the actual `.dark` tokens: selected `amber` text
   (`#f5b93f`) against its own `bg-chart-3/15` composited over a `#16181d`
   card is **7.4:1** (exceeds AAA's 7:1 for normal text); the always-on
   icon color on the unselected neutral surface
   (`text-muted-foreground` `#85888f` on `bg-secondary` `#0f1115`) is
   **5.3:1** (exceeds AA's 4.5:1, and icons are `aria-hidden` decoration
   with no WCAG text-contrast requirement to begin with). All five
   `chart-*` tints in dark mode are saturated, bright hex values, not
   near-background colors — none is meaningfully lower-contrast than
   `amber`. Light theme's contrast is moot per finding 2 (achromatic
   placeholder).

6. **Minor, left alone — `Kit.tsx`'s demo tints match `CATEGORY_TINT` by
   hand, a soft fourth "copy."** `Comida→amber`, `Hogar→emerald`,
   `Regalo→purple` in `Kit.tsx` do match `movimientoView.ts`'s
   `CATEGORY_TINT` for those three names (checked directly against the
   real table). This isn't a `Record<IconAvatarTint, …>` duplicating the
   _tint→class_ mapping (that's now single-sourced per finding 1) — it's
   three individual prop literals in a dev-only `/kit` gallery matching
   three individual entries in `CATEGORY_TINT` by construction, for
   demo realism. If `CATEGORY_TINT` ever reassigns one of those three
   categories, `/kit` would silently show a stale color with no test
   failure — low-risk (dev-only, visual-QA surface, not shipped
   behavior) and not worth a coupling mechanism for three literals.
   Noting it, not fixing it.

## Sweep — every `TagChip` and `TINT_CLASSES` consumer

`rg` (not the track's own claimed sweep) for every render call site and
every reference to the tint tables:

- `<TagChip` renders: exactly `src/features/search/FilterSheet.tsx` and
  `src/routes/Kit.tsx` (plus `TagChip.test.tsx`'s own cases). Both pass a
  real `tint`. Matches the track's claimed sweep.
- `TINT_CLASSES` references (post-refactor): `IconAvatar.tsx` (`.badge`),
  `TagChip.tsx` (`.icon`/`.pill`), both importing the single
  `tintClasses.ts` table. `BreakdownCard.tsx`'s independent `FILL_CLASS`
  is the one sibling left unmerged — see finding 1.
- Nothing else in `src/` renders `TagChip` or references either tint
  table.

## Fixed vs. left

**Fixed** (with tests watched fail first, see above):

- Consolidated `TagChip.tsx`'s `TAG_TINT_CLASSES` and `IconAvatar.tsx`'s
  `TINT_CLASSES` into one exhaustive table,
  `src/components/shared/tintClasses.ts`, imported by both. Verified the
  Fast-Refresh lint rule (`react/only-export-components`) that would have
  fired on exporting a non-component const from `IconAvatar.tsx` directly
  — moving the table to its own file keeps that warning at zero (checked
  before and after: only the pre-existing, accepted `button.tsx` warning
  remains).

**Left, with reasons** (see findings above):

- `BreakdownCard.tsx`'s `FILL_CLASS` — third independent tint→class table,
  pre-existing (Track E4), out of this track's scope; flagged for a
  follow-up, not folded in here.
- Selected-`neutral`'s marginal (not absent) distinguishability in dark
  mode — real per token math, a design-weight tradeoff to strengthen
  further, left for the operator's visual judgment.
- `Kit.tsx`'s three hand-matched demo tints — low-risk, dev-only, not
  worth a coupling mechanism for three literals.

## Files touched by this review

- `src/components/shared/tintClasses.ts` (new) — the single tint→classes
  table.
- `src/components/shared/IconAvatar.tsx` — reads `TINT_CLASSES[tint].badge`
  from the new file instead of owning its own table.
- `src/components/shared/TagChip.tsx` — reads
  `TINT_CLASSES[tint].icon`/`.pill` from the new file instead of owning
  `TAG_TINT_CLASSES`.

No files owned by Track N (`src/lib/i18n/**`, `src/lib/schema.ts`,
`src/components/shared/movimientoView.ts`, `src/lib/repo.local.ts`,
`src/lib/bootstrap.ts`) were read for anything beyond confirming
`CATEGORY_TINT`'s values, and none were edited.

## Doc line for the operator (not applied — `README.md` is frozen for this review)

`src/components/shared/README.md`'s `IconAvatar.tsx` and `TagChip.tsx`
bullets should each gain a line noting both now read their color classes
from `tintClasses.ts` (new, internal, not in the public barrel — same
"not part of the public barrel" status as `useOverlay.ts`) instead of
owning their own table. Track O's report already drafted a `TagChip.tsx`
bullet addition for the `tint` prop itself (required, no default) —
still accurate and still needs applying; add the `tintClasses.ts`
ownership note alongside it.

## Process note

No systematic blind spot found in Track O's own process — its report
correctly flagged the one thing it couldn't verify (the neutral case,
reasoned not seen) instead of asserting it as done, which is exactly the
right call to make when you can't render pixels. The actual finding is
upstream of this track: `BreakdownCard.tsx` (Track E4) established the
"each consumer owns its own `Record<IconAvatarTint, string>`" pattern
before Track O's, so Track O's second table looks like it followed
precedent rather than introduced a new risk in isolation — worth noting
for whoever eventually revisits `BreakdownCard.tsx`, since the fix there
is the same shape as this review's.
