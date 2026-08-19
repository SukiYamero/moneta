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
  it is still open. Not part of the public barrel. Also owns
  `OverlayLabelProps` (the `labelledBy`-xor-`ariaLabel` union) and
  `OverlayShellProps<T>` — the shared prop surface both `BottomSheet` and
  `CenterModal` re-export their public `Props` type as, so the two shells
  can't drift apart on `open`/`onClose`/`children`/`className`/
  `initialFocus`/`ref` the way they used to (see `specs.md` §11, 2026-08-19).
- `BottomSheet.tsx` — sliding-sheet shell with real drag-to-dismiss
  (Pointer Events, `setPointerCapture`/`pointercancel`/`lostpointercapture`
  all handled — the last one is the reliable catch-all for a drag that ends
  outside the window). Highest-reuse shell (Filter/Movement/Profile/Add
  sheets, Tag picker). `BottomSheetProps` is `OverlayShellProps<HTMLDivElement>`
  (see `useOverlay.ts` above). Accepts `initialFocus`/`ref`.
- `CenterModal.tsx` — centered popup shell (Delete confirm, Info tooltip,
  Custom tag modal, Group editor). `CenterModalProps` is
  `OverlayShellProps<HTMLDivElement>` too. Accepts `initialFocus`/`ref`.
- `IconAvatar.tsx` — colored rounded-square icon badge; size/tint are
  `Record` lookups onto the `chart-1..5`/status tokens, not new hex.
- `MovimientoRow.tsx` + `movimientoView.ts` — the movement list row, and
  the single source of truth for category → icon/tint and signed-amount
  formatting. Every screen that renders a `Movimiento` imports the mapper
  from here instead of re-deriving it. `formatMonto`'s `Intl.NumberFormat`
  instances are memoized per `(locale, currency)` pair at module scope (a
  list this grows to years of rows can't afford building one per row per
  render). `formatMonto`/`getMovimientoAmountView` and `MovimientoRow`'s
  `locale`/`dateFnsLocale` are **required**, not optional/defaulted — every
  Home/Search/History call site passes the active locale via
  `useLocaleFormatting()` (`src/lib/i18n/localeFormatting.ts`); a missed
  call site is a compile error, not a silent es-CO fallback
  (`docs/wave-2/track-m.md`). Accepts `ref`.
- `TagChip.tsx` — icon + name pill (selected/unselected/`disabled`). The
  44px touch target is an invisible-padding wrapper around the visibly
  smaller designed pill (same split `Toggle`/`InfoButton` already use), so
  the hit area grows without inflating the visible chip. Accepts `ref`.
- `DateChipPicker.tsx` — date chip that expands an inline month grid.
  Takes `firstDayOfWeek` as a prop; stays repo-agnostic (see `specs.md`
  §11, 2026-08-18). Takes required `locale` (BCP-47, used via a
  `useMemo`-cached `Intl.DateTimeFormat` for the day+month chip label — a
  date-fns pattern can't localize the day/month connector word, only the
  month name) and `dateFnsLocale` (for the month header and weekday
  captions, which have no embedded literal words) — both forwarded by the
  calling screen from `useLocaleFormatting()` (`docs/wave-2/track-m.md`).
  Escape closes the popover via `useEscapeToClose`, correctly outranking
  an ancestor `BottomSheet`/`CenterModal` through the shared overlay
  stack. Same invisible-padding touch-target treatment as `TagChip` on
  the chip and month-nav buttons. Accepts `ref`.
- `SegmentedControl.tsx` — generic pill-group toggle (radiogroup pattern,
  arrow-key navigation), no screen-specific option assumptions. Per-option
  `disabled` (arrow-key nav skips disabled options); keyboard focus moves
  via refs on each segment, not DOM traversal. Same invisible-padding
  touch-target treatment as `TagChip`.
- `Toggle.tsx` — on/off switch (`role="switch"`). Accepts `ref`.
- `InfoButton.tsx` — small "?" affordance that opens an info tooltip
  (the caller owns the `CenterModal` it opens). Accepts `ref`.
- `BottomNav.tsx` — the five-slot persistent tab bar (Home / History /
  centre Add / Search / Profile), mounted once by `src/routes/AppShell.tsx`.
  Home, History and Search are real `NavLink`s, so `aria-current="page"`
  comes from the router rather than hand-rolled state; the active slot is
  `text-primary` plus a heavier `strokeWidth`, since Lucide has no filled
  variant to switch to. Add and Profile have no destination until Wave 3 —
  rendered `disabled` with an `aria-label` and a `// STUB(trackF|trackG)`
  marker, per the stub convention, rather than as dead enabled buttons.
  Its height is `--bottom-nav-clearance` (`src/styles/index.css`); any
  screen or overlay that must sit clear of the bar pads by the same token
  instead of repeating the number.
- `Toast.tsx` — a single toast card: `role="alert"` (errors) /
  `role="status"` (confirmations), swipe-to-dismiss via Pointer Events
  (`touch-pan-y`, mirroring `BottomSheet`'s drag handling), plus a
  keyboard-reachable close button — a timed message must stay dismissible
  without the gesture (WCAG 2.2.1).
- `Toaster.tsx` — the stack: subscribes to `src/lib/toastStore.ts`, portals
  to `document.body`, sits at `z-[60]` (above `BottomSheet`/`CenterModal`'s
  `z-50`, so a sheet can never cover it). Mounted once, inside `AppLock`,
  only while the app is unlocked. The store itself lives in `src/lib/` and
  is documented there — it holds no domain state and reads no other store
  (`specs.md` §10.6); `AppLock` drives its suppression flag rather than the
  store importing `lockStore`.
- `index.ts` — the public barrel. Component files are never `index.tsx`
  themselves (see `AGENTS.md` § Architecture & file naming).

Dev-only gallery: `src/routes/Kit.tsx` (`/kit`, gated on
`import.meta.env.DEV`) renders every component/variant for visual QA,
including a nested-overlay demo (sheet with a delete-confirm modal inside)
and an `initialFocus` demo.
