# src/components/shared

Cross-feature composed components — distinct from `src/components/ui`
(shadcn primitives only). Everything here is reused across screens, so it
doesn't belong to any one `src/features/**` folder. See `specs.md` §10.5.

- `useOverlay.ts` — internal hook shared by `BottomSheet`/`CenterModal`:
  Escape to close, Tab-trapped focus, body-scroll lock, focus restore on
  close, plus an `initialFocus` escape hatch and `ref` forwarding to the
  panel. Also exports `useEscapeToClose` (used by `DateChipPicker`'s inline
  popover), the `OVERLAY_PANEL_CLASS` constant, and `FOCUSABLE_SELECTOR` —
  what counts as focusable for a panel's default initial focus and its
  Tab-trap, reused by `src/features/movimientos/MovimientoFormFields.tsx`
  to find the first focusable control in whichever section blocked a
  submit (`specs.md` §10.51), so the two no longer keep separately-typed
  copies of the same selector string. **Nesting-aware**: a
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
  Also exports `useHasOpenOverlay()` (`specs.md` §10.53) — the same
  module-level stack exposed to React via `useSyncExternalStore`, `true`
  whenever it's non-empty. `BottomNav` reads this directly (not a prop from
  `AppShell`) so it reacts to _every_ overlay app-wide — the filter sheet,
  the tag picker, the category modal, anything future — not just the
  Add/Profile sheets `AppShell` happens to own.
- `BottomSheet.tsx` — sliding-sheet shell with real drag-to-dismiss
  (Pointer Events, `setPointerCapture`/`pointercancel`/`lostpointercapture`
  all handled — the last one is the reliable catch-all for a drag that ends
  outside the window). Highest-reuse shell (Filter/Movement/Profile/Add
  sheets, Tag picker). `BottomSheetProps` is `OverlayShellProps<HTMLDivElement>`
  (see `useOverlay.ts` above). Accepts `initialFocus`/`ref`. The panel is a
  `flex flex-col` of two children, not one scrolling box: the grab handle
  (`shrink-0`, carries the drag handlers) and a `flex-1 min-h-0 overflow-y-auto
overscroll-y-contain` body that owns the horizontal/bottom padding —
  scrolling long content (e.g. `ProfileSheet`'s five sections) never carries
  the handle away with it (`specs.md` §10.35), and `overscroll-y-contain`
  keeps a drag past the body's own scroll boundary from rubber-banding the
  scroll-locked page behind it on iOS (`specs.md` §10.35.1). `max-h-[88dvh]`
  stays on the outer panel as the static fallback; while
  `useVisualViewportInset` (below) reports a correction — the keyboard is
  up, or the page is pinch-zoomed — the panel's own wrapper additionally
  gets an inline `top`/`height`/`maxHeight` pinning it to the space actually
  visible instead of the full layout viewport (`specs.md` §10.49). That
  wrapper is `pointer-events-none` (with `auto` restored on the panel) and
  is a sibling of the backdrop, never its ancestor — the backdrop is a
  separate, always-full-screen `fixed` div, so it keeps dimming the
  whole layout viewport (and hiding whatever sits behind it, `BottomNav`
  included) even while the wrapper itself is clamped to a smaller keyboard-
  safe area; nesting the backdrop inside the clamped wrapper let `BottomNav`
  show through the strip the wrapper stopped covering (cross-track review,
  `specs.md` §10.49). The backdrop overscans past a plain `inset-0` by
  `OVERLAY_BACKDROP_OVERSCAN_BLOCK`/`_INLINE` (`useVisualViewportInset.ts`,
  below) on every edge — insurance against `position: fixed`'s rendered box
  narrowing under a real device's keyboard-driven pan in a way this repo
  cannot reproduce, uncoverable regardless of which exact geometry model is
  right (`specs.md` §10.53). `className` still merges onto that outer panel,
  matching `CenterModal`'s contract — it targets the _outer_ panel, not the
  padded/scrollable body, so a future consumer wanting to override the
  body's padding needs a dedicated prop, not `className` (no current
  consumer does this, `specs.md` §10.35).
