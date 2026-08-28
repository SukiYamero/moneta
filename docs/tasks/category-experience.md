# Category selection & creation

A movement's category is no longer a carousel of chips — it's a single
`Categoría` row that opens a two-level bottom sheet: a searchable, swipeable
3-column grid of category tiles, drilling into a category's children when it
has any. `Categoria` dropped `tipo` and `seccionId`; the `Seccion` concept is
gone from the data model, replaced by a single optional `padreId`. Creating a
category kept the existing modal, with a name-driven icon/color suggestion
and a paged icon grid.

Rules and implementation: `specs.md` §10.22, §10.22.1, §10.8;
`src/features/tags/README.md`.
