# Track I — i18n scaffolding — review

Reviewer pass after five later tracks (K, J, L, E2, E3, E4) built on top of
this scaffolding. Findings ranked most severe first. CONFIRMED = traced or
reproduced (method stated); PLAUSIBLE = reasoned, not reproduced.

## Findings

### 1. `detectLocale()` throws when `navigator.languages` is missing — CONFIRMED, FIXED

The default parameter read `navigator.languages` unguarded:

```ts
export const detectLocale = (
  languages: readonly string[] = navigator.languages,
): SupportedLocale => {
  for (const tag of languages) { ... }
```

Some browsers/webviews expose `navigator` without a `languages` array (only
the singular `navigator.language`). When `navigator.languages` is
`undefined`, the default parameter evaluates to `undefined`, and
`for (const tag of languages)` throws `TypeError: languages is not
iterable`. `detectLocale()` runs at module-import time in
`src/lib/i18n/index.ts` (`lng: detectLocale()`), so this crashes app
initialization before any UI renders — not a degraded screen, a blank app.

Reproduced with a scratch test (`vi.stubGlobal('navigator', { ...navigator,
languages: undefined })`) before touching the fix — it threw exactly as
predicted.

**First fix was wrong — operator caught it.** My first pass defaulted
straight to `[]`, which silently sent every such user to `en` even when
`navigator.language` (the singular, guaranteed field my own comment named)
carried real information — e.g. a webview with `navigator.language ===
'es-AR'` would get English, no crash but the wrong answer, silently. The
operator required a one-step-at-a-time degradation instead. Added the two
missing cases to `detectLocale.test.ts` first and watched the
`navigator.language`-degradation one fail against my first fix:

```
× degrades to navigator.language, not straight to en, when navigator.languages is missing
  AssertionError: expected 'en' to be 'es-AR'
```

Then fixed `detectLocale.ts` to degrade in order — `navigator.languages` →
`[navigator.language]` → `[]` — so `en` stays the true last resort:

```ts
languages: readonly string[] = navigator.languages ??
  (navigator.language ? [navigator.language] : []),
```

Re-ran: 12/12 pass (`falls back to en for an empty languages list` still
covers the fully-empty case; the two new tests cover
`navigator.language`-only degrading correctly, and both being absent still
landing on `en`). This is the only default-parameter read of a global in
`src/lib/i18n/**`, and `detectLocale.ts` is the only place in `src/` that
reads `navigator.languages`/`navigator.language` (confirmed via `rg`) —
nothing else has the same shape.

**Does `navigator` itself being absent matter here?** No — checked, not
assumed. `vite.config.ts` runs tests under `environment: 'jsdom'`
(`vite.config.ts:56`), which always provides a `navigator` global, and
`src/lib/i18n/index.ts` is only ever imported from `src/main.tsx` — a
browser entry point, no SSR/Node-only code path anywhere in this app
(AGENTS.md: no own backend, offline-first PWA). So the bare identifier
`navigator` is never undefined in any context this module actually runs
in; only its `.languages`/`.language` properties can be missing, which is
exactly what the fix above now handles.

Every other edge case in the brief was already handled correctly and I
could not break it: empty `navigator.languages` (falls back to `en`,
already tested), a script-subtag tag (`zh-Hans-CN` — `split('-')[0]` is
still the language subtag, works), a malformed empty-string tag (skipped,
no throw), casing, region-only differences. I added throw-safety checks for
the script-subtag and malformed-tag cases as scratch tests, confirmed no
throw, and did not add them permanently since they were never actually
broken — only the `navigator.languages`-undefined path was.

### 2. The key-parity test can't tell an empty namespace from an absent one — CONFIRMED, FIXED

The brief specifically asked me to attack this shape. `flattenKeys` recursed
into every plain object regardless of whether it had entries, so `Object
.entries({}).flatMap(...)` returns `[]` — identical to what you get if the
key is missing from the object entirely. I proved it with a synthetic
fixture added to `resources.test.ts`:

```ts
const withEmptyNamespace = flattenKeys({ common: {}, auth: { a: '1' } })
const missingNamespace = flattenKeys({ auth: { a: '1' } })
expect(missingNamespace).not.toEqual(withEmptyNamespace)
```

This failed (`[ 'auth.a' ]` deep-equal `[ 'auth.a' ]`) before the fix.
Fixed `flattenKeys` to treat an empty object as its own leaf instead of
recursing into it and dropping it:

```ts
return isPlainObject(child) && Object.keys(child).length > 0 ? flattenKeys(child, path) : [path]
```

Re-ran: passes. Practical severity today is low — `common` is the only
namespace that's genuinely empty in all four locales, so nothing currently
exploits the gap — but it's exactly the guard's one job, so I closed it
rather than leave it as a known blind spot.

