# 06 — The category field and its sheet

**Branch:** `feat/category-sheet` · **Phase 2** · Needs 01, 02, 04 merged.

Read `docs/tasks/category-experience/README.md` first — the styling contract
there already translates this handoff's pixel values into the project's tokens,
and it settles which parts of the handoff the built shells override.

## Goal

Picking a category on the Add/Edit movement sheet stops being a carousel of
chips and becomes a single `Categoría` row that opens a large bottom sheet: a
searchable, swipeable grid of tiles, two levels deep. The old picker and the old
search sheet are deleted, not kept beside it.

## The design reference, and what to ignore in it

`docs/ui/CategoryFlow (1).zip` → `design_handoff_category_flow/README.md`,
sections 3, 4 and 5. Read it in full. Three things in it are **not** part of
this work:

- The floating "Vista: Etiquetas / Vista: Categorías" pill. It was scaffolding
  for comparing both UIs side by side in the prototype. There is one UI now.
- "The Custom button currently does nothing." It opens the real create modal
  here.
- The sheet's own chrome — backdrop opacity, 30px/44px corner radii, drag
  handle. `BottomSheet` already has all of it, shaped by iOS fixes recorded in
  `specs.md` §10.35 / §10.49 / §10.53. Reuse the shell; style only its contents.

The handoff's mock taxonomy (Comida → …, Transporte → Gasolina/Taxi/…) is
illustrative. The real one is task 05's seed; this task reads whatever is in
`Config.categorias`.

## Delete first

- `src/features/tags/CategoryPicker.tsx` and `CategoryPicker.test.tsx`
- `src/features/tags/TagPickerSheet.tsx` and `TagPickerSheet.test.tsx`
- `src/features/tags/categoryOrder.ts` — after task 01 `orderForPicker` is a
  non-archived filter, and its only two callers are the files above. The new
  sheet filters inline.
- Their entries in `src/features/tags/index.ts`
- Their `tags.picker.*` keys in all four locale files

`TagChip` stays — `CategoryFormModal` and `FilterSheet` still use it.

## Build

### `src/features/tags/CategoryField.tsx`

The collapsed row on the movement sheet. Presentational: it takes the selected
category and an `onOpen`, and owns no state.

- A `Categoría` label above the row: `text-xs font-bold uppercase tracking-wide
text-fg-tertiary`.
- One full-width `<button>`, `rounded-xl border border-border-subtle bg-canvas`,
  at least 44px tall, laid out as a flex row with `gap-2.5`.
- Left: a `size-8.5 rounded-sm` icon swatch using `TINT_CLASSES[tint].badge` —
  the soft 15% tier. The handoff calls out explicitly that a stronger fill read
  as too heavy; `.badge` is that soft tier and it already exists. Icon inside at
  `size-4`.
- Middle: the category name, `text-base font-bold`, `truncate` — it never wraps
  and never widens the row.
- Right: a `ChevronRight` from `lucide-react`, `text-fg-tertiary`.
- Nothing picked: the placeholder copy in `text-fg-tertiary`, and the swatch
  resolved through `getMovimientoVisual(undefined, tipo)`.

### `src/features/tags/CategorySheet.tsx`

A `BottomSheet` with **`autoFocus={false}`** (task 04). Opening it must not
raise the keyboard; the user reaches the search field by tapping it.

State it owns: `parent` (the category currently drilled into, or none), `query`,
and `page`. Everything else is derived — do not cache a filtered list in state.

**Header.** The title, and a close button on the right. The close button draws a
32px `rounded-sm bg-muted` mark inside a **44px hit area** (the handoff's 32×32
is the visual, not the target). At level 2 a back button takes the left slot,
built the same way.

**Search.** Directly under the header. `h-11 rounded-lg border
border-border-subtle bg-surface-sunken`, a `Search` icon inset on the left, the
input padded clear of it. Reuse the existing `Input` from `@/components/ui` the
way `TagPickerSheet` did — that pattern is being deleted, not the component.

**Level 1 — top-level categories.**

- A `PagedGrid` (task 02) at **3 columns × 3 rows**, `gap-2`, dots below.
- The **first cell of page 0 is always Custom**: `rounded-xl border border-dashed
border-border-strong`, transparent fill, a `Plus` icon and the label, all
  `text-fg-tertiary`. It occupies a grid slot, so page 0 shows Custom plus 8
  categories.
- A tile is a `<button rounded-xl>` with `px-1.5 py-2.5`, a `size-9 rounded-md`
  swatch (`.badge`) above a name at `text-xs font-bold`, centered, clamped to
  two lines with `line-clamp-2` so a long name never overflows.
- Tapping a tile that **has children** goes to level 2. Tapping one with **no
  children** selects it and closes the sheet.

**Level 2 — inside one category.**

- Same sheet; the contents swap in place. No second overlay, no route change,
  no nested `BottomSheet`.
