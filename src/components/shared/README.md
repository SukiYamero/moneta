# src/components/shared

Cross-feature composed components — distinct from `src/components/ui`
(shadcn primitives only). Everything here is reused across screens, so it
doesn't belong to any one `src/features/**` folder. See `specs.md` §10.5.

- `useOverlay.ts` — internal hook shared by `BottomSheet`/`CenterModal`:
  Escape to close, Tab-trapped focus, body-scroll lock, focus restore on
  close, plus an `initialFocus` escape hatch and `ref` forwarding to the
  panel. Also exports `useEscapeToClose` (used by `DateChipPicker`'s inline
  popover) and the `OVERLAY_PANEL_CLASS` constant. **Nesting-aware**: a
  module-level stack tracks every currently-open overlay ordered by render
  depth (not open/close timing), so when overlays nest — the delete-confirm
  `CenterModal` opening from inside the Movement `BottomSheet` is the real
  case this exists for — only the topmost one handles Escape/Tab-trap/
  initial-focus, and the scroll lock is refcounted against the stack so
  closing the nested modal doesn't unlock the page while the sheet behind
  it is still open. Not part of the public barrel.
- `BottomSheet.tsx` — sliding-sheet shell with real drag-to-dismiss
  (Pointer Events, `setPointerCapture`/`pointercancel`/`lostpointercapture`
  all handled — the last one is the reliable catch-all for a drag that ends
  outside the window). Highest-reuse shell (Filter/Movement/Profile/Add
  sheets, Tag picker). Accepts `initialFocus`/`ref`.
- `CenterModal.tsx` — centered popup shell (Delete confirm, Info tooltip,
  Custom tag modal, Group editor). Accepts `initialFocus`/`ref`.
- `IconAvatar.tsx` — colored rounded-square icon badge; size/tint are
  `Record` lookups onto the `chart-1..5`/status tokens, not new hex.
- `MovimientoRow.tsx` + `movimientoView.ts` — the movement list row, and
  the single source of truth for category → icon/tint and signed-amount
  formatting. Every screen that renders a `Movimiento` imports the mapper
  from here instead of re-deriving it. `formatMonto`'s `Intl.NumberFormat`
  instances are memoized per `Moneda` at module scope (a list this grows to
  years of rows can't afford building one per row per render). Accepts
  `ref`.
- `TagChip.tsx` — icon + name pill (selected/unselected/`disabled`). The
  44px touch target is an invisible-padding wrapper around the visibly
  smaller designed pill (same split `Toggle`/`InfoButton` already use), so
  the hit area grows without inflating the visible chip. Accepts `ref`.
- `DateChipPicker.tsx` — date chip that expands an inline month grid
  (date-fns, Spanish locale). Takes `firstDayOfWeek` as a prop; stays
  repo-agnostic (see `specs.md` §11, 2026-08-18). Escape closes the
  popover via `useEscapeToClose`, correctly outranking an ancestor
  `BottomSheet`/`CenterModal` through the shared overlay stack. Same
  invisible-padding touch-target treatment as `TagChip` on the chip and
  month-nav buttons. Accepts `ref`.
- `SegmentedControl.tsx` — generic pill-group toggle (radiogroup pattern,
  arrow-key navigation), no screen-specific option assumptions. Per-option
  `disabled` (arrow-key nav skips disabled options); keyboard focus moves
  via refs on each segment, not DOM traversal. Same invisible-padding
  touch-target treatment as `TagChip`.
- `Toggle.tsx` — on/off switch (`role="switch"`). Accepts `ref`.
- `InfoButton.tsx` — small "?" affordance that opens an info tooltip
  (the caller owns the `CenterModal` it opens). Accepts `ref`.
- `index.ts` — the public barrel. Component files are never `index.tsx`
  themselves (see `AGENTS.md` § Architecture & file naming).

Dev-only gallery: `src/routes/Kit.tsx` (`/kit`, gated on
`import.meta.env.DEV`) renders every component/variant for visual QA,
including a nested-overlay demo (sheet with a delete-confirm modal inside)
and an `initialFocus` demo.
