# Wave 2

**Goal.** Ship the app's first three real, read-only screens — Home, Search, History — on top of Wave 1's foundation.

**Why.** Wave 1 only proved sign-in and storage work; nothing was visible yet. This wave makes the data the user already has visible and browsable, before any write path exists.

- i18n scaffolding — bundled JSON resources (`en`/`es`/`es-AR`/`pt-BR`), locale auto-detected from the browser, in place before other tracks write UI copy.
- Drive-permission screen refined, and the connect/dismiss decision now persists per device instead of re-asking on every session (specs.md §10.4).
- Toast — the shared global notification surface for a write issued from a screen that has since closed, suppressed while the app is locked (specs.md §10.6).
- App shell — a persistent bottom nav (Home/Search/History) on a shared layout route, replacing per-screen chrome.
- `movimientoStats` — totals/breakdown/series aggregation over movements; sums accumulate in integer minor units to avoid float drift, and date parsing uses `date-fns`'s `parseISO` rather than the native `Date` constructor, which parses a date-only string as UTC midnight instead of local midnight.
- Home dashboard, Search + filter sheet, and History with a day/week/month/year period picker, all built on `movimientoStats`.
- Locale-aware number/date formatting made a required argument everywhere it's used, closing call sites that had silently kept a hardcoded regional default.
