# Track W — report

Scope: §10.16 service-worker update lifecycle. Files touched: `vite.config.ts`,
`src/lib/swUpdate.ts` (new, +test), `src/main.tsx`, plus the locale carve-out
explicitly granted in the brief (`update.*` namespace in all four locale
files, and the companion `I18N_NAMESPACES` registration that a new namespace
requires — see "Spec deltas" below for why that fourth file was necessary).

## What was built

- `vite.config.ts`: `registerType: 'autoUpdate'` → `'prompt'`, with a comment
  pointing at `swUpdate.ts` and `specs.md` §10.16.
- `src/lib/swUpdate.ts`: a pure factory, `createSwUpdateController(registerSW)`,
  around `virtual:pwa-register`'s `registerSW`. On `onNeedRefresh` it raises
  `toast.success('update:available')`. It also registers an hourly
  `registration.update()` poll (via `onRegisteredSW`) — the documented
  vite-plugin-pwa pattern for noticing a deploy in a tab that never
  navigates again, since the browser's own update check is tied to
  navigation. A failed poll (offline, transient network) is swallowed, not
  surfaced — specs.md §10.16's "an update that arrives while offline" edge
  case. A registration failure (`onRegisterError`) is `console.warn`'d per
  `docs/error-handling.md` §2's swallow floor, never toasted — the user
  didn't cause it and can't act on it. `initServiceWorkerUpdates()` is the
  real singleton entry point (idempotent), and `applyServiceWorkerUpdate()`
  is the exported action — see the open question below for why nothing
  calls it yet.
- `src/main.tsx`: one new import + one call, `initServiceWorkerUpdates()`,
  before the render call.
- Locale: `update.available` added to `es`/`en`/`es-AR`/`pt-BR`, real
  translations (not copy-paste), `vos` conjugation in `es-AR` matching the
  existing `driveConsent` pattern (`Recargá` vs `Recarga`).

