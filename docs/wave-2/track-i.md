# Track I — i18n scaffolding — report

## Operator review round — fixes applied

The operator reviewed the first commit and required three fixes before
merge. All three are in a second commit on `feat/wave2-i18n`. Summary below;
full reasoning stays inline in the code/tests.

1. **`detectLocale()` ignored preference order — CONFIRMED, fixed.**
   `['pt-PT', 'es-AR']` returned `'es-AR'` (a lower-priority exact match)
   instead of `'pt-BR'` (the higher-priority subtag match), because the old
   implementation did two full passes over the list — "exact match anywhere"
   before "subtag match anywhere" — instead of trying exact-then-subtag
   _per candidate_ before moving to the next one. Rewrote to a single pass;
   reproduced the failure against the old code first (see below), then
   fixed it.
   **Sweep for the same shape:** `detectLocale.ts` is the only place in
   `src/` that reads `navigator.languages`
   (`rg 'navigator\.(languages|language)\b' src`), and there is no other
   ordered-preference-list pattern anywhere else in the codebase
   (`Accept-Language`, priority queues, etc.) — nothing else to fix.
2. **No guard on locale-file key parity — added.** New
   `src/lib/i18n/resources.test.ts` flattens each locale file to a sorted
   list of dotted key paths and asserts `en`/`es-AR`/`pt-BR` each equal
   `es`'s. Confirmed it catches drift in both directions (see "Deliberate
   breakage" below), not just missing keys.
3. **`errorCopy.ts` — now returns a translation key, not copy.** Per the
   operator's third-option proposal: `AUTH_ERROR_KEY: Record<string,
AuthErrorKey>` where `AuthErrorKey` is `` `errors.${keyof typeof
es.auth.errors}` `` (derived from the real JSON shape, not a hand-typed
   union that can drift from it). `loginErrorCopy`/`driveErrorCopy` stay
   pure, synchronous, i18next-free functions — same shape as before, just
   returning a key instead of a Spanish sentence. The two screens now call
   `t(loginErrorCopy(error))` / `tAuth(driveErrorCopy(error))` at the render
   site, same as every other string. `errorCopy.test.ts` keeps deriving its
   inputs from real `AuthError`/`DriveError` construction (unchanged) and
   now asserts the returned key instead of the Spanish sentence.

### Reproduced the detectLocale bug before fixing it

```
$ bunx vitest run src/lib/i18n/detectLocale.test.ts   # old implementation
 × honors preference order: a first-choice subtag match beats a later exact match
   AssertionError: expected 'es-AR' to be 'pt-BR'
   Received: "es-AR"
```

Then applied the fix and reran — 10/10 pass.

### Deliberate breakage of the new parity test

Added a stray key to `auth.welcome` and deleted `driveConsent.dismissCta`
from `en.json` only, then ran the suite:

```
 × en has exactly the same key paths as es
   AssertionError: expected [ 'auth.welcome.connecting', …(14) ] to deeply equal [ …(14) ]
   - Expected
   + Received
     [
       "auth.welcome.connecting",
   +   "auth.welcome.extraKeyThatIForgotElsewhere",
       "auth.welcome.googleCta",
       ...
   -   "driveConsent.dismissCta",
       "driveConsent.permissions.createFiles.body",
       ...
```

The test name pins the exact locale file (`en`), and the diff pinpoints both
the added and the missing key. Reverted `en.json` immediately after
(`git diff` on it is empty).

### Real `bun run check` output after all three fixes

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 Test Files  37 passed (37)
      Tests  363 passed (363)
```

(The `button.tsx` warning is pre-existing, unrelated to this track — same
one flagged in the first report.)

## Decisions made (for specs.md §11)

- **`react-i18next` + `i18next` taken as a dependency**, with bundled JSON
  resources (no `i18next-http-backend`, no CDN — `AGENTS.md`'s no-CDN rule).
  See "Question the brief" below for the honest tradeoff — this was close,
  not a slam dunk.
- **i18next initializes synchronously with no extra option needed.** In
  i18next v26, `init()` calls `load()` immediately (rather than deferring
  via `setTimeout`) whenever `options.resources` is set — the older
  `initImmediate` option that earlier i18next major versions needed for this
  no longer exists in the v26 types at all (confirmed by reading
  `node_modules/i18next/dist/cjs/i18next.js`, not just the changelog).
  Passing `resources` inline is therefore sufficient for `useSuspense:
false` to never flash empty text.
- **Locale detection is a hand-rolled single-pass `Record` lookup**
  (`detectLocale.ts`), not `i18next-browser-languagedetector`: each
  candidate in `navigator.languages`, in order, tries exact match
  (case-insensitively) then subtag match before moving to the next
  candidate — a first-choice language never loses to a lower-priority one.
  Zero extra dependency, and it is the one piece of this system the brief
  specifically wanted pure and independently testable.
- **`<html lang>` sync** is a plain `i18next.on('languageChanged', ...)`
  subscription in `src/lib/i18n/index.ts` plus one explicit initial call —
  works with or without React mounted yet.
- **Namespace skeleton**: `common`, `auth`, `driveConsent`, `toast`, `nav`,
  `home`, `search`, `history`, one JSON object per locale file, all four
  locale files kept key-identical (unused namespaces are `{}` in all four,
  now enforced by `resources.test.ts`). `auth.welcome.*` holds
  `WelcomeScreen`'s copy, `auth.errors.*` holds the login/Drive error copy
  keys (see below); `driveConsent.*` (flat, plus a nested
  `permissions.{createFiles,noOtherAccess}` pair) holds
  `DrivePermissionScreen`'s copy today — Track J edits this same object
  in place per the plan's documented sequencing.
- **`Trans` used for the Welcome screen's legal disclaimer** (`welcome.legal`
  key, `<terms>`/`<privacy>` placeholders) instead of splitting the sentence
  into 3-4 concatenated keys — this is the one piece of the two screens that
  actually needed react-i18next's specific machinery (styled inline spans
  inside a sentence whose word order a translator should control).
