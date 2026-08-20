# src/features/tags

The category picker and taxonomy — spec: `specs.md` §10.22.

- `categoryIcons.ts` — the curated `CATEGORY_ICONS` allowlist (`CategoryIconKey`
  → `LucideIcon`). This is the only set a `Categoria.icono` value may resolve
  to; an unknown key (older/newer build, hand-edited Drive file) falls back
  rather than throwing, via `movimientoView.ts`'s `getMovimientoVisual`.

The taxonomy-reference migration underneath the picker (`Movimiento.categoria`
holding `Categoria.id`, resolved for display via
`src/components/shared/movimientoView.ts`'s `resolveCategoria`) lives outside
this folder — see `specs.md` §10.22 Decision 1 for what changed and where.
