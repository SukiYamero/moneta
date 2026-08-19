# Track U — report

Form primitives + confirm dialog for Wave 4 (`specs.md` §10.14).

## What was built

- **`src/components/ui/input.tsx` / `label.tsx`** — added via
  `bunx shadcn@latest add input label`, then normalised: the generator's
  `import * as React` became a named `import type { ComponentProps }`
  (`import/no-namespace`); the `function` declarations were left as-is
  (`src/components/ui` is the one `func-style` exemption). No arbitrary-px
  classes to fix — the generated classes are all theme-scale Tailwind
  utilities. `package.json`/`bun.lock` were untouched: `radix-ui` and
  `class-variance-authority` were already dependencies, so the add needed no
  new packages.
- **`src/components/shared/TextField.tsx`** (+test) — labelled text input:
  `Label htmlFor` ↔ `Input id` association (auto via `useId()` unless the
  caller passes one), `aria-invalid`/`aria-describedby` wired to an optional
  `error` string rendered as a `role="alert"` node, 44px touch target
  (`min-h-11`, matching the existing `Toggle`/`InfoButton`/`LockSettings`
  convention rather than inventing a new one). Extends
  `ComponentProps<'input'>` (minus `id`/`value`/`onChange`) so native
  attributes (`placeholder`, `maxLength`, `autoComplete`, …) forward for
  free — the same spread pattern `button.tsx` already uses.
- **`src/components/shared/AmountField.tsx`** (+test) — locale-aware amount
  input. Exports two pure functions plus the component:
  - `parseAmount(raw, locale)` — reads the locale's decimal/group
    separator characters from `Intl.NumberFormat(locale).formatToParts`,
    strips the group separator, normalises the decimal separator to `.`,
    then `Number()`s it. Returns `undefined` (never `NaN`) for empty,
    negative, or malformed input — `Movimiento.monto` is always positive
    (schema.ts), so a negative parse is treated as invalid, not sign-stripped.
  - `formatAmountForInput(value, locale)` — the inverse, for prefilling an
    edit form from a stored `monto`.
  - `AmountField` itself is a controlled **string** field (`value`/
    `onChange` are the raw typed text, not a controlled number) — this is
    what makes locale-grouped input round-trip correctly; a controlled
    `number` would fight the user mid-keystroke on partial input like
    `"12,"`. `type="text"` + `inputMode="decimal"`, never `type="number"`
    (native spinners, and `valueAsNumber` ignores locale entirely, per
    §2.2(5) of the plan). `aria-invalid` is true both for a caller-supplied
    `error` and for text that fails `parseAmount` under the given
    `locale`, with no error text required for the second case — the caller
    only owns copy for its own business-rule messages.
- **`src/components/shared/ConfirmDialog.tsx`** (+test) — built on
  `CenterModal`/`useOverlay`, adds no overlay logic of its own. Generates
  its own `titleId` (`useId()`) and passes it as `labelledBy`, so callers
  need no aria props. Confirm/Cancel use `Button`'s `destructive`/
  `secondary` variants at `min-h-11` (the same override `LockSettings.tsx`
  already uses to push `Button`'s own `h-8`/`h-9` sizes up to the 44px
  touch target) — replaces the `/kit` delete demo's hand-rolled `<button
