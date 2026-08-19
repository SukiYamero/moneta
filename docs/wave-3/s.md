# Track S — CSV export — report

## What was built and why

One new folder, `src/lib/export/`, split exactly along the brief's seam:

- `csv.ts` — pure serialisation, `Movimiento[]` → CSV as an array of string
  parts. No repo/store/UI import; trivially unit-testable.
- `delivery.ts` — platform branching only (`navigator.share` with a
  download-link fallback). No CSV-format knowledge.
- `index.ts` — the orchestrator (`exportMovimientosToCsv({ locale })`,
  `buildExportFilename(date)`) that pages through `getRepo()`, calls
  `csv.ts`, then `delivery.ts`. This is the one function a future UI button
  (§10.18, stage 3) will call. No UI trigger added this wave, per the brief.
- `README.md` for the new folder.

All four spec hazards (§10.12) are handled and each has a dedicated test:

1. UTF-8 BOM prepended to the file's first part.
2. A leading `sep=;` line, `;` field separator throughout.
3. `monto` formatted via `Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 })` — never a hand-rolled number string.
4. CSV-injection escaping: a value starting with `=`, `+`, `-`, `@` gets a
   `'` prefix, applied to **every** column uniformly (not just `nota`/
   category names), plus standard RFC4180 quoting for values containing
   `;`, `"`, or a newline.

Dates pass through as the stored ISO strings, unformatted. Empty dataset →
header-only file (not an error, tested). Large dataset → CSV built as an
array of chunked string parts (500 rows/chunk), handed straight to
`new Blob(parts)` in `delivery.ts` so no giant single string is ever formed.
A dedicated test proves `extra` (and anything an attacker could smuggle
into it, e.g. a fake `accessToken` key) never reaches the output — the
column list is a fixed allowlist, not "everything on the object."

## Decisions made (for `specs.md` §11)

1. **Header row = schema field names** (`id;fecha;seccion;categoria;tipo;monto;moneda;metodo;nota;createdAt`),
   per the operator's recommendation — agreed, no changes. Stable across
   locales, matches the real Drive column contract.
2. **`extra` is excluded from the export.** It's schema.ts's escape hatch
   for fields not yet promoted to a real column, not a stable column
   itself, and its shape isn't uniform across rows — including it would
   make the CSV's column count and meaning unpredictable, and it's also
   where anything sensitive smuggled onto a `Movimiento` would most likely
   land.
3. **`useGrouping: false` for `monto`.** Recorded per the brief's "decide
   deliberately and record why": since the field separator is `;` (not
   `,`), a thousands-grouping mark doesn't actually collide with the
   delimiter the way hazard 3 initially reads. Disabled anyway because a
   data export should be the plainest possible number (fewer punctuation
   marks to reason about when a spreadsheet or another tool re-parses the
   column), not a display-formatted one.
4. **`maximumFractionDigits: 20` (Intl's own ceiling), not the default 3.**
   This is a data export, not a currency label — it must preserve the
   exact stored `monto` value. The locale should only decide _which mark_
   is the decimal separator, never how much precision survives. Intl's
   default `maximumFractionDigits` of 3 would silently round anything with
   more decimal places; the app doesn't currently produce such values, but
   there's no reason a portability feature should be the one place data
   quietly loses precision.
5. **Fetch via cursor pagination (`limit`/`cursor`, fixed `sortBy: 'fecha'`,
   `sortDir: 'asc'` on every page)**, not one unbounded `list()` call. Both
   current `Repo` implementations happen to answer a limit-less `list()`
   with the entire table, but the port (`repo.ts`) makes no such promise,
   and a future Drive-backed `Repo` is exactly the implementation most
   likely to cap a single response. Keeping `sortBy`/`sortDir` identical
   across pages matters concretely: `repo.local.ts` rejects a cursor
   replayed under a different one as `invalid_input`
   (`docs/error-handling.md` §4).
6. **Delivery: `navigator.share({ files })` first, download-link fallback**,
   exactly as the brief specifies. `AbortError` (user dismissed the share
   sheet) resolves quietly, not treated as a failure; any other `share()`
   rejection logs via `console.warn` and falls back to the download link
   rather than surfacing as a thrown error — there is no UI yet to catch
   one, and the file is still deliverable via the fallback.
7. **Filename**: `` `${slug(APP_NAME)}-movimientos-${yyyy-MM-dd}.csv` ``,
   e.g. `kurobello-movimientos-2026-08-19.csv`. Reads `APP_NAME` from
   `src/lib/branding.ts` (read-only import, not a write) rather than
   hardcoding the display name, per `AGENTS.md`'s branding rule — the
   filename is display surface, not a storage identifier, so it's meant to
   track `APP_NAME` if it ever changes.

## Backlog / deferred (for `specs.md` §12)

- No UI trigger — explicitly out of scope this wave; §10.18 (stage 3) wires
  a button in the profile sheet to `exportMovimientosToCsv()`.
- `exportMovimientosToCsv` currently has no caller-visible error surface
  (it can reject if `repo.ready()`/`list()` throws, e.g. offline with no
  local data). Stage 3's button implementation will need to catch that and
  route it to the toast, per `docs/error-handling.md` §7 ("the global toast
  … a background write" is exactly this shape). Noting it here so it isn't
  rediscovered as a gap when the button is wired.
- Not built: an `Activo` export. §10.12's title and user story are both
  scoped to "movements" only; if a future spec wants asset exports too,
  that's a new `§10.x` addition, not implicit in this one.

## Doc lines to add (`src/lib/README.md`, operator-owned)

Insert as a new bullet, alphabetically after the `repo.contract.ts` entry
(end of the `src/lib` list), matching the file's existing style:

```markdown
- `export/` — CSV export of the user's movements (`specs.md` §10.12): pure
  serialisation (`csv.ts`) split from platform delivery (`delivery.ts`,
  `navigator.share` with a download-link fallback), orchestrated by
  `index.ts`'s `exportMovimientosToCsv()`. Reads through `getRepo()`; no UI
  trigger yet (`specs.md` §10.18 wires it in a later stage). Own `README.md`.
```

## Spec deltas

None — `specs.md` §10.12 as written matched what got built; no correction
needed.

## Open questions for the operator

- None blocking. One judgment call worth a second look: whether `id` (a
  `crypto.randomUUID()`) belongs in the export at all — it's harmless
  (not secret, not guessable-sensitive) and included today as a real
  schema field, but it's also the one column with no everyday spreadsheet
  use. Left in because "schema field names, all of them except `extra`" is
  a simpler rule than picking and choosing; flag if the operator disagrees.

## `bun run check` output (pasted, real)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-s

 Test Files  78 passed (78)
      Tests  733 passed (733)
   Start at  14:52:10
   Duration  18.58s (transform 2.05s, setup 19.30s, import 53.40s, tests 19.38s, environment 56.12s)
```

Baseline before this track's changes: 700 tests, 75 files, all green
(verified before writing any code). The pre-existing `button.tsx` warning is
unrelated to this track (shadcn-generated file, not touched here).
