# Review — Track K (toast surface) + shared-tree formatter finding

Reviewed: `src/lib/toastStore.ts`(+test), `src/components/shared/Toast.tsx`,
`Toaster.tsx`, `ToastKitDemo.tsx` (+tests), `src/features/lock/AppLock.tsx`
(+test), the `toast` locale namespace, and the assigned shared-formatter
finding (`movimientoView.ts`/`MovimientoRow.tsx`). Mid-review the operator
also asked me to close a public-API gap in `toastStore.ts` itself (below,
finding 0) — folded into this same pass since it's the same file.

## Findings, most severe first

### 0. `toast.success(message: string)` could not stop a caller passing `error.message` — FIXED (operator-directed)

The original API took an arbitrary string and rendered it verbatim. Nothing
enforced "callers pass already-localized copy" beyond a comment — and per
`docs/error-handling.md` §5/§7 and `specs.md` §10.6 ("Never render a raw
`.message`"), this codebase has shipped that exact defect once already
(pre-phase-2 auth/lock screens interpolating `error.message` into Spanish
UI). Wave 3's three tracks (F/G/H) are about to become the first real
callers, so this was the last free moment to close it.

**Fix: `toast.success`/`toast.error` now take a translation key, not a
string, and resolve it internally.**

```ts
export type ToastMessageKey = {
  [NS in keyof typeof es]: `${NS}:${LeafPath<(typeof es)[NS]>}`
}[keyof typeof es]

export const toast = {
  success: (key: ToastMessageKey, values?: Record<string, unknown>): void => …
  error: (key: ToastMessageKey, values?: Record<string, unknown>): void => …
}
```

`ToastMessageKey` is typed off `es.json`'s real shape (`LeafPath<T>` walks
every namespace to every leaf string), the same idiom
`src/features/auth/errorCopy.ts`'s `AuthErrorKey` already uses — except
spanning every namespace instead of one, because a toast can be raised by
any feature's store action, not just one that already resolved its own key
through a component's `useTranslation()`. A typo or a key that doesn't
exist in `es.json` is now a compile error (`error TS2345: Argument of type
'"Guardado"' is not assignable to parameter of type 'ToastMessageKey'` —
the exact failure I watched before fixing every call site, below).
`raiseToast` resolves it via the shared `i18next` instance and stores the
resolved string on `ToastItem.message` — `Toast.tsx`/`Toaster.tsx` needed
**no changes at all**, they already just render `item.message`.