- **`errorCopy.ts` returns translation keys, not copy** (see review round
  above). `AuthErrorKey` is derived from `typeof es.auth.errors`'s actual
  keys, so adding/renaming an error key in the JSON and forgetting to update
  `errorCopy.ts` (or vice versa) is a compile error, not a silent gap.
  `DrivePermissionScreen` needed a second `useTranslation('auth')` call
  (`tAuth`) alongside its primary `useTranslation('driveConsent')`, because
  react-i18next's typed `t` only accepts unprefixed keys scoped to the
  hook's own namespace — an `ns:key`-prefixed string doesn't type-check
  against a single-namespace-bound `t`, confirmed by trying it and reading
  the resulting compiler error.
- **`tsconfig.app.json` gained `resolveJsonModule: true`.** Not in Track I's
  literal "Owns" list, but required for `import es from './locales/es.json'`
  (the resource loader, the type-augmentation file, and now `errorCopy.ts`)
  to type-check at all. No other Wave 2 track's brief touches this file, so
  no conflict risk identified. **Operator-approved.**
- **`src/test/setup.ts` now forces the `es` locale** (`beforeAll` +
  `afterEach` calling `i18next.changeLanguage('es')`) so no test's result
  depends on jsdom's ambient `navigator.languages`. Not in the literal
  "Owns" list either, but it's shared test infrastructure with no listed
  owner this wave, and every future track's tests benefit from starting in
  a known locale. **Operator-approved.**

## Backlog / deferred (for specs.md §12)

- **The `lock` feature (`LockScreen`/`LockSettings`) is not i18n'd at all.**
  Entirely hardcoded Spanish, untouched by this track — `errorCopy.ts` in
  `src/features/lock/` is a distinct, separate table from the one in
  `src/features/auth/` and was explicitly out of scope (per the operator:
  localizing half the lock feature would be worse than leaving it whole).
  Whoever retrofits `LockScreen`/`LockSettings` should route both its
  regular copy and its `errorCopy.ts` through `t()` together, in one pass.
- **Locale-file drift is now test-enforced, but not yet a fast/early gate.**
  `resources.test.ts` catches it during `bun run test` (part of
  `bun run check`), which is good enough to block a merge, but a developer
  adding a key only to `es.json` won't see the failure until they run the
  full suite (or CI) — no editor-time or pre-commit signal. Fine for now
  given `bun run check` is already the hard gate; worth a `lint-staged`
  entry later if this becomes a repeated speed bump for the five tracks
  about to add keys.

## Doc lines to add (say exactly which file and where)

**`AGENTS.md`**, replace the sentence:

> `Everything in English`: code, identifiers, comments, commit messages, docs, spec files. (Exception: the `schema.ts` domain terms above; user-facing UI copy is Spanish.)

with:

