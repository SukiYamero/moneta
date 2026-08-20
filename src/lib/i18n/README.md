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
  `errors`, `profile` (`docs/wave-2-plan.md` §1.6; `profile` added
  `specs.md` §10.18, Wave 3 stage 3). `es` is the source of truth for
  shape; the other three must stay key-identical even where a namespace is
  still `{}`.

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

No locale picker UI, no persisted locale (`idioma` is not a field on
`Preferencias` — `src/features/profile/PreferencesSection.tsx` renders the
_detected_ `i18next` language as an inert row and says so in its own
`STUB(wave3)` comment; a real picker needs a schema addition first, see
`specs.md` §12), and no number/currency/date formatting — that's
`Intl`/`date-fns` at the call site, not this table. Region _detection_ and
the locale→tag mapping do live here (`detectRegion`, `localeFormatting.ts`);
what stays out is the formatting itself.
