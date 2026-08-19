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
- `ConfirmDialog.tsx` — delete-style confirmation built on `CenterModal`;
  generates its own `labelledBy` from `title` via `useId()`, so callers
  pass no aria props. Confirm/Cancel use `Button`'s `destructive`/
  `secondary` variants at `size="touch"` (button.tsx's 44px-compliant size).
  Takes all copy as props — adds no locale keys of its own. Replaces the
  `/kit` gallery's former hand-rolled delete-confirm demo. Accepts `ref`.
- `CenterModal.tsx` — centered popup shell (Delete confirm, Info tooltip,
  Custom tag modal, Group editor). `CenterModalProps` is
  `OverlayShellProps<HTMLDivElement>` too. Accepts `initialFocus`/`ref`.
- `tintClasses.ts` — single source of truth for tint name → Tailwind class
  strings, in the `icon`/`badge`/`pill` shapes `IconAvatar.tsx` and
  `TagChip.tsx` each need — not part of the public barrel
  (`docs/wave-2.1/review-o.md`).
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
  (`docs/wave-2/track-m.md`). Amounts always render
  `currencyDisplay: 'narrowSymbol'` (never the ISO code) and attach the sign
  to the **number**, not the currency (`$ -12.000,00`), by reordering
  `formatToParts` output — the symbol's position is locale data, so a
  prepended `+`/`-` character is wrong. A call site needing an explicitly
  signed amount uses the exported `formatMontoWithSign`; hand-concatenating a
  sign is the exact bug `BreakdownCard.tsx` reproduced independently
  (`specs.md` §10.7, `docs/wave-2.1/track-n.md`). Accepts `ref`.
- `TagChip.tsx` — icon + name pill (selected/unselected/`disabled`). The
  44px touch target is an invisible-padding wrapper around the visibly
  smaller designed pill (same split `Toggle`/`InfoButton` already use), so
  the hit area grows without inflating the visible chip. Takes a required
  `tint: IconAvatarTint` (from `movimientoView.getMovimientoVisual`, or its
  type-based fallback) — the icon is always tinted; selecting tints the
  whole pill in that family via the shared `TINT_CLASSES` table in
  `src/components/shared/tintClasses.ts` (also used by `IconAvatar`, not a
  separate copy). Accepts `ref`.
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
- `TextField.tsx` — labelled text input: `Label`/`Input` association via
  `useId()` (or a caller-supplied `id`), `aria-invalid`/`aria-describedby`
  wired to an optional `error` rendered as `role="alert"`, 44px touch
  target. Forwards native `ComponentProps<'input'>` (minus `id`/`value`/
  `onChange`) so `placeholder`/`maxLength`/`autoComplete`/etc. pass through
  without being individually re-declared. Accepts `ref`.
- `Toggle.tsx` — on/off switch (`role="switch"`). Accepts `ref`.
- `InfoButton.tsx` — small "?" affordance that opens an info tooltip
  (the caller owns the `CenterModal` it opens). Accepts `ref`.
- `AmountField.tsx` — locale-aware amount input for `Movimiento.monto`
  (always positive; sign comes from `tipo`). `type="text"` +
  `inputMode="decimal"`, never `type="number"` (native spinners, and
  `valueAsNumber` ignores locale entirely). A controlled **string** field,
  not a controlled number — the parsing lives in `amountFormat.ts` below,
  never a hand-rolled parser here. `aria-invalid` is true both for a
  caller-supplied `error` and for text `parseAmount` can't parse under the
  given `locale`, so malformed input is flagged even with no `error` copy
  passed. Required `locale` (BCP-47 from `useLocaleFormatting()`), same
  no-default convention as `MovimientoRow`/`formatMonto`. Accepts `ref`.
- `amountFormat.ts` — the pure locale money helpers behind `AmountField`:
  `parseAmount(raw, locale)` and its inverse `formatAmountForInput(value,
locale)`, built on `Intl.NumberFormat(locale).formatToParts` to read the
  locale's actual decimal/group separators (`es-CO` groups `.`/decimals
  `,`; `en-US` the reverse). Its own module, not exported from the
  component file, because a pure helper shipped alongside a component
  breaks Fast Refresh. `parseAmount` gates on a strict decimal pattern
  before `Number()`: bare `Number()` turns `''` into `0` and accepts hex,
  so a lone separator once parsed as $0 and `0x1a` as 26.
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
  without the gesture (WCAG 2.2.1). An optional `item.action`
  (`src/lib/toastStore.ts`'s `ToastAction`) renders a second, `min-h-11`
  button before dismiss — taking it calls `onAction()` then dismisses.
  Resolves the action's label via the shared `i18next` instance directly
  (its `labelKey` is namespace-prefixed, e.g. `update:reload`, not scoped to
  this card's own `toast` namespace).
- `Toaster.tsx` — the stack: subscribes to `src/lib/toastStore.ts`, portals
  to `document.body`, sits at `z-[60]` (above `BottomSheet`/`CenterModal`'s
  `z-50`, so a sheet can never cover it). Mounted once, inside `AppLock`,
  only while the app is unlocked. The store itself lives in `src/lib/` and
  is documented there — it holds no domain state and reads no other store
  (`specs.md` §10.6); `AppLock` drives its suppression flag rather than the
  store importing `lockStore`.
- `Skeleton.tsx` — `Skeleton` (a single `aria-hidden` decorative block,
  shaped per call via `className`) and `SkeletonGroup` (the accessible
  wrapper every loading tier shares: `aria-busy` on the container, one
  `sr-only role="status"` announcement — not one per block). Home, Search
  and History's loading states (`HomeLoadingState.tsx`,
  `SearchLoadingState.tsx`, `HistoryLoadingState.tsx`) all compose these
  two rather than hand-rolling skeleton markup.
- `ScreenLoading.tsx` — Tier 1 (specs.md §10.9): full-screen,
  brand-consistent loading for boot and lazy-route `Suspense` fallbacks —
  never a tab change, which has no data wait (`dataStore.load()` is
  once-per-session). No props required for its real callers; the one
  optional `className` exists only so `/kit`'s gallery can preview it at a
  bounded height. Used directly, ungated, at both its call sites: boot
  (`RequireAuth.tsx`) and the `/kit` lazy route's `Suspense` fallback
  (`src/router.tsx`).
- `usePendingDelay.ts` — the two-sided anti-flash gate every loading tier
  shares (specs.md §10.9): don't show a loader until the work has been
  pending ~150ms, and once shown keep it visible ~350ms minimum. A
  boolean-in/boolean-out hook (`usePendingDelay(isPending, opts?)`), not a
  component — each screen wraps its own `status` read in it.
- `InlineErrorState.tsx` — the minimal inline error state Search and
  History share for a mid-screen load failure (`message`/`retryLabel`/
  `onRetry`) — distinct from `HomeErrorState`'s card treatment, whether
  intentionally is an open question (`docs/wave-2.2/review-general.md`).
- `index.ts` — the public barrel. Component files are never `index.tsx`
  themselves (see `AGENTS.md` § Architecture & file naming).

Dev-only gallery: `src/routes/Kit.tsx` (`/kit`, gated on
`import.meta.env.DEV`) renders every component/variant for visual QA,
including a nested-overlay demo (sheet with a delete-confirm modal inside)
and an `initialFocus` demo.
