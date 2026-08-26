# Add sheet — the description field becomes a textarea

**Goal.** `nota` gets room to be read and written: a two-line textarea instead
of a one-line input, with a character limit that allows roughly three lines of
text.

**Why.** The field is an `<input>` capped at 40 characters — about one line.
A description that does not fit is a description nobody writes.

## What exists today

- `MovimientoFormFields.tsx` renders `TextField` (a single-line `Input`) with
  `NOTE_MAX_LENGTH = 40`, behind the `showMore` toggle.
- `TextField.tsx` is typed on `ComponentProps<'input'>`, so it cannot become
  multiline without changing its contract for every other caller.
- `MovimientoRow.tsx:42` uses `movimiento.nota` as the row's **primary label**,
  falling back to the category name. A taller note must not break that row.
- `export/csv.ts` already quotes any field containing `\r\n` — export is safe
  either way.

## Subtasks

**1. `TextAreaField` in `src/components/shared/`.**
Receives: the same shape as `TextField` (label, value, onChange, error,
maxLength, disabled) but typed on `ComponentProps<'textarea'>`.
Delivers: a labelled textarea, `rows={2}`, `resize-none`, wired to the same
`Label` and the same `role="alert"` error node as `TextField`.
Must not touch: `TextField.tsx` — it stays the single-line primitive, and
every existing caller keeps working untouched.
_Most likely failure:_ the textarea drops the `min-h-11` touch-target floor or
the `text-base` size that stops iOS zooming the page on focus. Both belong on
the textarea explicitly, not inherited by accident.

**2. Wire it into the form.**
Receives: `nota`, `onNotaChange` — unchanged props.
Delivers: `MovimientoFormFields.tsx` renders `TextAreaField`;
`NOTE_MAX_LENGTH` becomes 140.
Must not touch: `DateChipPicker` and its props (another task owns that file).
_Most likely failure:_ `maxLength` on a textarea silently truncates a paste,
which reads as data loss. Show a character counter once the field is past
roughly three quarters of the limit, so the ceiling is visible before it bites.

**3. Keep `nota` a single logical line.**
Delivers: `useMovimientoForm.ts` collapses any run of whitespace — newlines
included — into single spaces on submit, alongside the existing `trim()`.
`MovimientoRow.tsx` truncates its label to one line.
_Most likely failure:_ only doing one of the two. The collapse handles what
this form writes; the truncation also covers rows already in the database and
anything a future writer produces.

## Tests

Twelve test files mention `nota`, but nearly all only use it as a fixture
(`nota: 'Internet'`). **Leave those alone.** In scope are only the tests that
assert on the field's own behaviour, plus a new `TextAreaField.test.tsx`.
`TextField.test.tsx` stays untouched — that primitive does not change.

New coverage: the field shows two rows; typing past the limit is refused; the
counter appears before the limit; a note containing a newline is stored as one
line; a movement row renders a long note on a single line.

Every test must fail if its rule is broken — a case that differs only in an
input value belongs in an `it.each` table.

## Acceptance

- The field shows two lines of text without scrolling, and scrolls within
  itself past that.
- Typing past 140 characters is impossible, and the counter appears before
  the limit is reached.
- A note containing a newline is stored as one line and renders on one line in
  a movement row.
- `bun run check` green.

Both tasks in this folder can run in parallel: this one owns
`MovimientoFormFields.tsx`, the date-picker task must not touch it.
