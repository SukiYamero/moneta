# src/lib/i18n

Translation table + locale detection. `react-i18next` + `i18next`, bundled
JSON resources — no `i18next-http-backend`, no CDN.

- `index.ts` — initializes the shared `i18next` instance. Passing inline
  `resources` (no backend/CDN) makes `init()` load synchronously on its own
  in this i18next version — no `initImmediate` option exists to set (it was
  removed from i18next's types; confirmed by reading
  `node_modules/i18next/dist/cjs/i18next.js`, not just the changelog) — so
  combined with `useSuspense: false`, `t()` is usable on first render with
  no flash of empty text. Also keeps `<html lang>` in sync via
  `languageChanged`. Imported once, as a side effect, from `src/main.tsx`.
- `resources.ts` — assembles the four locale JSON files into the shape
  `i18next` expects (`resources[locale][namespace]`).
- `detectLocale.ts` — pure `navigator.languages` → `SupportedLocale` mapping
  (`Record` lookups, no `switch`/`if-else`, per `AGENTS.md`). Exact tag match
  wins; then language-subtag match; unmatched Spanish variants collapse to
  `es`, anything else unmatched falls back to `en`. No locale is persisted —
  detection re-runs identically every boot (`docs/wave-2-plan.md` §3.3).
  Also exports `detectRegion()`: the device region (region subtag of
  `navigator.languages`/`navigator.language`), an axis **independent of the
  copy locale** above, falling back to the copy locale's canonical region
  when no candidate carries a subtag (`specs.md` §10.7).
- `regionCurrency.ts` — `monedaForRegion(region)`: a `Record` lookup from the
  device region to the initial `Moneda` (`MX`→`MXN`, `AR`→`ARS`, `BR`→`BRL`,
  `PE`→`PEN`, `CO`/unmapped→`COP`, `EC`/`US`→`USD`). Used only by
  `src/lib/seedConfig.ts`'s first-run seed — never to reassign a `Config`
  that already exists.
- `localeFormatting.ts` — `useLocaleFormatting()` / `localeFormatting()`:
  the single place that turns copy locale + device region into an `Intl` tag
  and a `date-fns` `Locale`. Pure modules take these as parameters;
  components read the hook (`specs.md` §11, 2026-08-19).
- `localeLabels.ts` — `LOCALE_LABEL`: each `SupportedLocale`'s endonym
  ("Português (Brasil)"), not routed through `i18next` — a language's own
  name doesn't translate. The one source `PreferencesSection.tsx`'s summary
  row and `/settings`'s language picker both read (`specs.md` §10.24).
- `localeResolution.ts` — `resolveActiveLocale(stored, languages?)`: a
  stored `Preferencias.idioma` wins over `detectLocale()`; absence — never
  chosen, or explicitly written back to `undefined` via "seguir el
  dispositivo" — means "follow the device" (`specs.md` §10.24). Pure, no
  `i18next` import, so it's testable without touching the shared instance.
- `syncStoredLocale.ts` — `syncStoredLocale()`: subscribes to
  `useDataStore` and calls `i18next.changeLanguage(resolveActiveLocale(…))`
  whenever `Config.preferencias.idioma` changes (`i18next.changeLanguage`
  is in-place, no remount). Called once from `src/main.tsx`, **not** a
  module-level side effect of this `index.ts` — every test file's
  `src/test/setup.ts` imports this module for the shared `i18next`
  instance, and a static `@/lib/dataStore` import at `index.ts`'s top level
  would load the real store (and, transitively, the real
  `repoProvider.ts`) before a test file's own
  `vi.mock('@/lib/repoProvider', …)` can intercept it — reproduced, not
  guessed, while building this (`specs.md` §10.24; see the file's own
  comment for the count).
- `amountFormat.ts` — `parseAmount(raw, locale)` and its inverse
  `formatAmountForInput(value, locale)`, the pure locale money helpers
  behind `src/components/shared/AmountField.tsx`. Built on
  `Intl.NumberFormat(locale).formatToParts` to read the locale's actual
  decimal/group separators (`es-CO` groups `.`/decimals `,`; `en-US` the
  reverse) — never a hand-rolled parser (`specs.md` §10.14). `parseAmount`
  gates on a strict decimal pattern before `Number()`: bare `Number()` turns
  `''` into `0` and accepts hex, so a lone separator once parsed as $0 and
  `0x1a` as 26. Moved here from `src/components/shared/` (`specs.md` §12,
  2026-08-19) — pure locale logic with no React in it, a sibling of this
  file rather than a component helper.
- `i18next.d.ts` — module augmentation typing `t()`'s key space off `es`
  (base and fallback), so `t('does.not.exist')` is a compile error.
- `locales/*.json` — one file per locale (`es`, `en`, `es-AR`, `pt-BR`), each
  with the same reserved namespace keys at the top level: `common`, `auth`,
  `driveConsent`, `toast`, `nav`, `home`, `search`, `history`, `update`,
  `errors`, `profile`, `tags`, `settings`, `lock`
  (`docs/wave-2-plan.md` §1.6; `profile` added `specs.md` §10.18, Wave 3
  stage 3; `tags` added `specs.md` §10.22, Wave 4 Track G1 — the category
  picker's copy, plus a `colors.*` group of localized `IconAvatarTint`
  names for the color grid's accessible labels; `settings`/`lock` added
  `specs.md` §10.24, Wave 4 stage 2, Track G2 — the `/settings` screen's own
  copy and the lock feature's full i18n retrofit, `errorCopy.ts` included).
  `es` is the source of truth for shape; the other three must stay
  key-identical even where a namespace is still `{}`.

## Adding a key

1. Add it to `locales/es.json`, inside the namespace object it belongs to
   (never at the top level of the file, never appended after an unrelated
   namespace).
2. Add the same key, translated, to `en.json`, `es-AR.json`, `pt-BR.json` at
   the same path. `es` typing will flag any component using a key that
   doesn't exist yet — the other three files won't, so keep them
   key-identical by hand (or a future lint pass, not built yet).
3. Read it with `useTranslation('<namespace>')` then `t('path.to.key')`, or
   `<Trans t={t} i18nKey="path.to.key" components={{...}} />` for copy that
   embeds inline markup (styled spans, etc.) — don't hand-split a sentence
   around JSX, `Trans` keeps word order translator-controlled.
4. A value the caller controls (a brand name, a count) is an interpolation
   value (`t('key', { appName: APP_NAME })` against `"{{appName}}"` in the
   JSON) — never baked into the locale file itself.

## Adding a locale

1. Add a new `locales/<tag>.json` with the exact same namespace/key shape as
   `es.json` (every namespace, even the empty ones).
2. Register it in `resources.ts` and in `detectLocale.ts`'s `EXACT_LOCALE`
   (and `SUBTAG_LOCALE` if it should also catch untargeted variants of its
   language, the way `pt-BR` catches `pt-PT`).
3. `SupportedLocale` (from `resources.ts`) widens automatically — no other
   type change needed.

## Out of scope here (by design)

The locale picker UI lives in `src/features/settings/`, not here — this
directory only owns the resolution (`localeResolution.ts`) and the wiring
that applies it (`syncStoredLocale.ts`). No number/currency/date formatting
either — that's `Intl`/`date-fns` at the call site, not this table. Region
_detection_ and the locale→tag mapping do live here (`detectRegion`,
`localeFormatting.ts`); what stays out is the formatting itself.

`Preferencias.idioma` (`src/lib/schema.ts`) is optional — absent means
"follow the device," which is the actual state for a user who never opened
`/settings`, not a placeholder for a schema addition still to come
(`specs.md` §10.24).