- `ConfirmDialog.tsx` — generic confirm/cancel dialog built on
  `CenterModal`; generates its own `labelledBy` from `title` via `useId()`,
  so callers pass no aria props. Takes a required `destructive: boolean` —
  no default — that picks the confirm button's `Button` variant
  (`destructive` vs `default`; Cancel always stays `secondary`) at
  `size="touch"` (button.tsx's 44px-compliant size): a hardcoded
  `variant="destructive"` used to paint every confirm action as a delete
  regardless of what it did (sign-out, switch-to-guest included), and a
  defaulted prop would only trade which direction quietly ships wrong —
  making the caller state it every time is the only shape where forgetting
  is a compile error either way (`specs.md` §10.40). Takes all copy as
  props — adds no locale keys of its own. Replaces the `/kit` gallery's
  former hand-rolled delete-confirm demo. Accepts `ref`.
- `CenterModal.tsx` — centered popup shell (Delete confirm, Info tooltip,
  Custom tag modal, Group editor). `CenterModalProps` is
  `OverlayShellProps<HTMLDivElement>` too. Accepts `initialFocus`/`ref`.
  Bounded and scrollable at any content height (`max-h-[88dvh]
overflow-y-auto overscroll-y-contain`) — it had neither before
  `specs.md` §10.49, which is also what the same `useVisualViewportInset`
  correction `BottomSheet` uses (above) re-centers for free here: the
  wrapper's corrected height is what `top-1/2 -translate-y-1/2` resolves
  against.
- `useVisualViewportInset.ts` — tracks `window.visualViewport` so
  `BottomSheet`/`CenterModal` can size and position themselves against the
  space actually visible (keyboard up, or the page pinch-zoomed) instead of
  the full layout viewport `dvh` resolves against, which doesn't shrink for
  the keyboard on iOS Safari. Returns `null` in the common case (API
  unavailable, disabled, or the visual viewport already matches the layout
  viewport) so both shells fall back to their static `dvh` classes with no
  inline style at all. Also exports `OVERLAY_MAX_HEIGHT_FRACTION` (`0.88`)
  — the one JS-side source of truth for the panel's clamp fraction; the
  `max-h-[88dvh]` Tailwind class each shell keeps as its static fallback is
  a separate, hand-kept-in-sync duplicate, because Tailwind's arbitrary-
  value syntax can't reference a JS constant (`specs.md` §10.49.1). Also
  exports `OVERLAY_BACKDROP_OVERSCAN_BLOCK`/`_INLINE` (`-50dvh`/`-50dvw`) —
  how far each shell's backdrop extends past its own edges in every
  direction, unconditionally and never derived from this file's viewport-
  inset tracking above, so it stays uncoverable even if that tracking's own
  geometry reasoning turns out to be wrong (`specs.md` §10.53).
- `ScreenHeader.tsx` — the back-button + title row a screen with a
  back-bar header renders as the first thing inside its shared
  `--screen-inset-top` container (`specs.md` §10.34): the row owns its own
  height, so "where does content start" stays the one token rather than a
  second hand-typed inset per header. Optional `subtitle` renders a second
  line under the title. Two consumers: `SettingsScreen.tsx` (no subtitle)
  and `src/features/lock/LockSettings.tsx` (with one, passed through
  `FullScreenPanel`'s `header` prop) — `HistoryScreen.tsx`'s own header
  (chevrons + year menu, not a back button) stays bespoke, structurally
  different from this row.
- `tintClasses.ts` — single source of truth for tint name → Tailwind class
  strings, in the `icon`/`badge`/`pill` shapes `IconAvatar.tsx` and
  `TagChip.tsx` each need — not part of the public barrel
  (`docs/wave-2.1/review-o.md`). Also exports `ICON_AVATAR_TINTS` (every
  `IconAvatarTint`, derived from this table's own keys) for a consumer that
  needs "all nine tints" — `CategoryFormModal`'s color grid and
  `categorySuggest.ts`'s least-used-tint rule (`specs.md` §10.22), and
  `Kit.tsx`'s own tint gallery.
- `IconAvatar.tsx` — colored rounded-square icon badge; size/tint are
  `Record` lookups onto the `chart-1..5`/status tokens, not new hex.
  Re-exports `IconAvatarTint` from `@/lib/iconAvatarTint` rather than
  declaring it, so `schema.ts` can depend on the plain type without
  depending on this component file (`specs.md` §11, 2026-08-20).
- `categoryIcons.ts` — the curated `CATEGORY_ICONS` allowlist
  (`CategoryIconKey` → `LucideIcon`, ~34 icons) and `CATEGORY_ICON_KEYS`
  (its stable iteration order). Lives here, not in
  `src/features/tags/`, because `movimientoView.ts`'s `getMovimientoVisual`
  resolves every category's icon through it and every movement-rendering
  screen goes through that — `src/features/tags/CategoryFormModal.tsx`
  imports this table rather than owning it. The key union itself is one
  layer further down, in `src/lib/categoryIconKeys.ts` (`schema.ts` depends
  on it there); a `satisfies` check keeps the two lists in sync at compile
  time. An unknown key falls back rather than throwing (`specs.md` §10.22).
- `MovimientoRow.tsx` + `movimientoView.ts` — the movement list row, and
  the single source of truth for category → icon/tint and signed-amount
  formatting. `Movimiento.categoria` stores a `Categoria.id` (`specs.md`
  §10.22) — `movimientoView.resolveCategoria(id, config)` is the one place
  an id is turned back into a `Categoria`, and `getMovimientoVisual(categoria,
tipo)` resolves that category's own `icono`/`color` first, falling back to
  a `tipo`-based icon/tint only when it has none (every pre-migration seed,
  an id not yet in `Config`). `MovimientoRow` takes a required `categorias:
Categoria[]` prop (no default, same no-silent-fallback rule as
  `locale`/`dateFnsLocale` below) and does the resolve internally, rendering
  a translated "sin categoría" (`tags:unknownCategory`) rather than a raw id
  when the lookup misses. Every screen that renders a `Movimiento` imports
  the mapper from here instead of re-deriving it. `formatMonto`'s `Intl.NumberFormat`
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
  touch-target treatment as `TagChip`. The roving-`tabIndex`/arrow-key
  mechanics live in `useRovingRadioGroup.ts` (below), shared with
  `src/features/settings/OptionList.tsx`'s vertical list — the two used to
  implement the same `radiogroup`/`radio` contract separately, and only one
  of them had the keyboard behaviour the role promises (`specs.md` §12,
  2026-08-20).
- `useRovingRadioGroup.ts` — the APG "radio group" keyboard/focus contract
  (one tab stop, arrow keys move focus and selection together), factored
  out of `SegmentedControl.tsx` so `OptionList.tsx` shares it instead of
  reimplementing it. Takes an `orientation` (`'horizontal'` | `'vertical'`)
  to pick the arrow-key pair per the APG spec (Left/Right vs. Up/Down).
- `TextField.tsx` — labelled text input: `Label`/`Input` association via
  `useId()` (or a caller-supplied `id`), `aria-invalid`/`aria-describedby`
  wired to an optional `error` rendered as `role="alert"`, 44px touch
  target. Forwards native `ComponentProps<'input'>` (minus `id`/`value`/
  `onChange`) so `placeholder`/`maxLength`/`autoComplete`/etc. pass through
  without being individually re-declared. Accepts `ref`.
- `Toggle.tsx` — on/off switch (`role="switch"`). Accepts `ref`.
- `InfoButton.tsx` — small "?" affordance that opens an info tooltip
  (the caller owns the `CenterModal` it opens). Accepts `ref`.
- `BottomNav.tsx` — the five-slot persistent tab bar (Home / History /
  centre Add / Search / Profile), mounted once by `src/routes/AppShell.tsx`.
  Home, History and Search are real `NavLink`s, so `aria-current="page"`
  comes from the router rather than hand-rolled state; the active slot is
  `text-primary` plus a heavier `strokeWidth`, since Lucide has no filled
  variant to switch to. Add and Profile both open a sheet that lives outside
  this component — `BottomNav` takes `addOpen`/`onOpenAdd` and
  `profileOpen`/`onOpenProfile` as props (the same `aria-haspopup="dialog"`/
  `aria-expanded` pattern on both triggers) rather than owning either sheet
  or importing the feature directly, since `src/components/shared/**` stays
  feature-agnostic; `src/routes/AppShell.tsx` owns the open state and
  renders `<AddMovimientoSheet>`/`<MovimientoSheet>` (`specs.md` §10.23) and
  `<ProfileSheet>` (`specs.md` §10.18).
  Its height is `--bottom-nav-clearance` (`src/styles/index.css`); any
  screen or overlay that must sit clear of the bar pads by the same token
  instead of repeating the number. **Hides (`opacity-0 pointer-events-none`),
  never unmounts, while `useHasOpenOverlay()` (`useOverlay.ts`, above) is
  true** (`specs.md` §10.53) — a real iPhone showed this bar's own
  background/icons through the strip above the keyboard while the Add sheet
  was open. Hiding rather than unmounting is deliberate: `useOverlay`
  restores focus to the element that opened the overlay on close (e.g. the
  Add FAB, part of this component), and `opacity`/`pointer-events` (unlike
  `display`/`visibility`/`inert`) don't affect focusability — the restore
  can land correctly even a render tick before this hook's own re-render
  makes the bar visible again.
- `useIsLandscape.ts` — `matchMedia('(orientation: landscape)')` exposed to
  React via `useSyncExternalStore`, same shape as
  `src/features/home/usePrefersReducedMotion.ts`. The detection half of
  `specs.md` §10.53's "stay in portrait" rule — kept apart from
  `LandscapeGuard.tsx`'s presentation on purpose, per that section's own
  reasoning about what a real lock does and doesn't cover in each context.
- `LandscapeGuard.tsx` — the presentation half: self-contained, mounted
  once in `src/main.tsx` above `AppLock` and the router (not inside
  `AppShell`, which would miss the auth screens, the PIN lock and
  `/settings` — every one of them outside it), renders nothing in portrait
  and a full-screen blocking `role="status"` in landscape.
  Deliberately minimal (existing tokens, existing `common` copy, no
  illustration) — the user is designing this screen themselves
  (`docs/pendientes-usuario.md`); this file is the seam their design drops
  into without touching `useIsLandscape.ts` or the mount site.
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
including a nested-overlay demo (sheet with a delete-confirm modal inside),
an `initialFocus` demo, and both `ConfirmDialog` `destructive` paints
(review pass `review-aj-h`, `specs.md` §10.40.1 — the gallery only had the
`destructive` one before).
