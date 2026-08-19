# Track O — category color in `TagChip` (Wave 2.1)

Branch `feat/w21-tagcolor`. Implements `specs.md` §10.8.

## What changed

- `src/components/shared/TagChip.tsx` — `TagChipProps` gained a **required**
  `tint: IconAvatarTint` prop. The icon is now always rendered in that tint
  (`TAG_TINT_CLASSES[tint].icon`), selected or not. Selecting the chip
  applies `TAG_TINT_CLASSES[tint].selectedPill` (border + background + text
  in that tint's color family) instead of the old hardcoded
  `border-primary/40 bg-primary/15 text-primary`. Unselected chips are
  unchanged: neutral surface (`border-border-subtle bg-secondary
text-fg-secondary`), only the icon carries color.
- `src/features/search/FilterSheet.tsx` — the category loop now destructures
  `tint` (not just `icon`) from `getMovimientoVisual` and forwards it to
  `TagChip`. This is the actual bug: the tint was already being computed and
  thrown away.
- `src/routes/Kit.tsx` — the `/kit` TagChip gallery now passes a real tint
  per demo chip (`Comida` → `amber`, `Hogar` → `emerald`, `Regalo` →
  `purple`, matching `movimientoView`'s real `CATEGORY_TINT` for those
  names) instead of leaving color unset, plus a new `neutral`-selected demo
  chip so the "must read as selected" edge case is visible in the gallery,
  not just covered by a unit test.
- Tests: `src/components/shared/TagChip.test.tsx` gained cases for
  icon-always-tinted, selected-pill-tinted-per-category (not primary),
  unselected-stays-neutral, and neutral-selected-visibly-different-from-
  unselected. New `src/features/search/FilterSheet.test.tsx` covers the
  integration: a known category renders its real tint, an unmapped category
  falls back to the type-based tint via the already-tested
  `getMovimientoVisual` fallback, and an unselected chip still tints its
  icon.

## The tint-table question (why a second table, not reuse)

`IconAvatar.tsx`'s `TINT_CLASSES` is `Record<IconAvatarTint, string>` of
`"bg-chart-N/15 text-chart-N"` — built for a filled square badge, no border.
A selected `TagChip` pill needs a _border_ too, and the plain icon (no
background box) only wants the text-color half. Neither can be sliced out of
`IconAvatar`'s combined string at runtime without parsing it, and duplicating
`IconAvatar`'s exact two-class string as a third copy would invite drift.

Chose: a second table, `TAG_TINT_CLASSES: Record<IconAvatarTint, { icon:
string; selectedPill: string }>`, defined in `TagChip.tsx`, keyed on the same
exported `IconAvatarTint` type (so a new tint is a compile error in both
tables, not a silent fallback), and drawing from the identical
`chart-1..5`/`success`/`danger`/`info`/`muted`/`foreground` tokens
`IconAvatar` uses — no new color values anywhere. This is the "second
variant table, obviously derived from the same tint keys and exhaustive"
option the brief allowed for, not a hand-rolled parallel color system.

## The `neutral` case

Unselected pill: `border-border-subtle bg-secondary text-fg-secondary`. In
dark mode `border-subtle` is almost invisible (`rgba(255,255,255,0.04)`) and
`secondary`/`muted` are nearly the same near-black. A neutral tint that just
reused `bg-muted` would have been visually indistinguishable from unselected
— exactly the failure mode §10.8 calls out.

Selected neutral pill uses `border-border-strong bg-muted text-foreground`:
a clearly visible border (`border-strong` vs the near-invisible
`border-subtle`), and `text-foreground` (bright, `#f4f4f5` in dark) instead
of the dimmer `text-fg-secondary` (`#c9cbd0`). Both are existing tokens, no
new hex. Verified in `TagChip.test.tsx`'s "reads visibly different" test and
visible in `/kit`'s new neutral-selected demo chip.

## `tint` is required, not optional/defaulted

Chose no default value (not even `'neutral'`). Precedent: `formatMonto`/
`getMovimientoAmountView`/`MovimientoRow`'s `locale` param (§11,
2026-08-19) — a call site that forgets to pass the real value should be a
compile error, not a silently-wrong render. A defaulted `tint` would have
let a future consumer reproduce the exact bug this track fixes (call
`TagChip` without a real tint and get a uniform fallback color) without
TypeScript ever flagging it.

## Sweep — every `TagChip` consumer

`rg TagChip src` found exactly two render call sites plus the two files
above (barrel export, own test):

1. `src/features/search/FilterSheet.tsx` — fixed (was the bug).
2. `src/routes/Kit.tsx` (`/kit` gallery) — fixed (was passing no tint at
   all pre-existing-prop change; now real per-category tints).

Nothing else renders `TagChip`. No other consumer needed a change.

## §10.8 — nothing found wrong

The spec's visual rule (icon always tinted; selecting tints the whole pill
in that family; unselected stays neutral) matches what shipped without
needing a deviation. The `neutral` edge case is real and was under-specified
in exactly the way the spec anticipated ("must still read as clearly
selected") — resolved as described above, not a spec problem.

## Decisions made (for `specs.md` §11)

- **`TagChip.tint` is required, no default** — same "no silent fallback"
  pattern as `movimientoView`'s `locale` param (§11, 2026-08-19). A missing
  tint is now a compile error at the call site.
- **A second exhaustive `Record<IconAvatarTint, …>` table
  (`TAG_TINT_CLASSES`) lives in `TagChip.tsx` alongside `IconAvatar`'s
  `TINT_CLASSES`**, rather than reusing or extending the latter — a pill
  needs a border class `IconAvatar`'s badge doesn't, and the icon-only half
  can't be sliced out of `IconAvatar`'s combined bg+text string at runtime.
  Both tables are keyed on the same `IconAvatarTint` export so they can't
  silently drift apart on which tints exist.
- **Selected `neutral` uses `border-border-strong bg-muted text-foreground`**
  (not `bg-muted` alone) so it reads as visibly different from the
  unselected pill's `border-border-subtle bg-secondary text-fg-secondary`
  in dark mode, where `border-subtle`/`secondary`/`muted` are all close to
  indistinguishable from each other.

## Backlog / deferred (for `specs.md` §12)

- None. The change is self-contained; no follow-up work identified.

## Doc lines to add (operator-owned files)

- `src/components/shared/README.md`, in the `TagChip.tsx` bullet — append:
  > Takes a required `tint: IconAvatarTint` (from
  > `movimientoView.getMovimientoVisual`, or its type-based fallback) — the
  > icon is always tinted; selecting tints the whole pill in that family via
  > a second `TAG_TINT_CLASSES` table keyed on the same `IconAvatarTint`,
  > kept alongside (not merged into) `IconAvatar`'s `TINT_CLASSES` since a
  > pill needs a border class the badge doesn't.

## Spec deltas

None — the implementation matches §10.8 as written; no field in `specs.md`
needs correction.

## Open questions for the operator

- None blocking. One judgment call worth a sanity check: I picked
  `border-border-strong bg-muted text-foreground` for selected-neutral by
  reasoning about the dark-mode token values (no light design exists yet
  per `docs/ui/design-tokens.md`), rather than against a rendered
  screenshot. Worth a visual glance in `/kit` if you want to confirm it
  reads right rather than just passing the unit test's class assertions.