className="bg-danger ...">` pair, which is now gone.
- **`/kit` entries** — new "TextField" and "AmountField" sections; the
  delete-confirm nested-overlay demo now renders `<ConfirmDialog>` instead
  of a raw `CenterModal` + two buttons; the "Sheet con initialFocus" demo's
  raw `<input type="number">` now renders `<AmountField>` with the same
  `initialFocus` ref, so it demonstrates the real component instead of the
  prior-art placeholder the audit called out.

## Decisions made (for specs.md §11)

- **`AmountField` is a controlled string, not a controlled number.** The
  component owns no internal buffer/effect syncing a `number` prop back to
  display text — that's the classic controlled-numeric-input footgun (what
  do you show for `"12,"` mid-typing?) and it would have made this the
  "over-engineering taken too far" case the plan warns about. The trade
  is that a caller prefilling an edit form calls the exported
  `formatAmountForInput(monto, locale)` itself to seed the initial string.
  This still satisfies §10.14's "parse through the locale, never
  hand-rolled" requirement — the parsing logic lives in one place
  (`parseAmount`), exported, not reimplemented per call site.
- **`ConfirmDialog` has no `pending`/`confirming` prop.** §10.9 Tier 3 says
  a write-in-flight busy state lives on the pressed control, and a delete
  confirmation is exactly that kind of control — but nothing in Wave 3
  calls `ConfirmDialog` yet, so any busy-state prop today would be exactly
  the "defaulted parameter nobody passes" shape Wave 2's review flagged as
  its most expensive finding. Left for Wave 4's first real caller (Track F
  or H) to add once there's an actual async `onConfirm` to disable against
  — flagged below as an open question, not decided unilaterally here.
- **`ConfirmDialog` hardcodes `destructive`/`secondary` variants**, no
  `confirmVariant` prop. `specs.md` §10.14's stated purpose is delete
  confirmations specifically (as does §10.15's "deleting a profile ...
  needs a confirm"); both known Wave 4 callers (Track F movement delete,
  Track H group delete) are deletes. Adding a variant prop before a second
  variant has a caller is the same over-engineering shape as above.
- **Chose not to extract a shared `FieldError` sub-component** for
  `TextField`/`AmountField`'s near-identical error-paragraph markup (~6
  lines each). Two callers sharing a trivial, unlikely-to-drift JSX
  fragment didn't clear the bar for a third exported component — more
  surface than the duplication cost justifies. If a third field type
  arrives with the same shape, that's the signal to extract it.

## Backlog / deferred (for specs.md §12)

- **`ConfirmDialog` busy-state.** Wave 4's first async delete caller should
  either wrap `ConfirmDialog` (disable the trigger before opening it, or
  hold `onConfirm` behind its own pending guard) or extend
  `ConfirmDialog` with a real `pending` prop once there's a real call site
  to shape it against. Noted here rather than guessed at now.
- **`button.tsx`'s own sizes are all under the 44px touch-target rule**
  (`default` h-8/32px, `lg` h-9/36px — nothing in the `size` variant scale
  reaches `h-11`). Every current caller (`LockSettings.tsx`, and now
  `ConfirmDialog`) works around it with a `className="min-h-11"` override
  at each call site rather than the component providing a compliant size.
  Out of my blast radius (`src/components/ui` is additive-only for this
  track, and `button.tsx` is used outside my scope), but it's a real,
  repeating gap worth a `specs.md` §12 line for whoever next touches
  `button.tsx`.

## Doc lines to add (`src/components/shared/README.md`, operator-owned)

Insert alphabetically among the existing entries (after `AmountField`'s
natural spot — before `BottomNav.tsx`, and again before `CenterModal.tsx`
for `ConfirmDialog`, and near `Toast.tsx`/before `Toggle.tsx` for
`TextField` to keep the file's existing rough ordering):

```markdown
- `AmountField.tsx` — locale-aware amount input for `Movimiento.monto`
  (always positive; sign comes from `tipo`). `type="text"` +
  `inputMode="decimal"`, never `type="number"` (native spinners, and
  `valueAsNumber` ignores locale entirely). A controlled **string** field,
  not a controlled number — `parseAmount(raw, locale)` and its inverse
  `formatAmountForInput(value, locale)` are exported pure functions built
  on `Intl.NumberFormat(locale).formatToParts` to read the locale's actual
  decimal/group separators (`es-CO` groups `.`/decimals `,`; `en-US` the
  reverse) — never a hand-rolled parser. `aria-invalid` is true both for a
  caller-supplied `error` and for text `parseAmount` can't parse under the
  given `locale`, so malformed input is flagged even with no `error` copy
  passed. Required `locale` (BCP-47 from `useLocaleFormatting()`), same
  no-default convention as `MovimientoRow`/`formatMonto`. Accepts `ref`.