- Header: back on the left, the parent's name as the title (`text-xl
font-extrabold`, truncating), close on the right.
- Back returns to level 1 **with the page and the query it had**.
- The same `PagedGrid`. It hides its own dots when everything fits, so short
  child lists need no special case.
- The **first tile is the parent itself**, so the broad category can be picked
  with no child. Mark it as the general one with a treatment that already
  exists — `bg-surface-sunken` on the tile, or `TINT_CLASSES[tint].pill` — and
  **do not invent a new opacity step inline**. If neither reads right, add a
  fifth named tier to `TINT_CLASSES` for every tint at once, which is the only
  file allowed to turn a tint into classes.
- Then a Custom tile, then the children.
- Tapping any tile selects and closes.

**Search.**

- A non-empty query stops the grid showing levels and shows a **flat result set
  across every category, parents and children alike**, paged the same way.
  Without this a child like "Gasolina" is unreachable from level 1, and search
  degrades into a filter over twelve tiles instead of a way to find one of
  sixty.
- Matching goes through `matchesQuery` from `@/features/search/searchMatch` —
  accent- and case-insensitive, the matcher the rest of the app already uses.
  Do not write a second one.
- Every keystroke resets `page` to 0.
- Zero results shows a "create «query»" affordance opening the create modal
  pre-filled with the query — the same copy shape `TagPickerSheet` used, which
  is being deleted, so the key moves under `tags.sheet.*`.
- Clearing the query returns to level 1, page 0.

**Custom / create.**

- Opens `CategoryFormModal` with `initialName` = the current query (or empty)
  and `padreId` = the parent of the current level: `undefined` at level 1, the
  drilled-into category at level 2.
- The handoff puts Custom on level 1 only; it is on **both** levels here,
  because otherwise nothing can ever be added to a group.
- The modal is a `CenterModal` opening over this `BottomSheet` — `useOverlay`
  already handles nesting; do not close this sheet to open it.
- After a successful create, the new category is selected and the sheet closes,
  so the user lands back on the movement sheet with the category they just made
  already chosen. Creating a category from the picker and then having to find it
  is the flow failing at the last step.

**Selection and dismissal.**

- Selecting sets `Movimiento.categoria` to that category's id, parent or child,
  and closes **only this sheet**. The movement sheet underneath stays open with
  everything the user typed.
- Backdrop tap and the close button dismiss without changing the selection.
- The currently selected category is visibly marked wherever it appears.

### `src/features/movimientos/MovimientoFormFields.tsx`

Replace `CategoryPicker` with `CategoryField` plus `CategorySheet`. The
blocked-submit path (`specs.md` §10.48) focuses the first focusable inside
`categorySectionRef`; that is now the field button, which is the right target.
Verify it still works — do not rewrite that effect.

## Rules the implementation must hold

- **Archived categories never appear** — not in the grid, not in level 2, not in
  search results.
- **An orphan renders as top-level.** A category whose `padreId` does not
  resolve to a live, non-archived category is shown as a level-1 tile. Without
  this rule a category silently vanishes from the picker the moment its parent
  is archived, and the movements referencing it become unexplainable.
- **A category is a category.** No subcategory type, no separate list, no
  different behavior on write. The two levels are navigation and nothing else.
- Opening the sheet always starts at level 1, page 0, empty query. A stale
  drill-in from last time is disorienting.
- Deriving the two levels is a `useMemo` over `Config.categorias`, not state.
  Building a `Map<parentId, Categoria[]>` once per render beats a `filter` per
  tile.
- Copy goes through `useTranslation('tags')` under **`tags.sheet.*`, which this
  task owns**. `es.json` first, then the other three at the same path. Do not
  touch `tags.form.*` or `settings.*` — task 07 owns those.
- Tiles are ≥44px targets and the grid never causes horizontal page scroll.

## Premortem

- **Most likely failure: search that only filters the current level.** It type-
  checks, it demos fine against twelve seeded parents, and it makes every child
  unfindable. Write the flat-search test first.
- **Second: the sheet closing the movement sheet with it.** Selecting must
  dismiss one layer, not two. Pin it with a test asserting the movement sheet is
  still mounted after a selection.
- **Third: reintroducing autofocus by accident.** A search `<input>` as the
  panel's first focusable is exactly what task 04 exists to defuse. Pass
  `autoFocus={false}` explicitly and assert the input is not focused on open.
- **Fourth: pagination state surviving a search.** Typing while on page 2 and
  then rendering page 2 of two results is a blank grid.
- **Fifth: rebuilding the sheet chrome.** The handoff's radii and backdrop are
  already in `BottomSheet`. Restyling it here silently reverts shipped iOS
  fixes and will be caught only on a device.
- **Sixth: hand-writing a soft tint.** `bg-chart-2/14` is not a token, will not
  match the swatches elsewhere in the app, and a computed tint class name is
  silently dropped by Tailwind's scanner. Use `TINT_CLASSES`.

## Acceptance

Tests in `CategorySheet.test.tsx` and `CategoryField.test.tsx`, driven with
`@testing-library/user-event`:

- The field shows the placeholder with nothing picked, and the category's name
  once one is picked, truncated rather than wrapped.
- Opening the sheet leaves the search input unfocused.
- 12 top-level categories render Custom plus 8 on page 0, and dots for 2 pages.
- Tapping a parent with children shows the parent as the first tile of level 2;
  back returns to level 1 on the page it came from.
- Tapping a parent with no children selects it and closes the sheet.
- Typing a child's name finds it from level 1; selecting it closes the sheet.
- Typing while on page 1 resets to page 0.
- Clearing the query returns to level 1.
- A category whose parent is archived appears as a top-level tile.
- Archived categories appear nowhere, at either level or in search.
- Selecting closes the sheet and leaves the movement sheet mounted.
- Creating from the Custom tile at level 2 passes that parent's id to the modal.
- `rg -n 'CategoryPicker|TagPickerSheet|orderForPicker' src` returns nothing.
- `rg -n 'tags\.picker' src` returns nothing.
- `bun run check` green, output reported verbatim.