**Testability decision — injectable seam, not a vitest alias.** `swUpdate.ts`
exports `createSwUpdateController(registerSW: RegisterSWFn)` as a pure
function taking a duck-typed `registerSW` (matching
`vite-plugin-pwa/types`' `RegisterSWOptions`/return shape structurally,
without importing that type or the virtual module). Every behavioral test
drives a fake `registerSW` directly — no mocked virtual module, no vitest
alias config (which would have meant touching `vite.config.ts`'s `test`
block for something bigger than the config flip already required). The one
real import of `virtual:pwa-register` is isolated to the `registerSW`
identifier at the top of the file and to `initServiceWorkerUpdates`'s use of
it; a `/// <reference types="vite-plugin-pwa/client" />` in the file itself
supplies the ambient module type, so `tsconfig.app.json`'s `types` array
(which I don't own) never needed touching either. Two smoke tests exercise
that real import path (it resolves under Vitest's own Vite instance to
vite-plugin-pwa's no-op dev build, since `devOptions.enabled: false`,
confirmed by reading `node_modules/vite-plugin-pwa/dist/client/dev/vanillajs.js`)
so `initServiceWorkerUpdates`/`applyServiceWorkerUpdate` are provably
callable, not just type-checked.

**Confirmed via the real build, not just tests:** `bun run build` was run
and `dist/sw.js` inspected directly. It only calls `self.skipWaiting()` on
an explicit `SKIP_WAITING` postMessage — never on install — which is exactly
`registerType: 'prompt'`'s contract and confirms the flag change actually
changed the generated service worker, not just the config's TS shape.

## The one thing this track could not finish, and why (read this first)

**Confirmed, not reasoned:** I read `src/lib/toastStore.ts`, `Toast.tsx`,
`Toaster.tsx`, and their existing tests in full. Today the Toast surface has
**no action-button capability at all** — `ToastItem` carries only
`{ id, variant, message, count }`, `toast.success`/`toast.error` accept only
a translation key + interpolation values, and `Toast.tsx`'s only interactive
elements are the dismiss (×) button and swipe-to-dismiss, both wired
unconditionally to `dismissToast`. There is no prop, no callback registry,
and no tappable region a consumer can hook a custom action into.

The brief (and `specs.md` §10.16) asks for "a Toast call, with an action
that applies the update and reloads cleanly." Building that action requires
adding an optional `action` to `ToastItem`/`toast.success`/`toast.error` and
rendering it in `Toast.tsx` — both files are explicitly outside Track W's
ownership this stage (`vite.config.ts`, `swUpdate.ts`, `main.tsx` only, no
feature code). Per `AGENTS.md` § How every agent works ("stop rather than
guess when something is genuinely cross-cutting or outside what you own"),
I did not touch them.

**What I built instead, so the track isn't blocked on this:** the
notification fires correctly (`toast.success('update:available')`, copy
reads "reload the page to update," not "tap here" — it would be actively
misleading to imply an in-toast tap works today) and `applyUpdate()` /
`applyServiceWorkerUpdate()` is fully built, tested, and ready to wire to a
real control the moment one exists. Nothing in `main.tsx` calls
`applyServiceWorkerUpdate()` yet, because there is nothing for a user to
press. Today, an update becomes active without an explicit action only when
the user closes and reopens every tab (the browser's own default
waiting→activate behavior) — no worse than before this track, and never a
disruptive silent reload, since `registerType: 'prompt'` and this module
together guarantee `updateSW()`/reload only ever fires from a deliberate
call this module doesn't make on its own.

**Proposed minimal fix for the operator** (not applied — outside my
ownership): add `action?: { labelKey: ToastMessageKey; onAction: () => void }`
to `ToastItem` and thread it through `toast.success`/`toast.error`'s
optional third argument; render it in `Toast.tsx` as a second button next to
the dismiss ×, calling `onAction` then `onDismiss`. Once that exists,
`main.tsx` (or wherever) can call
`toast.success('update:available', undefined, { labelKey: 'update:reload', onAction: applyServiceWorkerUpdate })`
directly — `applyServiceWorkerUpdate` is already exported and already
tested for this. This is a small, additive change to two files (not a
redesign), and it's the only piece missing for the done-when's "taking it"
half to be reachable from the UI rather than only from a test calling
`controller.applyUpdate()` directly.

## Decisions for specs.md §11

1. **Injectable-seam testability** (detailed above) over a vitest alias for
   `virtual:pwa-register` — keeps the fake entirely in test code, touches no
   shared config, and tests the module's own logic rather than re-testing
   vite-plugin-pwa's registration internals.
2. **No "already shown" nag-guard in `swUpdate.ts`.** `toastStore`'s
   existing duplicate-collapse (identical variant+message re-raises the same
   card instead of stacking) already satisfies "don't nag" for a repeated
   `onNeedRefresh`, so this module doesn't need its own flag on top of it —
   one less piece of state to keep in sync with toastStore's behavior.
3. **Hourly `registration.update()` poll**, added via `onRegisteredSW`,
   beyond the bare minimum the brief described — justified as the documented
   vite-plugin-pwa pattern for a long-lived tab that never navigates (this
   app's normal usage shape), not an unrequested knob: no interval is
   configurable, no option is exposed, it's one constant.
4. **`onRegisterError` logs, never toasts.** Consistent with
   `docs/error-handling.md` §2: the user didn't cause it, can't act on it,
   and vite-plugin-pwa itself decides whether to retry — toasting it would
   also blow the brief's explicit "one Toast call."

## Backlog for specs.md §12

- **Toast action-button capability** (see above) — needed before this
  feature's "taking it" half is reachable from the UI. Concrete proposed
  diff given above; small enough that any future track touching
  `toastStore.ts`/`Toast.tsx` could fold it in.
- Once that capability exists, wire `applyServiceWorkerUpdate` to it from
  wherever the toast is raised (today that's inside `swUpdate.ts` itself,
  so the wiring is a one-line change there, not a new call site).

## Doc lines to add (operator-owned `src/lib/README.md`)

Insert as a new bullet immediately after the existing `toastStore.ts` bullet
(before `utils.ts`), verified against the current file at merge time per
review-protocol §5:

```markdown
- `swUpdate.ts` — service-worker update lifecycle (`specs.md` §10.16). A pure
  `createSwUpdateController(registerSW)` factory around `virtual:pwa-register`
  (`vite.config.ts`'s `registerType: 'prompt'`), injectable so tests never
  need the real virtual module. Raises `toast.success('update:available')`
  when a new version is waiting; polls `registration.update()` hourly so a
  tab that never navigates still notices a deploy; a failed poll (offline)
  and a registration failure are both swallowed/logged, never toasted — only
  a deliberate call to `applyServiceWorkerUpdate()` ever applies the update
  and reloads, so nothing here can interrupt a user mid-session on its own.
  `initServiceWorkerUpdates()` (called once from `main.tsx`) is the real
  entry point. **Not yet wired to a UI control** — `Toast`/`toastStore` have
  no action-button capability today; see `docs/wave-3/w.md` for the proposed
  extension.
```

## Spec deltas

- `specs.md` §10.16's "one small registration module, one Toast call" is
  accurate as built. What the spec (and the brief) understate is that "an
  action that applies the update" assumes the Toast surface already supports
  an action — it doesn't, today. This isn't a scoping error in what Track W
  was asked to build; it's a premise about a dependency (`toastStore.ts`/
  `Toast.tsx`) that turned out false. Recorded here rather than silently
  worked around.
- The brief's "you may add a new top-level `update.*` namespace" necessarily
  means also registering it in `src/lib/i18n/index.ts`'s `I18N_NAMESPACES`
  array (confirmed necessary: without it, `useTranslation('update')` would
  still resolve at runtime since resources are loaded inline, but it breaks
  the codebase's own stated convention that this array is "reserved up
  front" for every namespace, and the `src/lib/i18n/README.md`'s namespace
  list would silently go stale). That file isn't in Track W's explicit
  three-file list; I treated it as a necessary companion to the locale
  carve-out that _is_ explicitly granted, not as scope creep. Flagging in
  case the operator disagrees with that reading.

## Open questions for the operator

1. Is the proposed `ToastItem.action` shape (above) the right one, or should
   a future track design it differently (e.g. a dedicated "sticky" toast
   variant that doesn't auto-dismiss while an action is pending)? I did not
   design past the minimal shape since it's out of my ownership this stage.
2. Given the update currently only applies on a full tab close/reopen (no
   UI action reachable), is that acceptable as this stage's shipped
   behavior, or should stage 2/3 prioritize the Toast action extension
   specifically to close this gap before it's considered done end-to-end?

## `bun run check` output (real, pasted)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-w

 Test Files  76 passed (76)
      Tests  710 passed (710)
   Start at  14:56:19
   Duration  14.26s (transform 2.11s, setup 14.01s, import 40.70s, tests 17.46s, environment 39.56s)
```

(The `button.tsx` warning is pre-existing and outside this track's ownership
— unrelated to any file this track touched.)

**Flake observed, investigated, not this track's:** twice during this run,
`src/router.kitError.test.tsx` (a dynamic-import-failure/lazy-chunk test,
unrelated to anything Track W touches) timed out at 5000ms only when run as
part of the full suite, never in isolation (`bun run test
src/router.kitError.test.tsx` passed cleanly both times it was tried).
Re-running the full suite immediately after, unchanged, went green both
times. This reads as worker-pool timing contention under load, not a defect
introduced here — confirmed by running the full suite a third time
immediately before pasting the output above, green. Flagging in case the
operator sees the same pattern from other tracks' machines; not something I
attempted to fix since it isn't in this track's ownership and isn't
reproducible on demand.

## `bun run build` output (real, pasted)

```
$ tsc -b && vite build
vite v8.1.0 building client environment for production...
✓ 955 modules transformed.
rendering chunks...
computing gzip size...
dist/manifest.webmanifest                                  0.37 kB
dist/index.html                                             0.68 kB │ gzip:   0.39 kB
dist/assets/manrope-vietnamese-wght-normal-usUDDRr7.woff2   8.52 kB
dist/assets/manrope-greek-wght-normal-DL7QRZyv.woff2        9.44 kB
dist/assets/manrope-cyrillic-wght-normal-Dvxsihut.woff2    14.50 kB
dist/assets/manrope-latin-ext-wght-normal-Ch3YOpNY.woff2   15.12 kB
dist/assets/manrope-latin-wght-normal-DHIcAJRg.woff2       24.83 kB
dist/assets/index-DKjCKHgC.css                             55.55 kB │ gzip:  13.23 kB
dist/assets/workbox-window.prod.es5-Bd17z0YL.js             5.65 kB │ gzip:   2.20 kB
dist/assets/Kit-BqqwNqRc.js                                17.48 kB │ gzip:   5.28 kB
dist/assets/index-Dto0Cbap.js                             899.52 kB │ gzip: 280.00 kB

✓ built in 229ms
(!) Some chunks are larger than 500 kB after minification. [pre-existing, unrelated]

PWA v1.3.0
mode      generateSW
precache  14 entries (1040.89 KiB)
files generated
  dist/sw.js
  dist/workbox-2fbc6a65.js
```

`dist/sw.js` inspected directly: `self.skipWaiting()` fires only on an
explicit `SKIP_WAITING` message, never on install — confirms
`registerType: 'prompt'` took effect in the generated worker, not just in
the TypeScript config.

`dist/` was removed after inspection (gitignored, not committed).
