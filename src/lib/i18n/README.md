# src/lib/i18n

Translation table + locale detection. `react-i18next` + `i18next`, bundled
JSON resources — no `i18next-http-backend`, no CDN.

- `index.ts` — initializes the shared `i18next` instance (inline
  `resources`, `useSuspense: false`), keeps `<html lang>` in sync via
  `languageChanged`. Imported once, as a side effect, from `src/main.tsx`.
- `resources.ts` — assembles the four locale JSON files into the shape
  `i18next` expects (`resources[locale][namespace]`). Exports
  `SupportedLocale`, `SUPPORTED_LOCALES`, `isSupportedLocale`.
- `detectLocale.ts` — `detectLocale()`: pure `navigator.languages` →
  `SupportedLocale` mapping. Exact tag match wins, then language-subtag
  match, unmatched Spanish variants collapse to `es`, everything else falls
  back to `en`. Also exports `detectRegion()`: the device region (region
  subtag of `navigator.languages`/`navigator.language`), an axis
  independent of the copy locale, falling back to the copy locale's
  canonical region when no candidate carries a subtag.
- `regionCurrency.ts` — `monedaForRegion(region)`: a lookup from device
  region to the initial `Moneda`. Used only by `seedConfig.ts`'s first-run
  seed.
- `localeFormatting.ts` — `useLocaleFormatting()` / `localeFormatting()`:
  turns copy locale + device region into an `Intl` tag and a `date-fns`
  `Locale`.
- `localeLabels.ts` — `LOCALE_LABEL`: each `SupportedLocale`'s endonym, not
  routed through `i18next`.
- `localeResolution.ts` — `resolveActiveLocale(stored, languages?)`: a
  stored `Preferencias.idioma` wins over `detectLocale()`; absence means
  "follow the device." Pure, no `i18next` import.
- `syncStoredLocale.ts` — `syncStoredLocale()`: subscribes to
  `useDataStore` and calls `i18next.changeLanguage(resolveActiveLocale(…))`
  whenever `Config.preferencias.idioma` changes. Called once from
  `src/main.tsx`, kept out of `index.ts` so test setup can import the
  shared `i18next` instance without pulling in the real `dataStore`.
- `amountFormat.ts` — `parseAmount`/`parseAmountForInput`/
  `formatAmountForInput`, the pure locale money helpers behind
  `MovimientoAmountInput.tsx` and `useMovimientoForm.ts`. Built on
  `Intl.NumberFormat(locale).formatToParts` to read the locale's actual
  decimal/group separators. `formatAmountLive(raw, locale)` reformats a raw
  amount string live as it's typed; `digitsBeforeIndex`/
  `indexAfterDigitCount` do the digit-count-based caret math behind
  `MovimientoAmountInput.tsx`'s reflow.
- `i18next.d.ts` — module augmentation typing `t()`'s key space off `es`
  (base and fallback), so `t('does.not.exist')` is a compile error.
- `locales/*.json` — one file per locale (`es`, `en`, `es-AR`, `pt-BR`),
  each with the same reserved namespace keys at the top level (see
  `I18N_NAMESPACES` in `index.ts`). `resources.test.ts` asserts
  `I18N_NAMESPACES` and `es.json`'s top-level keys are the same set. `es`
  is the source of truth for shape; the other three must stay
  key-identical even where a namespace is still `{}`.

## Adding a key

1. Add it to `locales/es.json`, inside the namespace object it belongs to.
2. Add the same key, translated, to `en.json`, `es-AR.json`, `pt-BR.json` at
   the same path.
3. Read it with `useTranslation('<namespace>')` then `t('path.to.key')`, or
   `<Trans t={t} i18nKey="path.to.key" components={{...}} />` for copy that
   embeds inline markup.
4. A value the caller controls (a brand name, a count) is an interpolation
   value (`t('key', { appName: APP_NAME })` against `"{{appName}}"` in the
   JSON) — never baked into the locale file itself.

## Adding a locale

1. Add a new `locales/<tag>.json` with the exact same namespace/key shape as
   `es.json`.
2. Register it in `resources.ts` and in `detectLocale.ts`'s `EXACT_LOCALE`
   (and `SUBTAG_LOCALE` if it should also catch untargeted variants of its
   language).
3. `SupportedLocale` (from `resources.ts`) widens automatically.

## Out of scope here (by design)

The locale picker UI lives in `src/features/settings/`, not here — this
directory only owns resolution and the wiring that applies it. No
number/currency/date formatting either — that's `Intl`/`date-fns` at the
call site.
