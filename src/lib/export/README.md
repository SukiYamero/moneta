# src/lib/export

CSV export of the user's movements. No UI here — `index.ts`'s
`exportMovimientosToCsv` is the entry point a UI trigger calls.

- `csv.ts` — pure serialisation: `Movimiento[]` → CSV, as an array of string
  parts (never one big concatenated string). No repo/store/UI import. Emits
  a UTF-8 BOM, a leading `sep=;` hint line, and formats the decimal via the
  given `Intl` locale tag. The header row is the schema field names, not
  localized labels; `extra` is not exported. `seccion`/`categoria` are ids —
  `buildMovimientoCsvParts` takes `secciones`/`categorias` (`Config`'s,
  id → `nombre`) and writes the resolved name, falling back to the raw id
  when a lookup misses. Also the yearly-compaction CSV's implementation:
  `sync/engine.ts`'s `compactYear()` imports `buildMovimientoCsvParts`
  directly.
- `delivery.ts` — platform branching only: builds the `Blob`/`File` and
  hands it to the user via `navigator.share({ files })` where the platform
  can share that exact file, falling back to a download link otherwise. No
  CSV-format knowledge, no repo/store import.
- `index.ts` — `exportMovimientosToCsv({ locale })`: pages through
  `getRepo().movimientos.list()`, fetches `getRepo().getConfig()` for the
  id → name resolution, builds the CSV via `csv.ts`, and delivers it via
  `delivery.ts`. Also exports `buildExportFilename(date)`.