I additionally reproduced (per the brief) every other divergence shape
against the _unmodified_ test and confirmed each one was already caught
correctly, before finding the gap above:

- missing key in one locale — caught, correct diagnostic (`-` line points
  at the missing path).
- extra key in one locale — caught (`+` line).
- a key that's an object on one side and a string on the other
  (`auth.welcome.connecting` mutated to `{ nested: 'oops' }` in `en.json`)
  — caught: the flattener produces `auth.welcome.connecting.nested`
  instead of `auth.welcome.connecting`, so the sorted lists diverge.
- an entire namespace deleted from one locale (`delete en.nav`) — caught,
  because `nav` has real leaf keys.

### 3. `errorCopy.ts`'s compile-time guard — CONFIRMED

Deleted `popupClosed` from `es.json`'s `auth.errors` and ran
`tsc -p tsconfig.app.json --noEmit`:

```
src/features/auth/errorCopy.ts(26,3): error TS2322: Type '"errors.popupClosed"'
is not assignable to type '"errors.missingClientId" | "errors.gisFailedToLoad" |
"errors.accessDenied" | "errors.popupFailedToOpen" | "errors.loginDefault" |
"errors.driveDefault"'.
```

Genuinely fails, exactly as the module's comment claims. Reverted
immediately (`git diff` on `es.json` was empty afterward, verified). Also
verified `errorCopy.test.ts` still derives every input from real
`new AuthError(reason).message` / `new DriveError(reason).message`
construction, never a retyped literal — the drift guard `docs/error-handling.md`
§7 asks for is intact.

**Vindicated by later tracks.** `src/features/home/errorCopy.ts`
(Track E2) independently reproduces the identical pattern —
`` `error.codes.${keyof typeof es.home.error.codes}` `` derived straight
from the JSON, a `Record` over the exhaustive `RepoErrorCode` union, pure
and i18next-free. Track I's operator-directed refactor (return a key, not
copy) is the shape a later, unrelated track reached for on its own. That's
real evidence the decision was right, not just internally consistent.

### 4. `i18next` initialization claim — CONFIRMED by reading the library source, not the comment

Verified in `node_modules/i18next/dist/cjs/i18next.js` (v26.3.6):
`init()` calls `load()` synchronously whenever `this.options.resources` is
set (`if (this.options.resources || !this.options.initAsync) { load() }
else { setTimeout(load, 0) }`), and `changeLanguage`'s `loadResources` path
resolves synchronously too when `options.resources` is set (`else {
usedCallback(null) }`, no async backend). So by the time `.init()` returns,
`i18next.resolvedLanguage` is already set and `t()` is usable — the
claim in `index.ts`'s comment holds, not just asserted.

Two doc sites made a _different_, stale claim: they said the mechanism was
an `initImmediate: false` option, which doesn't exist in this installed
i18next major version (confirmed the same way — reading the source; matches
track-i.md's own investigation note). Fixed both, since they contradict the
actual code and would mislead the next person who goes looking for that
option:

- `src/lib/i18n/README.md` — rewrote the `index.ts` bullet to describe the
  real mechanism (inline `resources` → synchronous `load()`).
- `src/features/auth/WelcomeScreen.test.tsx` — same stale
  `initImmediate: false` reference in a test comment, corrected.

`<html lang>` tracking (`index.test.ts`) and locale-change behavior both
pass as-is; I did not find anything to fix there. `applyDocumentLang` runs
right after `.init()`, and per the source trace above, `resolvedLanguage`
is already set at that point on the very first tick — not a race.

### 5. Translation quality — CONFIRMED, one fix applied; otherwise good

I flattened all four locale files and diffed every leaf value against
`es`, then manually judged every case where `en` or `pt-BR` matched `es`
verbatim (the "copy-pasted Spanish" pattern the brief warned about).

- **`en.json`**: zero matches against `es` other than `toast.repeatSuffix`
  (`"×{{count}}"`, which is correct — it's a symbol + interpolation, not
  language content). Every other string is genuinely translated, natural
  English, not machine-flavored.
- **`pt-BR.json`**: ~17 strings match `es` verbatim, but on inspection
  every one is a legitimate Spanish/Portuguese cognate used correctly in
  Portuguese (`Perfil`, `Filtros`, `Semana`, `Personalizado`, `Tipo`,
  `Todos`, `Etiquetas`, `{{count}} resultado(s)`, etc.) — not
  untranslated copy-paste.
- **One real bug, fixed**: `history.breakdown.gasto` in `pt-BR.json` was
  `"Gastos"`, while every other occurrence of the same "expense" concept
  in the same file uses `"Despesas"` (`home.balance.expense`,
  `home.chart.title` = "Despesas da semana",
  `search.filters.type.gasto` = "Despesas"). `"Gastos"` is a real
  Portuguese word too (not a wrong-language bug), but it's an internal
  terminology inconsistency inside one file — a user would see "Despesas"
  everywhere except the History breakdown card. Fixed to `"Despesas"` for
  consistency with the rest of `pt-BR.json`. This is a value-only change;
  the parity test can't (and shouldn't) catch it since both strings are
  valid leaf values — I verified by inspection, there's no test to watch
  fail here, per the brief's allowance to fix translations directly.
