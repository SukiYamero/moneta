# 05 — The seeded category catalog

**Branch:** `feat/seed-catalog` · **Phase 2** · Needs 01 and 03 merged.

Read `docs/tasks/category-experience/README.md` first.

## Goal

A new profile starts with a two-level catalog broad enough that most people find
their category instead of creating one — twelve top-level categories, each with
three to five children, localized in the four supported locales.

## Why a real catalog matters here

The two-level sheet and its pagination only make sense against a catalog with
depth and volume. Five seed categories leave the second level empty and the page
dots hidden, so the feature ships untested by its own default data — the first
person to see pagination working would be the user, on a phone, after merge.

## Where

- `src/lib/schema.ts` — `CONFIG_SEMILLA.categorias`.
- `src/lib/seedConfig.ts` — `SEED_CATEGORY_NAMES`, keyed by category id, one map
  per locale (`es`, `es-AR`, `en`, `pt-BR`).

Nothing else. If the catalog appears to need a change anywhere else, stop and
report it — that would mean the contract from task 01 is wrong, which is a
different conversation.

## Shape

- Top-level categories carry no `padreId`. Children carry `padreId` set to their
  parent's id. **One level of nesting only** — a child never becomes a parent.
- Every category, parent and child, carries an explicit `icono` and `color`,
  both drawn from what task 03 shipped.
- **A child's `color` equals its parent's color, written out explicitly.** It is
  a stored value the user can change later, not a derived one. Do **not** add a
  parent-lookup step to `getMovimientoVisual` — that would change a resolution
  chain (`specs.md` §10.22: category's own `icono`/`color`, then the `tipo`
  fallback, and nothing else) that every movement-rendering screen depends on,
  and it would need the whole category list threaded to every call site.
- Ids are stable forever: `cat_<slug>`, lowercase, underscore-separated, Spanish
  slug to match the five that already exist (`cat_sueldo`, `cat_ventas`, …).
  Renaming an id orphans every stored movement pointing at it.
- Reuse the five existing ids where the catalog covers the same idea, rather
  than minting a parallel one — `cat_sueldo`, `cat_ventas`, `cat_impuestos`,
  `cat_servicios`, `cat_caja_menor`.

## The catalog

Twelve top-level categories. The names below are the Spanish ones; the other
three locales translate the same ids. Children are indicative — swap an
individual child if task 03's allowlist clearly suggests a better fit — but keep
the parent set and roughly the count per parent.

| Parent           | Children                                           |
| ---------------- | -------------------------------------------------- |
| Comida           | Supermercado · Restaurante · Café · Domicilios     |
| Transporte       | Gasolina · Taxi · Transporte público · Parqueadero |
| Hogar            | Arriendo · Servicios · Internet · Reparaciones     |
| Compras          | Ropa · Electrónica · Muebles · Varios              |
| Salud            | Médico · Farmacia · Gimnasio · Seguro              |
| Ocio             | Cine · Streaming · Salidas · Juegos                |
| Educación        | Cursos · Libros · Colegio                          |
| Cuidado personal | Peluquería · Belleza · Lavandería                  |
| Mascotas         | Comida de mascota · Veterinario                    |
| Viajes           | Vuelos · Hospedaje · Paseos                        |
| Finanzas         | Impuestos · Comisiones · Ahorro · Deuda            |
| Ingresos         | Sueldo · Freelance · Ventas · Regalo · Reembolso   |

Twelve parents means the sheet's first level fills two pages once the Custom
tile takes a slot — which is the point: pagination is exercised by the default
data, not only by a fixture.

Assign tints so that adjacent tiles in the grid do not repeat a color; the grid
is read as a block of twelve, and six blue tiles in a row make it unscannable.
Vary across the nine `ICON_AVATAR_TINTS`.

## Localization

The four maps are the whole localization surface. Seed names are localized
**once, at seed time**, and are ordinary user data afterwards — they are never
translated again at render time (`specs.md` §10.22). A user who switches
language later keeps the names they already have, and that is correct.

Type the maps so a missing or extra id is a compile error rather than a silent
fallback to the Spanish name — `Record<SupportedLocale, Record<CategoriaSeedId,
string>>` with `CategoriaSeedId` derived from the seed array, or an equivalent.
If typing it that tightly fights the existing shape, pin it with a test instead;
do not leave it unguarded.

`es-AR` is not a copy of `es` — it exists because regional wording differs
(`Caja menor` / `Caja chica` is already in the file). Apply the same judgment to
new names: `Arriendo` / `Alquiler`, `Parqueadero` / `Estacionamiento`,
`Domicilios` / `Delivery`.

## Premortem

- **Most likely failure: four locale maps drifting.** ~60 ids across four files
  is exactly where one id gets a typo in one of them and silently falls back.
  The type or the test above is not optional.
- **Second: a `padreId` pointing at an id that does not exist**, from a rename
  mid-edit. Pin it.
- **Third: reaching for an icon key task 03 did not add.** `satisfies` catches
  it at build time; do not add the key here — that file belongs to task 03, and
  adding it would collide.
- **Fourth: quietly deleting a pre-existing id** because the new catalog covers
  it better. Movements in the user's test data point at those five ids. Reuse
  them.
- **Fifth: writing the catalog as one 300-line literal.** It will be read and
  edited by people. Group parents and their children together in the array, in
  the order they should appear.

## Acceptance

- A test asserts every `padreId` in `CONFIG_SEMILLA.categorias` resolves to a
  category in the same array that itself has no `padreId`.
- A test asserts the four locale name maps have identical key sets, and that
  every seeded category id appears in all of them.
- A test asserts every seeded category has an `icono` and a `color`, that every
  `icono` is in `CATEGORY_ICON_KEYS`, and that each child's `color` equals its
  parent's.
- A test asserts no two seeded ids collide.
- `buildSeedConfig('CO', 'en')` returns English names; `buildSeedConfig('AR',
'es-AR')` returns the Argentine variants where they differ.
- A test asserts the top-level count is greater than 9, so the picker's
  pagination is exercised by the seed itself.
- `bun run check` green, output reported verbatim.
