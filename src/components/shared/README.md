# src/components/shared

Cross-feature composed components — distinct from `src/components/ui`
(shadcn primitives only). Anything used across more than one
`src/features/**` screen lives here. Public surface: `index.ts` (component
files are never `index.tsx` themselves).

## Overlay shells

- `useOverlay.ts` — shared Escape/Tab-trap/scroll-lock/focus-restore hook
  for `BottomSheet`/`CenterModal`; also exports `useEscapeToClose` (lighter,
  used by `DateChipPicker`'s popover), `useHasOpenOverlay()`,
  `FOCUSABLE_SELECTOR`, `OVERLAY_PANEL_CLASS`,
  `OVERLAY_BACKDROP_OVERSCAN_BLOCK`/`_INLINE` and
  `OVERLAY_FIXED_LAYER_OPACITY_CLASS`. Nesting-aware via a module-level
  stack, so only the topmost overlay reacts to Escape/Tab. Its scroll lock
  takes `body` out of flow and restores the offset on close — see
  `specs.md` §10.49 for why `overflow: hidden` alone is not enough.
- `BottomSheet.tsx` — sliding-sheet shell with drag-to-dismiss (Pointer
  Events). Highest-reuse shell (Filter/Movement/Profile/Add sheets, tag
  picker).
- `CenterModal.tsx` — centered popup shell (delete confirm, info tooltip,
  custom tag modal, group editor).
- `ConfirmDialog.tsx` — generic confirm/cancel dialog built on
  `CenterModal`; required `destructive: boolean` picks the confirm button's
  variant.

## Movement display

- `MovimientoRow.tsx` — the movement list row.
- `movimientoView.ts` — category → icon/tint resolution (`resolveCategoria`,
  `getMovimientoVisual`) and signed-amount formatting (`formatMonto`,
  `formatMontoWithSign`, `getMovimientoAmountView`) — the single source of
  truth every movement-rendering screen imports instead of re-deriving.
- `categoryIcons.ts` — the curated `CATEGORY_ICONS` allowlist and
  `CATEGORY_ICON_KEYS` order; the key union itself lives one layer down, in
  `src/lib/categoryIconKeys.ts`.
- `tintClasses.ts` — tint name → Tailwind class table (`icon`/`badge`/`pill`
  shapes), plus `ICON_AVATAR_TINTS`. Not in the public barrel.
- `IconAvatar.tsx` — colored rounded-square icon badge.
- `TagChip.tsx` — icon + name pill (selected/unselected/disabled).

## Form controls & pickers

- `TextAreaField.tsx` — labelled two-row textarea with a character counter
  past 75% of `maxLength`.
- `TextField.tsx` — labelled text input (`Label`+`Input` from
  `@/components/ui`).
- `DateChipPicker.tsx` — date chip that opens a floating calendar
  (`ui/calendar.tsx` inside `ui/popover.tsx`).
- `SegmentedControl.tsx` — pill-group toggle (radiogroup pattern).
- `useRovingRadioGroup.ts` — the roving-tabIndex/arrow-key mechanics shared
  by `SegmentedControl` and `src/features/settings/OptionList.tsx`.
- `NumericKeypad.tsx` — shared 3x4 on-screen numeric keypad, used by
  `src/features/lock/PinPad.tsx` and `MovimientoAmountInput.tsx`.
- `PagedGrid.tsx` — a fixed-size, swipeable grid (Pointer Events) that pages
  its items `columns × rows` at a time, with page dots. Used by
  `CategorySheet`'s category grid and `CategoryFormModal`'s icon grid.
- `Toggle.tsx` — on/off switch.
- `InfoButton.tsx` — small "?" affordance that opens a caller-owned
  `CenterModal`.

## Shell chrome

- `BottomNav.tsx` — the five-slot persistent tab bar (Home/History/Add/
  Search/Profile), mounted once by `src/routes/AppShell.tsx`. Hides (not
  unmounts) while `useHasOpenOverlay()` is true.
- `ScreenHeader.tsx` — back-button + title row for a screen's header.
- `LandscapeGuard.tsx` — full-screen portrait-lock blocker, mounted once in
  `src/main.tsx`.

## Loading & error states

- `ScreenLoading.tsx` — full-screen boot/lazy-route `Suspense` fallback.
- `Skeleton.tsx` — `Skeleton` (decorative block) + `SkeletonGroup` (the
  `aria-busy`/`role="status"` wrapper every feature's loading state
  composes).
- `usePendingDelay.ts` — the anti-flash gate (delay showing a loader, then
  hold it a minimum duration) every loading tier shares.
- `InlineErrorState.tsx` — minimal inline error state (message + retry) for
  a mid-screen load failure.

## Toasts

- `Toast.tsx` — a single toast card (swipe-to-dismiss, optional action
  button).
- `Toaster.tsx` — the toast stack: subscribes to `src/lib/toastStore.ts`,
  portals to `document.body`.
- `ToastKitDemo.tsx` — trigger buttons for the `/kit` gallery only; not in
  the public barrel.

## Media-query hooks

- `useMediaQuery.ts` — generic `matchMedia` query via
  `useSyncExternalStore`.
- `useIsCoarsePointer.ts` — `(pointer: coarse)`; gates
  `MovimientoAmountInput`'s on-screen keypad.
- `useIsLandscape.ts` — `(orientation: landscape) and (pointer: coarse)`;
  the detection half of the portrait lock (`LandscapeGuard` is the
  presentation half).

Dev-only gallery for all of the above: `src/routes/Kit.tsx` (`/kit`,
`import.meta.env.DEV`-gated).
