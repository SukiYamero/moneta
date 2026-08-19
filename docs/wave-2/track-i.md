# Track I — i18n scaffolding — report

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
- **Locale detection is a hand-rolled two-tier `Record` lookup**
  (`detectLocale.ts`), not `i18next-browser-languagedetector`: exact tag
  match wins (case-insensitively), then language-subtag match, then `en`.
  Zero extra dependency, and it is the one piece of this system the brief
  specifically wanted pure and independently testable.
- **`<html lang>` sync** is a plain `i18next.on('languageChanged', ...)`
  subscription in `src/lib/i18n/index.ts` plus one explicit initial call —
  works with or without React mounted yet.
- **Namespace skeleton**: `common`, `auth`, `driveConsent`, `toast`, `nav`,
  `home`, `search`, `history`, one JSON object per locale file, all four
  locale files kept key-identical (unused namespaces are `{}` in all four).
  `auth.welcome.*` holds `WelcomeScreen`'s copy; `driveConsent.*` (flat,
  plus a nested `permissions.{createFiles,noOtherAccess}` pair) holds
  `DrivePermissionScreen`'s copy today — Track J edits this same object
  in place per the plan's documented sequencing.
- **`Trans` used for the Welcome screen's legal disclaimer** (`welcome.legal`
  key, `<terms>`/`<privacy>` placeholders) instead of splitting the sentence
  into 3-4 concatenated keys — this is the one piece of the two screens that
  actually needed react-i18next's specific machinery (styled inline spans
  inside a sentence whose word order a translator should control).
- **`tsconfig.app.json` gained `resolveJsonModule: true`.** Not in Track I's
  literal "Owns" list, but required for `import es from './locales/es.json'`
  (both the resource loader and the type-augmentation file) to type-check at
  all. No other Wave 2 track's brief touches this file, so no conflict risk
  identified.
- **`src/test/setup.ts` now forces the `es` locale** (`beforeAll` +
  `afterEach` calling `i18next.changeLanguage('es')`) so no test's result
  depends on jsdom's ambient `navigator.languages`. Not in the literal
  "Owns" list either, but it's shared test infrastructure with no listed
  owner this wave, and every future track's tests benefit from starting in
  a known locale.

## Backlog / deferred (for specs.md §12)

- **`errorCopy.ts` (auth) is NOT routed through `t()` — deliberately left
  as pure Spanish literals.** See "Question the brief" below for the full
  reasoning. Net effect: a non-Spanish-browser user who hits a login/Drive
  error today sees Spanish inline error text while the rest of the screen
  is in their language. This is a real, visible inconsistency, not a
  hypothetical one (no locale picker is needed to trigger it — it's purely
  a function of the visitor's own browser language). Worth closing the same
  day someone next opens `errorCopy.ts` for related work, once there's a
  precedent elsewhere in the app for a plain (non-component) module reading
  the live i18next instance safely.
- **Locale-file drift isn't lint-enforced.** `src/lib/i18n/README.md` says
  "keep `en`/`es-AR`/`pt-BR` key-identical to `es` by hand (or a future lint
  pass, not built yet)." Nothing currently fails the build if a later track
  adds a key to `es.json` inside its namespace and forgets the other three.
  TypeScript will catch _using_ a key that doesn't exist in `es` (the typed
  side), but not a key that exists in `es` and is silently missing from
  `en`/`es-AR`/`pt-BR` (that only degrades to `fallbackLng: 'es'` at
  runtime — not a crash, just untranslated). A small script diffing key
  paths across the four JSON files (run in `bun run check` or as a
  pre-commit step) would close this; out of scope for this track's brief.

## Doc lines to add (say exactly which file and where)

**`AGENTS.md`**, replace the sentence:

> `Everything in English`: code, identifiers, comments, commit messages, docs, spec files. (Exception: the `schema.ts` domain terms above; user-facing UI copy is Spanish.)

with:

> `Everything in English`: code, identifiers, comments, commit messages, docs, spec files. (Exception: the `schema.ts` domain terms above; user-facing UI copy is looked up from `src/lib/i18n` — see that folder's `README.md` — and is Spanish (`es`) for any string not yet retrofitted into the table.)

**`src/lib/README.md`**, add one bullet (alphabetically it would sit right
after `branding.ts`, before `auth.ts`; exact wording — the operator can drop
it in anywhere reasonable):

> - `i18n/` — the translation table (`react-i18next`/`i18next`, bundled JSON, four locales: `es`/`en`/`es-AR`/`pt-BR`, `es` base and fallback). Own `README.md`.

## Spec deltas (anything where the brief below turned out wrong)

None. The brief's shape (namespaces, edge cases, done-when) matched what the
two screens actually needed; the only real surprise was the `initImmediate`
option not existing in the installed i18next major version, resolved by
reading the library's own source rather than assuming the older API.

## Open questions for the operator

1. **`errorCopy.ts` — confirmed left alone, follow-up filed above.** If you
   read the reasoning below and disagree, it's a small, contained change to
   make later; I did not want to weaken
   `docs/error-handling.md` §7's drift-guard tests to force it in now.
2. **`tsconfig.app.json` and `src/test/setup.ts` edits** — flagging these
   explicitly since they're outside my literal "Owns" list; please confirm
   no other Wave 2 track needed to touch either this wave before folding
   this branch in.

---

## Question the brief (as requested)

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
obvious.

### 2. Moving `errorCopy.ts`'s Spanish values behind `t()`

**Not done — reported as a follow-up instead**, per the brief's own escape
hatch ("If that gets ugly, do not do it").

I got far enough to see the shape it would take (message → key `Record`,
then `i18next.t(key)` inside `loginErrorCopy`/`driveErrorCopy`, same
exported signature, no test file edits needed since the existing assertions
are exact-string `.toBe()` checks against the forced `es` locale). It's not
_impossible_ to do cleanly. What stopped me:

- The whole point of `docs/error-handling.md` §7's message-keying tests is
  that `loginErrorCopy`/`driveErrorCopy` are **pure**: same message in, same
  copy out, always, independent of anything else that's running. Routing
  the _value_ half through `i18next.t()` makes the function's output depend
  on hidden global mutable state (the current `i18next` language) — which
  is a different kind of function than the one that delicate drift-guard
  test suite was built to protect. It's not that the tests would _fail_ (I
  traced through and they wouldn't, with the locale forced to `es`), it's
  that the property they're protecting quietly changes underneath them: a
  reader of `errorCopy.test.ts` today can reason "this is a deterministic
  string→string map" without knowing anything about i18next; after this
  change that stops being true, and nothing in the test file would tell
  them so.
- The actual payoff is real but narrow: the two screens I'm retrofitting are
  the _only_ place these two functions are called, so this would fully
  close the "error text stays Spanish while everything else translates"
  gap — but it's still one narrow gap, not a systemic one, and closing it
  safely wants a first precedent for "a plain module reads the live
  i18next instance outside a component" to exist and be reviewed on its own
  merits, not be introduced for the first time inside the codebase's
  highest-scrutiny error-copy file.

I'd rather hand this back as a well-scoped, well-understood follow-up (see
Backlog above) than take a shortcut through the file `docs/error-handling.md`
itself calls out as the one place message-keying drift already bit this
project once.