**On the objection I did raise before implementing, per the brief's own
invitation to argue it:** does importing `i18next` reintroduce the
`lockStore`-coupling problem `specs.md` §10.6 forbids ("holds no domain
state, reads no store")? No — traced this rather than assumed it.
`i18next` is a stateless leaf translation library already imported by
every `t()` call in the app (including `Toast.tsx` itself, one file over);
it carries no domain data, no auth/crypto graph, and doesn't point the
dependency at a _policy owner_ the way importing `lockStore` would have.
The inverted-dependency fix specs.md/track-k.md made was specifically
about not letting `toastStore` know a _lock_ exists — resolving a copy key
is an unrelated axis. Agree with the operator's reasoning; implemented as
directed.

Every existing call site (`ToastKitDemo.tsx`, and every test that raised a
raw string: `toastStore.test.ts`, `Toaster.test.tsx`, `AppLock.test.tsx`)
failed to typecheck first — `bunx tsc -b --noEmit` listed 19 errors, one
per raw-string call site, before I touched them — then was converted to
real keys under a new `toast.demo.*` group (added to all four locale
files, parity-tested by the existing `resources.test.ts`, which I did not
edit per your instruction). Test assertions now resolve expected text via
`i18next.t()` at call time rather than restating the Spanish copy as a
second literal (same drift-guard reasoning `docs/error-handling.md` §7
already applies to `errorCopy.ts`'s own tests) — with one care: the
resolved-text constants had to be _lazy_ (a `T(key)` helper called inside
each test), not module-top-level `const`s, because `i18next.language`
isn't forced to `'es'` until `src/test/setup.ts`'s `beforeAll` runs, which
is after a test file's own top-level code has already evaluated. Missing
that on the first pass produced real, watched failures (English "Notice
one" resolved where Spanish "Aviso uno" was expected) — a genuine timing
bug in the test, not the implementation, caught and fixed before landing.

Also added a `supports interpolation values` test
(`toast.success('toast:repeatSuffix', { count: 5 })` resolves through
`values`) since the operator flagged this as a real near-term need.

**I did not touch** `src/lib/i18n/detectLocale.ts` or `resources.test.ts`
(the parallel i18n-review worktree owns them right now) — `ToastMessageKey`
only reads the `es.json` module's type, no runtime import of either file.

**Doc lines now stale and needing a fold-in (operator-owned files, not
edited directly):**

- `src/lib/README.md`'s `toastStore.ts` bullet still says
  `toast.success(message)` / `toast.error(message)` and "Callers pass
  already-localized copy" — replace with: callers pass a `ToastMessageKey`
  (typed off `es.json`, spanning every namespace) plus optional
  interpolation values; the module resolves it via `i18next` itself, so a
  raw string is a compile error, not a convention.
- `src/components/shared/README.md`'s `Toast.tsx`/`Toaster.tsx` bullets
  don't mention the message API at all (correctly — they never changed);
  no edit needed there.

### 1. `formatMonto`/`MovimientoRow`'s date label were hardcoded to es-CO/es regardless of the active i18next locale — CONFIRMED, partially fixed

Traced directly: `movimientoView.ts` built its `Intl.NumberFormat` instances
with a literal `'es-CO'` at module scope, and `MovimientoRow.tsx` imported
`date-fns/locale`'s `es` directly for the `d MMM` date label — both with no
parameter. Three screens (`RecentMovimientos` in Home, `SearchScreen`,
`HistoryScreen`) render this through `MovimientoRow`/`formatMonto`, so an
`en` or `pt-BR` user sees translated chrome around Colombian-formatted
money and Spanish month abbreviations.

**Fixed the enabling shape, in-scope only.** `formatMonto(monto, moneda,
locale = 'es-CO')` and `getMovimientoAmountView(m, locale = 'es-CO')` now
take an explicit `locale` (cached per `(locale, currency)` pair in a
`Map`, still built once and reused — the existing perf guarantee for a
list expected to grow to years of rows). `MovimientoRow` gained matching
optional `locale`/`dateFnsLocale` props, defaulting to today's behavior.
This is the same judgment `docs/error-handling.md` §7 uses for
`errorCopy.ts` (a pure module returns a key/takes a param instead of
reading `i18next` state itself) and the same shape `DateChipPicker`
already uses for `firstDayOfWeek` (`specs.md` §10.5) — the shared
component stays i18n-agnostic; the calling screen resolves the active
locale and passes it down. `movimientoView.ts` stays pure and independently
testable; nothing in it reads global state.

Proved with tests I watched fail first, for the right reason
(`TypeError: getCurrencyFormatter(...).format is not a function` /
literal `'1.200'` mismatches before the fix landed):

- `src/components/shared/movimientoView.test.ts` — `formatMonto` with an
  explicit locale (`en-US` groups with a comma, not a period), default
  still es-CO, `getMovimientoAmountView` forwards `locale`, and the
  memoization still holds per-`(locale, currency)` pair across repeat
  calls.
- `src/components/shared/MovimientoRow.test.tsx` — default Spanish month
  label unchanged, `dateFnsLocale={enUS}` renders `"10 Aug"`, `locale=
"en-US"` renders `$3,200.00`-shaped output.

**What I did not do, and why: wire it into the three call sites.** That
needs `RecentMovimientos.tsx` (Home), `SearchScreen.tsx`, and
`HistoryScreen.tsx` to read the active locale (`useTranslation()`'s
`i18n.language`/`resolvedLanguage`) and pass it to `MovimientoRow`, plus a
small `SupportedLocale → date-fns Locale` mapping (`en` → `enUS`, `pt-BR`
→ `pt-BR` package export, `es`/`es-AR` → `es`) that most naturally lives
next to `src/lib/i18n/resources.ts`'s `SupportedLocale` type. All of that
is outside my remit for this review (`src/features/home/**`,
`src/features/search/**`, `src/features/history/**` are explicitly
off-limits, and `src/lib/i18n/**` is a different track's file). **This is
a design/dispatch question for you, not something to bulldoze**: the shape
is now in place and additive (zero regression risk — every existing call
site still compiles and behaves identically, confirmed by the full
`bun run check` below), so wiring the three screens is a small, mechanical
follow-up, but it touches three feature directories I'm not allowed to
touch in this pass.

### 2. The toast surface itself (`toastStore.ts`/`Toast.tsx`/`Toaster.tsx`/`AppLock.tsx`) — no defect found

I attacked concurrency, suppression, and a11y/touch directly and could not
break any of it. What I checked, and why it holds:

- **Timer bookkeeping (`timers` Map).** Traced every path that removes an
  item from `useToastStore`'s `items` array: `dismissToast` (`clearTimer`
  first), the stack-cap eviction in `raiseToast` (`clearTimer(oldest.id)`
  before slicing), and `setToastsSuppressed(true)` (`clearAllTimers()`
  before emptying `items`). All three clear the timer before or exactly
  when they remove the item; none leaves a stale `setTimeout` pointing at
  a dead id. CONFIRMED by tracing, and by `toastStore.test.ts`'s explicit
  "no leftover timer fires" assertions (advances fake timers past the
  original duration after a dismiss/suppress and checks nothing changes).
- **Same message raised from two places in the same tick.** `raiseToast`
  is fully synchronous — it reads `useToastStore.getState()`, decides
  duplicate-or-new, and calls `setState` before returning. Two sequential
  calls (there is no real concurrency in a single JS thread; "same tick"
  here just means "not awaited between calls") each see the other's
  committed state. CONFIRMED by tracing; `toastStore.test.ts`'s duplicate
  tests exercise exactly this pattern.
- **Swipe-dismiss racing the timer.** `dismissToast` is idempotent
  (`clearTimer` no-ops if already cleared, the `filter` no-ops if the id
  is already gone) — whichever fires first wins cleanly, no double-removal
  error, no crash. CONFIRMED by tracing.
- **Toast raised during the suppression transition.** `setToastsSuppressed`
  and `raiseToast` are both synchronous, so there is no async gap between
  a phase change and the suppression flag updating — nothing can be raised
  "between" them within this module. The one real transition risk (a toast
  raised in the `'unknown'` boot window, and one visible when the app
  re-locks mid-display) is both handled — `suppressed` starts `true` before
  any effect runs, and `setToastsSuppressed(true)` clears the live stack,
  not just future arrivals — and tested at both the store level
  (`toastStore.test.ts`) and the integration level
  (`AppLock.test.tsx`'s boot-window and re-lock-mid-toast tests).
- **StrictMode double-effect.** `AppLock`'s suppression effect
  (`setToastsSuppressed(phase !== 'unlocked')`) is idempotent and has no
  cleanup function — a dev-mode double-invoke just calls it twice with the
  same value, which is a no-op the second time. No bug possible here by
  construction.
- **Accessibility.** `role="alert"` (error) vs `role="status"` (success) —
  tested. Dismissal is always keyboard-reachable via a labeled,
  `min-h-11`/`min-w-11` close button independent of the swipe gesture —
  tested. Nothing traps focus or auto-focuses the card; `IconAvatar` is
  `aria-hidden` so the icon isn't double-announced.
- **Touch.** Pointer Events throughout (down/move/up/cancel/lost-capture),
  `touch-pan-y` so vertical scroll still works during a horizontal drag,
  `pointercancel`/`onLostPointerCapture` both reset drag state without
  counting as dismissal — mirrors `BottomSheet`'s already-reviewed pattern.
  `prefers-reduced-motion` is handled globally (`src/styles/index.css`'s
  media block zeroes `animation-duration`/`transition-duration`
  universally), which also covers `Toast.tsx`'s `animate-pop-in` and its
  drag transition without any bypass.

I looked for the _shape_ of a defect elsewhere in the toast tree, not just
point-checked the above — same conclusion: nothing else found.

### 3. `ToastKitDemo.tsx` has no colocated test — minor, not blocking

It's a dev-only button panel that only calls the already-thoroughly-tested
`toast.success`/`toast.error` public API — there's no behavior of its own
to test. `LockSettings` (a real feature component moved into `/kit`, not a
button panel) does have tests, so this isn't inconsistent with the
project's actual pattern for Kit harnesses. Noting it, not fixing it — it
isn't part of §10.6's "Done when" list and adding a test would mostly
duplicate `toastStore.test.ts`/`Toast.test.tsx`.

## The two operator calls this brief asked me to re-examine

- **Inverting the lock dependency** (`toastStore` reads no store;
  `AppLock` drives `setToastsSuppressed` instead). Correct, and not just
  defensible — `specs.md` §10.6 literally states "Data touched: none...
  it holds no domain state and reads no store," so the alternative (import
  `lockStore` into `toastStore`) would have directly violated the written
  spec, not just been a worse design. Keeps `toastStore` a leaf every
  Wave 3 track can import without dragging in WebCrypto/Dexie. Agree,
  no change.
- **Duplicate collapse resetting the one card's own timer.** Also correct.
  The brief itself pre-argues this in `docs/wave-2-plan.md`'s Track K
  section, and the reading holds up: "a later arrival never resets an
  earlier one" is about _distinct_ toasts competing for the user's
  attention: a re-raised identical message is the same notification still
  being true, and letting its timer restart is what stops a retry loop's
  first error from vanishing before the user reads the third identical
  one. Matches how mainstream toast libraries dedupe. Agree, no change.

## What I need you to decide

Only finding 1 needs a decision — finding 0 was operator-directed and is
done, no open question. Wire the now-locale-aware `formatMonto`/
`MovimientoRow` into `RecentMovimientos.tsx`, `SearchScreen.tsx`,
`HistoryScreen.tsx`, plus a `SupportedLocale → date-fns Locale` mapping
near `src/lib/i18n`. I left the formatter/component change additive and
zero-regression on purpose so this can be picked up as a small follow-up
(by you, or a dispatched track) without re-touching anything I've already
changed.

## `bun run check` (real output, run after every fix above, including the key-typed toast API)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/rv-toast

 Test Files  61 passed (61)
      Tests  584 passed (584)
```

The one lint warning is pre-existing, in a `src/components/ui` shadcn file
outside this review's scope (and outside this fix), not introduced here.

## Doc line for `src/components/shared/README.md` (operator-owned — not edited directly)

Append to the existing `MovimientoRow.tsx` + `movimientoView.ts` bullet:

> Both now also accept an optional `locale`/`dateFnsLocale` — default
> es-CO/es (today's only wired locale), forwarded from the caller rather
> than read from global state, so the module stays pure and testable
> (`docs/wave-2/review-k.md`). No screen passes a non-default value yet.
