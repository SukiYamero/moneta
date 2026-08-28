# 01 — The category contract

**Branch:** `feat/category-contract` · **Phase 1** · Blocks 05, 06, 07.

Read `docs/tasks/category-experience/README.md` first — phases, ownership and
the shared rules live there and are not repeated here.

## Goal

`Categoria` becomes a flat, type-agnostic concept with an optional parent, and
`Seccion` leaves the data model entirely. After this task a category is a name,
an icon, a color, and optionally the id of another category it belongs to —
nothing else. The tree compiles, every test passes, and no removed field is
referenced anywhere.

## Why (this belongs in your commit message, not in the code)

A category tied to `gasto` or `ingreso` produced a contradiction the user
named directly: a category marked "gasto" could still be used on an income.
`Seccion` was designed for a personal-vs-business breakdown that was never
built — no screen groups or filters by it, `movimientoStats`' `groupKey` is
never called with `'seccion'`, and `repo.local`'s `seccion` filter has no caller
— while forcing a meaningless choice on every category the user creates.

## The contract, exactly

In `src/lib/schema.ts`:

```ts
export const SCHEMA_VERSION = 2

export interface Categoria {
  id: string
  nombre: string
  padreId?: string
  icono?: CategoryIconKey
  color?: IconAvatarTint
  archivado?: boolean
  presupuesto?: number
}
```

- `interface Seccion` is deleted.
- `Config` loses `secciones`.
- `Movimiento` loses `seccion`.
- `Activo` loses `seccion`.
- `CONFIG_SEMILLA` keeps its five categories, minus the removed fields, and
  loses `secciones`. **Do not design a new taxonomy here** — task 05 replaces
  the catalog wholesale, and doing both in one diff makes neither reviewable.

`padreId` semantics, which every later task depends on:

- absent ⇒ the category is top-level.
- set ⇒ the category belongs under the category with that id.
- There is no second entity and no second type. A child is an ordinary
  `Categoria` in the same flat `Config.categorias` array; `Movimiento.categoria`
  stores whichever id the user picked, parent or child, and every consumer
  (stats, CSV, search, history, the row renderer) treats them identically.
- Nesting is one level deep. Nothing enforces it at the type level; tasks 05, 06
  and 07 simply never set `padreId` to an id that itself has a `padreId`.
- A `padreId` pointing at a missing or archived category is not an error. Task
  06 renders such a category as top-level. Do not add a validation that rejects
  it, and do not add a repair step that clears it.

## No migration. This is deliberate.

`MIGRATIONS` in `repo.local.ts` stays empty. `performReady` already throws
`RepoError(..., 'schema_mismatch')` when stored data is older than the build and
no migration is registered — that is the wanted behavior: there are no users,
the seed catalog is being replaced anyway, and a migration nobody will ever run
is dead code.

**Do not register `MIGRATIONS[2]`. Do not add a compatibility branch anywhere.**
The user clears local and Drive storage between phase 1 and phase 2
(`docs/pendientes-usuario.md` item 30). Leave `migrateSchema` and the empty
registry exactly as they are — they are existing infrastructure for a future
migration, not something this task introduces or removes.

## Suggested order of work

The contract change breaks the build in dozens of places at once, which makes it
hard to tell a real problem from a knock-on error. Work bottom-up:

1. `schema.ts` — the contract itself.
2. `db.ts` — the Dexie version.
3. `repo.*` — the port and both implementations.
4. `sync/validate.ts`, `sync/engine.ts`, `export/*` — the transport and output.
5. `movimientoStats.ts`, `seedConfig.ts`.
6. `useMovimientoForm.ts`, then the compile-green UI pass.
7. Tests, last, as one sweep.

## Files, and what each one needs

**`src/lib/db.ts`** — add `database.version(5).stores({...})`. Dexie needs every
table listed in each version, so carry `vault`, `config`, `outbox` and
`profileOwner` over unchanged and only change the two that indexed `seccion`:

```
movimientos: 'id, fecha, [fecha+createdAt]'
activos:     'id, fechaActualizacion, [fechaActualizacion+id]'
```

Leave versions 1–4 in place, untouched — a Dexie version history is append-only,
and rewriting an old version's stores changes what an existing database upgrades
through.

**`src/lib/repo.local.ts`** — remove the `seccionField` plumbing from the
generic list builder and the index-selection logic (around lines 169, 218–261).
Any index choice that existed only to serve a `seccion` filter goes with it. The
remaining choice is between `fecha` and `[fecha+createdAt]`; make sure the
fallback path still sorts deterministically.

**`src/lib/repo.ts` / `repo.contract.ts` / `repo.fake.ts`** — `ListQuery` loses
`seccion`. The shared contract suite loses every case that exercised it, and the
fake's config loses `secciones`. `repo.contract.ts` runs against both
implementations, so a case removed there must not linger in either.

**`src/lib/sync/validate.ts`** —

- `isValidMovimiento`: drop the `seccion` check.
- `isValidActivo`: drop the `seccion` check.
- delete `isSeccion`; config validation drops `secciones`.
- `sanitizeCategoria`: drop `seccionId` and `tipo`; accept `padreId` when it is
  a non-empty string, using the same `...(cond ? { k } : {})` spread style the
  function already uses for `icono`/`color`.
