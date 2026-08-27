# Add sheet — the description field

The movement note is a two-row `TextAreaField` capped at 180 characters, with a
character counter that appears at 75% of the limit so a paste is never silently
truncated without warning. `submit()` collapses whitespace runs, newlines
included, so a note is stored as one logical line; `MovimientoRow` renders it on
one line regardless of what a row already in the database contains.

`TextField` is untouched — it stays the single-line primitive.

Rules and implementation: `specs.md` §10.52.
