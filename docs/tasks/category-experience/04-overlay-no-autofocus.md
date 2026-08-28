# 04 — An overlay that opens without raising the keyboard

**Branch:** `feat/overlay-no-autofocus` · **Phase 1** · Blocks 06 and 07.

Read `docs/tasks/category-experience/README.md` first.

## Goal

A `BottomSheet` or `CenterModal` can open without moving focus into a text
field, so opening the category sheet or the create-category modal no longer
raises the software keyboard over the content the user came to look at.

## The current behavior

`useOverlay.ts` moves focus on open to

```ts
initialFocus?.current ?? panel?.querySelector(FOCUSABLE_SELECTOR) ?? panel
```

For a sheet whose first focusable happens to be a search input, that is a
`.focus()` call made inside a user gesture — precisely the condition iOS Safari
requires before it will raise the keyboard. The comment above that block states
that iOS rule; it is a fact about a browser engine that no amount of reading
this repo would recover, so it clears `AGENTS.md`'s comment bar and **stays**.

## The change

Add `autoFocus?: boolean`, defaulting to `true`, to `OverlayShellProps` in
`useOverlay.ts`, and thread it through `BottomSheet.tsx` and `CenterModal.tsx`
alongside the props they already forward.

When `autoFocus` is `false`, focus still moves **into the overlay** — onto the
panel element itself, which therefore needs `tabIndex={-1}` — and onto no
control inside it. Focusing the panel is not optional: the focus trap, the
Escape handler and the screen-reader announcement all depend on focus being
inside the overlay. A panel element is not a text field, so nothing appears.

`autoFocus={false}` and `initialFocus` are mutually exclusive by intent:
`initialFocus` names a control to focus, `autoFocus={false}` says to focus none.
If both are passed, **`autoFocus={false}` wins**. Do not grow a union type or a
runtime warning for it — a consumer passing both is a bug in the consumer, and
every call site would pay for the ceremony.

Nothing else about the hook changes: not the trap, not the scroll lock, not the
nesting bookkeeping, not the restore-focus-on-close path, not
`OVERLAY_PANEL_CLASS`, not the backdrop dismissal.

## Scope discipline

These three files have just come out of a run of iOS keyboard and viewport
fixes — see `git log` on them and `specs.md` §10.49. **This task adds one
prop.** Do not refactor the focus block, do not revisit the visual-viewport
handling, do not change the panel classes. If something there looks wrong,
report it to the operator instead of fixing it here; a second agent changing
these files in the same window is how that work gets silently undone.

## Premortem

- **Most likely failure: focusing nothing at all.** Skipping the focus move
  leaves focus on the trigger behind the backdrop. Escape stops working, Tab
  walks the page underneath, and the existing trap tests still pass because they
  assert on the trap, not on where focus started. Focus the panel.
- **Second: a missing `tabIndex={-1}`.** `.focus()` on a plain `div` is a
  silent no-op, and the symptom is identical to the failure above.
- **Third: pinning the new behavior only through a consumer's test.** The prop
  belongs to the shell, so it is tested at the shell — task 06 and 07 will then
  each assert only that they pass it.
- **Fourth: changing the default.** `autoFocus` defaults to `true`. Every
  existing overlay in the app keeps the behavior it has today, and this task
  changes no existing call site.

## Acceptance

Tests in `useOverlay.test.tsx`, `BottomSheet.test.tsx`, `CenterModal.test.tsx`:

- Default (prop unset) still focuses the first focusable control — the existing
  test, unchanged, still passing.
- With `autoFocus={false}` and an `<input>` as the first child, the input is not
  `document.activeElement` and the panel is.
- With `autoFocus={false}`, Escape still closes and Tab still wraps inside the
  overlay.
- With both `autoFocus={false}` and `initialFocus`, the referenced control is
  not focused.
- Closing still restores focus to the trigger, with and without the prop.
- `bun run check` green, output reported verbatim.