- **Fix a real bug while you are in there:** `sanitizeCategoria` destructures
  `id, nombre, seccionId, tipo, presupuesto, icono, color` and never copies
  `archivado`, so every Drive pull silently un-archives every archived category.
  Carry `archivado` through, and pin it with a test.

**`src/lib/export/csv.ts`** — the `seccion` column leaves `CSV_HEADERS` and the
row builder; `seccionNameById` and the `secciones` option go with it. The CSV
still writes resolved category names, never ids. The column count changes, so
check the tests that assert on a full row string, not only the header.

**`src/lib/export/index.ts`** and **`src/lib/sync/engine.ts`** — `CsvTaxonomy`
becomes `Pick<Config, 'categorias'>`; both call sites stop passing `secciones`.
`engine.ts`'s year-close compaction writes that CSV, so its tests cover this.

**`src/lib/movimientoStats.ts`** — `groupKey: 'seccion' | 'categoria'` has one
member left. Remove the parameter and group by `categoria` directly rather than
leaving a single-valued union behind.

**`src/lib/seedConfig.ts`** — `SEED_SECTION_NAMES` is deleted; `buildSeedConfig`
stops mapping section names. `SEED_CATEGORY_NAMES` stays as it is — task 05
rewrites it, and touching it here collides.

**`src/features/movimientos/useMovimientoForm.ts`** — the `seccionId` field, the
line deriving it from the picked category (~line 116), the `applyParsedFields`
branch that resolves it (~133), the validity check requiring it (~143), and both
submit payloads (~152, ~167) lose it. Selecting a category now sets one thing,
not two.

### Compile-green-only pass

Delete what no longer has a backing field, change nothing else. Tasks 06 and 07
reshape these files properly; layout work here will be thrown away and will
collide.

- **`MovimientoFormFields.tsx`** — drop the `secciones` prop and stop forwarding
  it to `CategoryPicker`/`CategoryFormModal`.
- **`CategoryFormModal.tsx`** — drop the `secciones` and `tipo` props, the
  `Sección` `SegmentedControl`, the `seccionId` state, `sortedSecciones`,
  `sectionOptions` and `effectiveTipo`. The duplicate-name check was scoped to
  the section; **scope it to siblings instead** — same `padreId`, with
  `undefined` matching `undefined`. `getMovimientoVisual` still needs a
  `TipoMovimiento` for its fallback; pass `'gasto'` and leave it, task 07 deals
  with that argument.
- **`CategoriesSection.tsx`** — drop the gasto/ingreso `SegmentedControl`,
  `createTipo`, and the section grouping loop; render one flat list of active
  categories, keeping the archived block as it is. Task 07 gives it the
  parent/child shape.
- **`categoryOrder.ts`** — `orderForPicker` keeps only the non-archived filter
  and loses its `tipo` argument. Task 06 deletes the file entirely.
- **`src/routes/Kit.tsx`** — the dev gallery constructs fixtures with the
  removed fields.

### Tests

`rg -l 'seccion|Seccion' src` names every file needing a pass — roughly forty,
mostly fixtures. Rules:

- A fixture loses the field. That is the majority of the work and it is
  mechanical.
- A case that existed **only** to prove section behavior is **deleted**, not
  rewritten to assert something else. A test kept alive by giving it a new
  subject stops describing anything.
- Add the new cases listed under Acceptance below.

## Premortem

- **Most likely failure: a partial sweep that still type-checks.** `seccion` is
  a plain `string` in several places, so removing it from the interface does not
  always break the build — an object literal with an extra key fails, but a
  spread, an index-signature read, or a `Record<string, string>` does not. Run
  `rg -n 'seccion|Seccion' src` as the final step and account for every hit
  rather than trusting `typecheck`.
- **Second: forgetting the Dexie version.** Removing the field from the type
  while leaving `version(4)`'s `seccion` index in place leaves Dexie maintaining
  an index over a property that no longer exists. Silent, and it survives every
  test in the suite.
- **Third: reaching for a migration out of habit.** `AGENTS.md` mandates one for
  a structural change. This task is the recorded exception; task 08 writes it
  into `specs.md` §4 as a rule.
- **Fourth: widening the compile-green pass into a redesign.** `CategoryFormModal`
  and `CategoriesSection` both look like they want restructuring right now. They
  are getting it, in phase 2, from a different agent. Delete and stop.
- **Fifth: dropping `archivado` again.** The bug above exists because a
  destructure-and-rebuild silently omits any field nobody listed. The rewritten
  `sanitizeCategoria` has the same shape and the same trap — the test is what
  keeps it honest.

## Acceptance

- `rg -n 'seccion|Seccion|secciones|seccionId' src` returns nothing outside
  locale strings, which task 08 handles.
- `rg -n 'tipo' src/features/tags src/lib/sync/validate.ts` shows no hit reading
  a **category's** type (`Movimiento.tipo` is untouched and still everywhere).
- A test asserts a Drive-pulled config with `archivado: true` on a category
  keeps it archived.
- A test asserts `sanitizeCategoria` carries `padreId` through and drops an
  unknown extra key.
- A test asserts the exported CSV header row has no `seccion` column, and a row
  test asserts the field count.
- A test asserts `performReady` throws `schema_mismatch` against stored data at
  `schemaVersion: 1` — the no-migration decision is a behavior, so it is pinned.
- A test asserts picking a category sets only `categoriaId` on the form.
- `bun run check` green, output reported verbatim.
