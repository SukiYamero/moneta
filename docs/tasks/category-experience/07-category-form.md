# 07 — Creating a category

**Branch:** `feat/category-form` · **Phase 2** · Needs 01, 02, 03, 04 merged.

Read `docs/tasks/category-experience/README.md` first — the styling contract and
the secure-context note at the end of it both matter here.

## Goal

The create/edit category modal asks only for what a category still is — a name,
an icon, a color — opens without raising the keyboard, shows far more icons
through a paged grid, and reorders that grid around the name being typed. When
it was opened from inside a group, it says so, quietly.

The modal is kept, not redesigned. The new picker deliberately brings no
creation flow of its own, so this is the one that stays.

## Where

- `src/features/tags/CategoryFormModal.tsx`
- `src/features/settings/CategoriesSection.tsx`
- `src/features/tags/categorySuggest.ts` — the ranking function only; task 03
  finished with the keyword table in phase 1.
- Locale keys under **`tags.form.*` and `settings.categories.*`, which this task
  owns**. `tags.sheet.*` belongs to task 06.

## What changes

### No autofocus

Drop `initialFocus={nameInputRef}` and pass `autoFocus={false}` (task 04) to the
`CenterModal`. Opening the modal must not raise the software keyboard: the user
is there to look at icons and colors as much as to type, and a keyboard covering
two thirds of the modal on open is what the whole overlay/keyboard work in
`specs.md` §10.49 has been fighting.

The `nameInputRef` may become unused. If it does, delete it — a ref nobody reads
is dead code.

### The parent, communicated subtly

New prop `padreId?: string`, plus whatever the modal needs to resolve it to a
`Categoria` (it already receives `categorias`).

When set, the modal shows one quiet line under the title: the parent's icon at
`size-4` in its tint, then the parent's name, in `text-sm text-fg-tertiary`. Not
a control, not a selector, not a breadcrumb bar — one line that answers "where
is this going to end up".

- Creating with a `padreId` defaults the **color to the parent's color**, which
  the user can still change. That matches how task 05 colors the seeded
  children, and it makes a new child look like it belongs without a rule
  anywhere else in the app.
- The saved `Categoria` carries `padreId` through unchanged.
- Editing an existing category never changes its `padreId` here. There is no
  reparenting UI, and adding one is out of scope.

### The duplicate-name check

Task 01 rescoped it from the section to the **siblings** — categories sharing
the same `padreId`, with `undefined` matching `undefined`. Confirm that is what
actually shipped, and update the copy: `tags.form.nameDuplicateError` still says
"en esta sección", which now names a concept that does not exist.

### The icon grid pages, and ranks

Render the icon grid through `PagedGrid` (task 02) at **5 columns × 4 rows** —
20 icons a page, so ~70 keys fill four pages.

Add to `categorySuggest.ts`:

```ts
export const rankCategoryIcons = (query: string): CategoryIconKey[]
```

- It reuses `CATEGORY_CONCEPTS` and the same normalized whole-word matching
  `suggestCategoryVisual` already performs — extract the shared word-matching
  step rather than writing a second matcher beside it.
- Icons of every concept the query matches come first, in match order; every
  remaining key follows in its declared order.
- The result is always the **full** key list, stable, with no duplicates. It is
  a reordering, never a filter — a user who typed "gym" must still be able to
  page to the car icon.
- **An empty query, or one matching nothing, returns the declared order
  unchanged.** No match must never scramble the grid.
- Keep the multilingual keyword bags. Do not rewrite the matcher to be
  English-only: the UI is Spanish, the user types both, and `gimnasio` / `gym` /
  `academia` already resolve to one concept today.

Wiring:

- The ranking recomputes as the name is typed — `useMemo` on the trimmed name.
- **The grid resets to page 0 whenever the order changes.** Otherwise the best
  match lands on a page the user is not looking at, which is the entire feature
  failing silently while every unit test passes.
- The user's explicit pick always wins over the ranking. Typing more after
  picking an icon reorders the grid but never changes the selection, and the
  selected icon stays visibly selected wherever it now sits.
- The existing `suggestCategoryVisual` pre-selection on open is unchanged — it
  is a visible pre-selection, never a silent apply (`specs.md` §10.22).

### The settings list gets the two-level shape

`CategoriesSection.tsx` lost its section grouping in task 01 and is currently a
flat list. Group it by parent instead: each top-level category, then its
children indented under it, then the archived block as it is today. Children of
an archived or missing parent list at top level, matching task 06's rule — the
two screens must not disagree about where a category lives.

Check that nothing there still assumes a category has a type: the gasto/ingreso
`SegmentedControl` and `createTipo` were removed in task 01, but the create
button, the archive/delete flows and their copy may still be worded around it.

## What this task does not own

**`docs/pendientes-usuario.md` item 18 — "saving a category does not work" — is
not a form bug.** `CategoryFormModal.tsx:107` and `dataStore.ts:114` both call
`crypto.randomUUID()`, which is `undefined` outside a secure context, so on a
plain `http://<lan-ip>:5173` session from a phone neither a category nor a
movement can be created at all. `bun run dev:https` is the fix and it is already
in `package.json`. **Do not "fix" it by loosening validation, by adding a UUID
fallback, or by touching the save path.** Note it in your report; the user
closes the item.

Item 24 (the modal could not be closed on iOS) is a viewport/overlay matter, not
this file's. Item 20's create-category-name-field half is addressed by the
`autoFocus={false}` change above — mention it, do not edit that file.

## Premortem

- **Most likely failure: re-ranking on every keystroke without resetting the
  page.** Everything looks right in a unit test and the feature is invisible in
  the product.
- **Second: rebuilding the icon grid instead of using `PagedGrid`.** A second
  swipe/dots implementation is exactly what task 02 exists to prevent, and the
  two will drift.
- **Third: turning the parent line into a control.** The ask was to communicate
  the group subtly. A parent selector is a feature nobody asked for and needs
  reparenting rules that do not exist.
- **Fourth: making the ranking a filter.** Hiding non-matching icons feels
  helpful and makes 65 of 70 icons unreachable the moment the user types.
- **Fifth: a `ranked.indexOf(key)` inside the render of every tile.** With ~70
  keys re-ranked on every keystroke that is quadratic for no reason; rank once
  into an array and render it.
- **Sixth: chasing item 18.** It is a secure-context problem, already diagnosed.
  Time spent reproducing it is time not spent on the task.

## Acceptance

Tests in `CategoryFormModal.test.tsx`, `CategoriesSection.test.tsx` and
`categorySuggest.test.ts`:

- Opening the modal leaves the name input unfocused and the panel focused.
- With `padreId` set, the parent's name renders; without it, nothing extra does.
- Creating with `padreId` saves a `Categoria` carrying that `padreId` and
  defaults its color to the parent's.
- Two categories with the same name under different parents both save; two under
  the same parent are blocked with the inline error, and the error copy names no
  section.
- `rankCategoryIcons('gimnasio')` and `rankCategoryIcons('gym')` both put the
  gym icon first.
- `rankCategoryIcons('')` and `rankCategoryIcons('xyzzy')` return the declared
  order exactly.
- Every `rankCategoryIcons` call returns all keys exactly once — assert against
  a sorted copy of `CATEGORY_ICON_KEYS`.
- Typing a name that changes the ranking resets the icon grid to page 0.
- Picking an icon and then typing more keeps the picked icon selected.
- The settings list renders children under their parent, and an orphan at top
  level.
- `bun run check` green, output reported verbatim.