- **`es-AR.json`**: genuinely localized (voseo throughout — `sos`,
  `intentá`, `revisá`, `podés`, `tenés`, `registrá`, `probá` — not just a
  copy of `es.json`), correct usage as far as I can judge.
- I did **not** find any case of a key present in all four passing the
  parity test while actually shipping broken/wrong-language copy on a
  real screen, beyond the one fixed above.

### 6. Sweep for the same shape — reported per AGENTS.md

- **`toast.success(message)` / `toast.error(message)` take a raw
  `string`, and no production call site localizes it.** The only real
  callers today are `src/components/shared/ToastKitDemo.tsx` (a `/kit` dev
  demo, hardcoded Spanish) and test files. `src/features/lock/AppLock.tsx`
  — the one place a real feature could plausibly raise a toast — does not
  call `toast.*` in production code at all yet (confirmed: `grep -n
"toast\." src/features/lock/AppLock.tsx` is empty). So this is not a
  live bug today, but the scaffolding never established what a toast
  caller should look like (`toast.success(t('...'))`?), and
  `toastStore.ts`'s own comment says "Callers pass already-localized copy"
  with nothing enforcing it. I did not fix this — `toastStore.ts` and
  every plausible caller are outside my file ownership and cross into
  Track K's and future tracks' territory. Flagging for the operator to
  decide whether a convention/lint should exist before the first real
  caller ships.
- **`src/features/lock/errorCopy.ts` still returns raw Spanish strings**,
  not a translation key — unlike `auth/errorCopy.ts` and
  `home/errorCopy.ts`. This is not a new defect: `track-i.md`'s own
  backlog section explicitly deferred it ("The `lock` feature is not
  i18n'd at all... explicitly out of scope"), and it predates Wave 2
  entirely (last touched in a Wave-1 commit, `git log` confirms). Five
  Wave-2 tracks have landed since and nobody has picked it up. I did not
  fix it — `src/features/lock/**` is not mine to touch, and it wasn't in
  Track I's brief. I did notice this deferred item lives only in
  `docs/wave-2/track-i.md`, not in `specs.md` §12's canonical backlog —
  worth promoting there so it isn't only discoverable inside one track's
  own report.
- No other `for (const x of <possibly-undefined>)` or unguarded
  `navigator.*` default-parameter pattern exists elsewhere in `src/`
  (checked via `rg 'navigator\.'`, matches only `detectLocale.ts` and its
  test).

## Question the framing

- **`react-i18next` over a hand-rolled `t()`: right call, confirmed by
  hindsight.** Track I's own report already flagged this as "close, not a
  slam dunk." Five tracks later: `fallbackLng` is exercised for real (every
  namespace but `auth`/`driveConsent` started empty and got filled by a
  different track), plural forms are used for real
  (`resultsCount_one`/`_other`, `apply_one`/`_other` in `search.json`'s
  keys), and every later track adopted the exact
  `useTranslation('<namespace>')` + `t('key')` shape without
  reinterpreting it. A hand-rolled 60-line `t()` would have needed to grow
  fallback-chain and plural-rule support mid-wave, under a different
  track's brief. The dependency paid for itself.
- **The `errorCopy` key refactor: right call, confirmed by imitation.**
  See finding 3 — `home/errorCopy.ts` independently reinvented the same
  derived-type-key pattern without being told to. That's stronger evidence
  than passing tests: an unrelated author reached for the same shape when
  solving a structurally identical problem.

## What I need the operator to decide

1. **Toast localization convention** (finding 6, first bullet) — no
   production caller exists yet, so nothing is broken, but there's no
   established pattern for how a future `toast.success(...)` call should
   localize its message, and it crosses into `toastStore.ts`/future
   feature code I don't own. Worth deciding before the first real caller
   ships, not after.
2. **Promote the `lock` i18n backlog item to `specs.md` §12** — it's real,
   deferred, and currently only discoverable inside
   `docs/wave-2/track-i.md`. Not mine to edit per my file restrictions.

## `bun run check`

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  61 passed (61)
      Tests  579 passed (579)
```

(The `button.tsx` warning is pre-existing and unrelated to this track, per
`track-i.md`'s own report.)
