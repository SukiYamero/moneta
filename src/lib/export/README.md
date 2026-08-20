# src/lib/export

CSV export of the user's movements (`specs.md` §10.12) — "download your
movements," not a backup and not an import path (see the spec's explicit
rejections). No UI here; §10.18's profile sheet wires the trigger in a later
stage.

- `csv.ts` — pure serialisation: `Movimiento[]` → CSV, as an array of string
  parts (never one big concatenated string). No repo/store/UI import.
  Handles all four spec hazards: UTF-8 BOM, a leading `sep=;` hint line,
  the decimal separator from the given `Intl` locale tag (`useGrouping:
false`, `maximumFractionDigits: 20` — precision-preserving, not a rounded
  display value), and CSV-injection escaping (a leading `=`/`+`/`-`/`@` is
  prefixed with `'`) applied to every column uniformly. The header row is
  the schema field names (`fecha`, `tipo`, `monto`, …), not localized
  labels — see `specs.md` §11 for why. `extra` is not exported.
  `seccion`/`categoria` are ids (`specs.md` §10.22); `buildMovimientoCsvParts`
  takes `secciones`/`categorias` (`Config`'s, id→`nombre`) and writes the
  resolved _name_ in those columns, falling back to the raw id only when a
  lookup misses (not yet synced, deleted elsewhere) — a data export a person
  can still cross-reference, unlike a screen where a raw id is never shown.
- `delivery.ts` — platform branching only: builds the `Blob`/`File` and
  hands it to the user via `navigator.share({ files })` where the platform
  can share that exact file, falling back to a download link otherwise. No
  CSV-format knowledge, no repo/store import.
- `index.ts` — `exportMovimientosToCsv({ locale })`, the one function a
  future UI trigger calls: pages through `getRepo().movimientos.list()`
  (fixed `sortBy`/`sortDir` across pages, per `docs/error-handling.md` §4),
  fetches `getRepo().getConfig()` for the id→name resolution above, builds
  the CSV via `csv.ts`, and delivers it via `delivery.ts`. Also exports
  `buildExportFilename(date)` (`kurobello-movimientos-yyyy-MM-dd.csv`).