> `Everything in English`: code, identifiers, comments, commit messages, docs, spec files. (Exception: the `schema.ts` domain terms above; user-facing UI copy is looked up from `src/lib/i18n` — see that folder's `README.md` — and is Spanish (`es`) for any string not yet retrofitted into the table.)

**`src/lib/README.md`**, add one bullet (alphabetically it would sit right
after `branding.ts`, before `auth.ts`; exact wording — the operator can drop
it in anywhere reasonable):

> - `i18n/` — the translation table (`react-i18next`/`i18next`, bundled JSON, four locales: `es`/`en`/`es-AR`/`pt-BR`, `es` base and fallback, key parity across all four enforced by a test). Own `README.md`.

**`src/features/auth/README.md`**, update the `errorCopy.ts` bullet from:

> - `errorCopy.ts` — maps a raw `AuthError`/`DriveError` message to the Spanish, actionable copy `WelcomeScreen`/`DrivePermissionScreen` actually render (`loginErrorCopy`, `driveErrorCopy`) — never the raw message (`docs/error-handling.md` §7).

to:

> - `errorCopy.ts` — maps a raw `AuthError`/`DriveError` message to a translation key in the `auth` namespace's `errors` group (`loginErrorCopy`, `driveErrorCopy`) — never the raw message (`docs/error-handling.md` §7). Stays a pure, i18next-free lookup; `WelcomeScreen`/`DrivePermissionScreen` resolve the key with `t()` at the render site, same as every other string on those screens.

## Spec deltas (anything where the brief below turned out wrong)

None new. The brief's shape (namespaces, edge cases, done-when) matched what
the two screens actually needed; the two real surprises were the
`initImmediate` option not existing in the installed i18next major version
(resolved by reading the library's own source), and the ordered-preference
bug in `detectLocale()` the operator's review caught.

## Open questions for the operator

None outstanding — the three review items are resolved above. The two
open items from the first report (`errorCopy.ts` routing, and confirming no
other track needs `tsconfig.app.json`/`src/test/setup.ts` this wave) are
both closed: the operator's third option resolved the first, and the
operator confirmed the second directly.

---

## Question the brief (as requested, unchanged from the first report)

### 1. `react-i18next` vs. a small hand-rolled typed `t()`

Honest answer: **for what the two retrofitted screens alone need, a ~60-line
hand-rolled `t()` would have been enough**, and would have matched
`AGENTS.md`'s "prefer native platform APIs over extra dependencies" rule
more cleanly — neither screen needs plurals, and formatting is explicitly
routed through `Intl` at the call site either way, so two of the three
reasons given for taking the dependency ("plurals, interpolation and
ecosystem") aren't exercised by this track's actual diff.

What tipped it to keeping `react-i18next`:

- **`fallbackLng` is genuinely used, not just available.** Six of the eight
  namespaces ship empty this wave and get filled in by five different
  tracks across two more stages. A homegrown `t()` would need to reinvent
  "missing key in `pt-BR`, fall back to `es`" — not hard, but it's exactly
  the kind of infrastructure a library already gets right across edge cases
  (nested keys, `keySeparator` collisions, etc.) that a fresh 60-line
  version wouldn't be tested against on day one.
- **`Trans` solved a real problem cleanly** (the Welcome screen's inline
  `<terms>`/`<privacy>` disclaimer) that a plain string-interpolation `t()`
  would have forced into an awkward 4-key concatenation with hardcoded word
  order — fragile across `es`/`en`/`es-AR`/`pt-BR` sentence structure.
- **Five other tracks' briefs already assume it.** `docs/wave-2-plan.md`
  repeatedly references `t('...')`-shaped calls and `useTranslation`-style
  namespace access in Tracks K/J/L/E2/E3/E4's "Owns" lists. Switching to a
  custom `t()` now would mean re-deciding this under every other track's
  brief too, not just mine — a bigger blast radius than my track alone.

If it were just these two screens with no reserved namespace skeleton behind
them, I'd have pushed back harder for the custom option. Given the skeleton
is the actual point of this track, I judged the case for the dependency real
but not overwhelming — flagging that nuance rather than pretending it was
obvious. (Operator noted in review: this reasoning holds and is recorded so
the stage-4 reviewer doesn't re-litigate it.)

### 2. Moving `errorCopy.ts`'s Spanish values behind `t()`

**Resolved in the operator review round — see above.** The original
objection (turning a pure function into one that reads hidden global
i18next state) was correct, but the operator's third option sidesteps it
entirely: return a translation _key_ instead of copy, keep the function
itself pure and i18next-free, and localize at the render site like
everything else. That is what shipped. See "Decisions made" and "Backlog"
above for the mechanics and the one remaining gap (the `lock` feature,
explicitly out of scope for this round).
