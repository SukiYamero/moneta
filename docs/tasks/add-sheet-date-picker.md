# Add sheet — the date picker floats, on shadcn's calendar

**Goal.** Picking a date opens a floating calendar with room to breathe,
built on shadcn's `Calendar` and `Popover`, instead of the hand-written grid
that expands inside the sheet's flow.

**Why.** The current grid is cramped and it pushes the sheet's content down
when it opens.

## What exists today

`DateChipPicker.tsx` — 180 hand-written lines on `date-fns`. Three concrete
defects, all of which the replacement must not reproduce:

- It renders in normal flow (`{open && <div className="mt-3">}`), so it must
  fit the sheet's width and displaces everything below it.
- `WEEK_ROWS = 6` is fixed, so a five-row month still renders a dead sixth row.
- Day cells are `aspect-square` in a 7-column grid with `gap-1`: about 42px on
  a 390px screen, under this project's own ≥44px touch-target rule.

The project has **no Radix package installed** and no `react-day-picker`.
`src/components/ui/` holds only `button`, `input`, `label`. Overlays are
hand-built on `useOverlay.ts` (`BottomSheet`, `CenterModal`), which owns the
focus trap, the scroll lock and the nesting-aware stack that `specs.md`
§10.5.1 specifies.

## Subtasks

**1. Install and retheme.**
`bunx shadcn@latest add calendar popover` — this adds `react-day-picker` and
`@radix-ui/react-popover` as real dependencies.
Delivers: `calendar.tsx` and `popover.tsx` under `src/components/ui/`,
retyped to this project's rules — **no namespace imports** (the CLI emits
`import * as React`), and every colour, radius and font value replaced with
the named tokens from `src/styles/index.css`. Raw px in a class fails
`bun run lint:units`.
_Most likely failure:_ shipping the generated files as-is. They arrive with
shadcn's own palette and `import * as React`, and `bun run lint` rejects both.
Retheme before wiring anything.

**2. Reconcile Radix's popover with the overlay stack.**
This is the real work, and it exists because the popover opens **inside** a
`BottomSheet` that already owns the screen. Four behaviours must survive:

- **Escape** closes the calendar only, never the sheet underneath it.
- `useHasOpenOverlay()` reports true while the calendar is open, so
  `BottomNav` stays hidden (`specs.md` §10.53).
- Dismissing by tapping outside follows §10.53's rule: the gesture must have
  **started** outside, and it commits on `pointerup`, never `pointerdown`.
- Closing returns focus to the date chip that opened it.
  Delivers: the calendar registered with `useOverlay`'s stack rather than
  running beside it.
  _Most likely failure:_ two overlay systems each thinking they own the
  keyboard, so one Escape closes both layers. Verify against the real nesting,
  not the popover alone.

**3. Replace the grid, keep the contract.**
Delivers: `DateChipPicker.tsx` renders the new calendar and keeps its current
props exactly (`value`, `onChange`, `firstDayOfWeek`, `locale`,
`dateFnsLocale`, `className`, `ref`), so no caller changes.
Must not touch: `MovimientoFormFields.tsx` — the other task in this folder
owns it.
_Most likely failure:_ losing the localisation that works today. The current
picker honours `firstDayOfWeek`, formats weekday initials and month names
through `dateFnsLocale`, and labels each day with a full localised date for
screen readers. `react-day-picker` takes a `date-fns` locale too; pass the
one already resolved rather than letting it default.

## Tests

`src/components/shared/DateChipPicker.test.tsx` (120 lines) pins the
hand-written grid and is replaced, not adapted — delete it and write a new one
against the behaviour in Acceptance above. Cover at least: a five-row month
renders five rows; a day cell meets the 44px floor; Escape closes the calendar
and leaves the sheet open; `BottomNav` is hidden while it is open; the weekday
initials and the first day of the week follow the locale.

Every test must fail if its rule is broken — a case that differs only in an
input value belongs in an `it.each` table.

## Acceptance

- Opening the calendar floats it above the sheet and moves nothing underneath.
- A five-row month renders five rows.
- Every day cell is at least 44px.
- Escape closes the calendar and leaves the sheet open; a second Escape closes
  the sheet.
- `BottomNav` is hidden while the calendar is open.
- Weekday initials, month names and the first day of the week follow the
  active locale, and each day still has a full localised accessible name.
- `bun run check` green, `bun run lint:units` included.

Runs in parallel with the description-field task: that one owns
`MovimientoFormFields.tsx`, this one must not touch it.
