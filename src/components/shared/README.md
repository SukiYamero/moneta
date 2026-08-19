# src/components/shared

Cross-feature composed components — distinct from `src/components/ui`
(shadcn primitives only). Everything here is reused across screens, so it
doesn't belong to any one `src/features/**` folder. See `specs.md` §10.5.

- `useOverlay.ts` — internal hook shared by `BottomSheet`/`CenterModal`:
  Escape to close, Tab-trapped focus, body-scroll lock, focus restore on
  close. Not part of the public barrel.
- `BottomSheet.tsx` — sliding-sheet shell with real drag-to-dismiss
  (Pointer Events). Highest-reuse shell (Filter/Movement/Profile/Add
  sheets, Tag picker).
- `CenterModal.tsx` — centered popup shell (Delete confirm, Info tooltip,
  Custom tag modal, Group editor).
- `IconAvatar.tsx` — colored rounded-square icon badge; size/tint are
  `Record` lookups onto the `chart-1..5`/status tokens, not new hex.
- `MovimientoRow.tsx` + `movimientoView.ts` — the movement list row, and
  the single source of truth for category → icon/tint and signed-amount
  formatting. Every screen that renders a `Movimiento` imports the mapper
  from here instead of re-deriving it.
- `TagChip.tsx` — icon + name pill (selected/unselected).
- `DateChipPicker.tsx` — date chip that expands an inline month grid
  (date-fns, Spanish locale). Takes `firstDayOfWeek` as a prop; stays
  repo-agnostic (see `specs.md` §11, 2026-08-18).
- `SegmentedControl.tsx` — generic pill-group toggle (radiogroup pattern,
  arrow-key navigation), no screen-specific option assumptions.
- `Toggle.tsx` — on/off switch (`role="switch"`).
- `InfoButton.tsx` — small "?" affordance that opens an info tooltip
  (the caller owns the `CenterModal` it opens).
- `index.ts` — the public barrel. Component files are never `index.tsx`
  themselves (see `AGENTS.md` § Architecture & file naming).

Dev-only gallery: `src/routes/Kit.tsx` (`/kit`, gated on
`import.meta.env.DEV`) renders every component/variant for visual QA.
