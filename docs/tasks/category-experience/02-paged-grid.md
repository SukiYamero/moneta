# 02 — `PagedGrid`, the swipeable paged grid

**Branch:** `feat/paged-grid` · **Phase 1** · Blocks 06 and 07.

Read `docs/tasks/category-experience/README.md` first — in particular the
styling contract, which fixes the dot sizes and the 44px rule this component
has to honor.

## Goal

One shared component that lays items out in a fixed grid, splits them into
pages, moves between pages with a horizontal swipe, and shows iOS-style page
dots. Two different screens consume it — the category sheet's tile grid and the
category form's icon grid — so it is built once, here, before either exists.

## Why it is its own task

It is the file both later tasks would otherwise invent independently, in two
incompatible shapes. Nothing else about it needs a separate branch.

## Where

`src/components/shared/PagedGrid.tsx`, exported from
`src/components/shared/index.ts`, tested in `PagedGrid.test.tsx`. It knows
nothing about categories or icons and imports nothing from `@/features`.

## API

```ts
export interface PagedGridProps<T> {
  items: readonly T[]
  columns: number
  rows: number
  page: number
  onPageChange: (page: number) => void
  renderItem: (item: T, index: number) => ReactNode
  itemKey: (item: T, index: number) => string
  ariaLabel: string
  className?: string
}
```

A generic arrow in a `.tsx` file needs the trailing comma — `<T,>(props:
PagedGridProps<T>) => …` — or TSX parses `<T>` as JSX.

**The page is controlled, not internal state.** Both consumers reset it from the
outside — the sheet on every keystroke and every level change, the form whenever
the icon ranking changes — and a component owning its own page cannot be reset
without a `key` remount hack that destroys the transition.

- Page size is `columns * rows`.
- Page count is `Math.max(1, Math.ceil(items.length / pageSize))`.
- When `items` shrinks so that `page` is out of range, clamp to the last page
  **and call `onPageChange`**, so the parent's state cannot drift from what is
  rendered. Do it in an effect, not during render.
- The grid is `grid` with `grid-cols-{columns}` — but Tailwind's scanner only
  sees literal class names, so a computed `grid-cols-${columns}` will not exist
  in the build. Set the template through an inline `style` with
  `gridTemplateColumns: repeat(columns, minmax(0, 1fr))`, which is a real
  runtime value and not a class.
- The last page may be short. Do not pad it with empty cells — a half-filled
  final page is correct and expected.

## Behavior

**Swipe.** Pointer Events only (`onPointerDown` / `Move` / `Up` / `Cancel`) —
one path for touch, mouse and pen, per `AGENTS.md`. Use `setPointerCapture` on
down and release it on up, so a drag that leaves the element still completes.
Track a single `pointerId`; ignore a second concurrent pointer rather than
interleaving two drags.

- Horizontal travel of **40px or more** commits: drag left → next page, drag
  right → previous.
- Below the threshold the track springs back to the current page.
- At the first or last page the gesture is inert. **No wrapping** — the last
  page does not swipe back to the first.
- If the initial movement is more vertical than horizontal, abandon the gesture
  entirely and let the scroll through. A grid inside a scrolling sheet that
  captures every drag makes the sheet feel stuck, and that is the single most
  likely way this component ruins the feature it exists for.

**`touch-action: pan-y`** on the track, so the browser handles vertical
scrolling natively instead of being fought in JS.

**Dots.** Below the grid, centered, `gap-1.5`.

- Inactive `size-1.5`; active `h-1.5 w-4.5`. The active dot **widens**; it does
  not change shape, color scheme, or opacity.
- **Do not write arbitrary pixel classes.** `w-[18px]` fails
  `scripts/no-raw-px.sh`, which is part of `bun run check`. Tailwind's scale
  already gives 6px and 18px.
- Each dot is a real `<button>` that jumps to its page, with a **hit area of at
  least 44px** and the 6px mark drawn inside. The visible dot is not the touch
  target. Give the button `aria-label` naming the page and `aria-current="true"`
  on the active one.
- Dots are not rendered at all when there is a single page.
- **No previous/next arrows.** The dots and the swipe are the whole paging UI —
  the handoff is explicit about this and it is not a gap to fill in.

**A right-edge fade** hints at a further page: a gradient overlay on the grid's
right edge, `pointer-events-none`, from transparent to the surface color,
rendered only when a next page exists.

**Keyboard.** `ArrowLeft` / `ArrowRight` on the focused track move pages. Touch
is the primary model, but a swipe-only control has no keyboard path at all, and
`AGENTS.md` forbids leaving an action reachable by one input only.

**Motion.** The track translates by `-page * 100%`. The transition uses
`var(--ease-ios)` from `src/styles/index.css` — the same curve as every other
sheet transition; do not hand-roll another easing. `prefers-reduced-motion` is
already handled globally in that stylesheet, so a `transition-transform` picks
the override up for free — do not add an inline `animation` that bypasses it.
While a drag is in progress the track follows the finger with no transition;
the transition is re-enabled on release.

**Accessibility.** The track carries `role="group"` and the given `aria-label`.
Items on pages that are not visible **must not be reachable by tab** — render
only the current page's items. Rendering all pages and hiding them with
`overflow` leaves a keyboard user tabbing into invisible controls.

## Premortem

- **Most likely failure: the grid eats the sheet's vertical scroll.** Covered
  twice above (the axis check and `touch-action`) because it is the failure that
  will not show up in a unit test and will make the whole feature feel broken on
  a phone. Write the vertical-drag test.
- **Second: dots as 6px targets.** They read as correct in a test and are
  unusable with a thumb. The 44px hit area is a rule, not a nicety.
- **Third: an uncontrolled page.** If the component keeps its own page state
  "for convenience", task 06's search and task 07's live re-ranking both break,
  and only on a real device.
- **Fourth: a computed `grid-cols-N` class.** It silently produces no columns in
  a production build while working in dev. Use the inline `style`.
- **Fifth: `pointermove` without capture.** The drag dies the moment the finger
  crosses the component's edge, which is most drags near a page boundary.

## Acceptance

Tests in `PagedGrid.test.tsx`, driving with `@testing-library/user-event`:

- 20 items at 3×3 render 9 on page 0 and produce 3 dots.
- A pointer drag of 60px left calls `onPageChange(1)`; a drag of 20px calls
  nothing.
- A drag that is mostly vertical calls nothing and does not `preventDefault`.
- At the last page, a further left drag calls nothing.
- Tapping the third dot calls `onPageChange(2)`.
- 5 items at 3×3 render no dots.
- Shrinking `items` from 20 to 4 while `page` is 2 calls `onPageChange(0)`.
- Items on a non-current page are not in the tab order.
- `ArrowRight` on the track calls `onPageChange(1)`.
- Each dot button's accessible name identifies its page.
- `bun run check` green, output reported verbatim.