- `ConfirmDialog.tsx` — delete-style confirmation built on `CenterModal`;
  generates its own `labelledBy` from `title` via `useId()`, so callers
  pass no aria props. Confirm/Cancel use `Button`'s `destructive`/
  `secondary` variants at `min-h-11` (button.tsx's own sizes don't reach
  the 44px touch target — this is the same per-call-site override
  `LockSettings.tsx` already uses). Takes all copy as props — adds no
  locale keys of its own. Replaces the `/kit` gallery's former hand-rolled
  delete-confirm demo. Accepts `ref`.
- `TextField.tsx` — labelled text input: `Label`/`Input` association via
  `useId()` (or a caller-supplied `id`), `aria-invalid`/`aria-describedby`
  wired to an optional `error` rendered as `role="alert"`, 44px touch
  target. Forwards native `ComponentProps<'input'>` (minus `id`/`value`/
  `onChange`) so `placeholder`/`maxLength`/`autoComplete`/etc. pass through
  without being individually re-declared. Accepts `ref`.
```

And extend the barrel-file line at the bottom to mention the three new
exports (`AmountField`, `ConfirmDialog`, `TextField`, plus `parseAmount`/
`formatAmountForInput`) if that line gets touched again — not urgent, the
barrel itself is self-documenting.

## Spec deltas (where this brief or §10.x turned out wrong)

None. §10.14 and the plan's Track U brief matched what was actually needed;
no assumption in either turned out false during implementation.

## Open questions for the operator

1. Should `ConfirmDialog` get a `pending`/busy prop now, or wait for Wave
   4's first real async caller to shape it? I deferred it (see Backlog) on
   the "no speculative prop nobody passes" rule, but flagging it since
   §10.9 Tier 3 is already-decided behavior, not a guess — the operator may
   want it pre-built rather than re-derived per Wave-4 track.
2. `button.tsx`'s size scale not reaching 44px is a repeating workaround
   (three call sites now do the same `className="min-h-11"` override).
   Worth a dedicated §12 backlog item for someone to either add a
   compliant size variant or confirm the override-per-call-site pattern is
   the intended permanent shape.

## `bun run check` output (pasted, real)

```
$ bun run typecheck && bun run lint && bun run lint:units && bun run test
$ tsc -b --noEmit
$ oxlint
src/components/shared/AmountField.tsx:30:14: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
src/components/shared/AmountField.tsx:42:14: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
src/components/ui/button.tsx:67:18: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
$ sh scripts/no-raw-px.sh
$ vitest run

 RUN  v4.1.9 /Users/sukiyamero/Desktop/programacion/web/moneta-worktrees/wave3-u

 Test Files  78 passed (78)
      Tests  726 passed (726)
   Start at  14:55:47
   Duration  26.74s (transform 3.42s, setup 24.84s, import 85.65s, tests 32.81s, environment 82.46s)
```

The two `AmountField.tsx` warnings are the same shape as the pre-existing
`button.tsx` one (`buttonVariants`/`cva`-style exported non-component
values alongside a component in the same file) — not a regression, and
this codebase already carries that pattern.

**A flaky, unrelated pre-existing test found while verifying:**
`src/router.kitError.test.tsx` (owned by nobody in this stage — it tests
`router.tsx`'s lazy-chunk-failure fallback via a full `vi.mock` that throws
before `@/routes/Kit` is ever really imported) intermittently timed out at
its hardcoded 5000ms limit when run as part of the full suite. Traced,
not just suspected: with my changes fully stashed (`git stash -u`), two
consecutive full-suite runs passed clean at 700/700; with my changes
restored, three consecutive full-suite runs failed on exactly this test,
and `ps aux` showed several sibling Wave-3 worktrees (`wave3-v` and the
main checkout) running their own `vitest` workers concurrently on the same
machine at the time. In isolation (`vitest run src/router.kitError.test.tsx`)
it passed instantly every time, including under that same load. This is
CPU-contention flakiness in a hardcoded-timeout test, not something my
diff can cause — the mock replaces the whole `@/routes/Kit` module before
it's ever parsed, so my content changes to that file never execute in this
test's path. Reporting it as a process-level finding (per AGENTS.md "name
systematic blind spots"): running multiple agents' full test suites in
parallel on one machine can starve any test with a hardcoded timeout,
independent of which track is actually correct.
