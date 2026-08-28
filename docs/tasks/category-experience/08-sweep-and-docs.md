# 08 — The sweep, and the docs

**Branch:** `chore/category-sweep` · **Phase 3** · Runs alone, after 01–07.

Read `docs/tasks/category-experience/README.md` first.

## Goal

Nothing of the old model or the old picker survives anywhere — not in code, not
in a test, not in a comment, not in a `.md` — and the docs describe the product
that now exists rather than the one that used to.

## Why it runs alone and last

Every earlier task cleans its own area. This one greps the whole tree for what
all eight were supposed to have removed, which is only meaningful once they have
all landed. Running it in parallel with any of them produces a false all-clear.

## The sweep

Run each of these and account for **every** hit — delete it, or write down why
it legitimately stays:

```
rg -n 'seccion|Seccion|secciones|seccionId' .
rg -n 'CategoryPicker|TagPickerSheet|orderForPicker|categoryOrder' .
rg -n 'tags\.picker' .
rg -n 'categoria\.tipo|c\.tipo|createTipo|effectiveTipo' src
rg -n 'subcategor' .
rg -n 'useVisualViewportInset' .
```

Cover `docs/`, `specs.md`, every `README.md`, and every `*.test.ts(x)` — the
brief is explicit that a stale comment or doc line counts as leftover code.
Exclude `.claude/worktrees/` (another branch's checkout is not this branch's
tree) and `docs/ui/*.zip` (a vendored design export is a received artifact, not
our prose).

`Movimiento.tipo` is untouched and is everywhere. The fourth pattern is scoped
to the shapes that read a **category's** type; do not sweep `tipo` broadly.

Then check for what a name-based sweep misses:

- **Unused translation keys.** Every key under `tags.*` and
  `settings.categories.*` in all four locale files must have a call site. Diff
  the key sets across the four files while you are there — an orphan in one
  locale is invisible until someone switches language.
- **Unused exports.** `src/features/tags/index.ts` and
  `src/components/shared/index.ts` must not re-export anything nothing imports.
- **Orphan test files** whose subject was deleted.
- **Comments describing the old model** — a comment mentioning sections, a
  category's type, or the chip carousel, in any file any of the eight tasks
  touched.

## The docs

`specs.md` is the source of truth for behavior and carries **no history** — no
dates, no "was changed to", no mention of this redesign having happened. Present
tense, describing the system as it is. A reader must not be able to tell the
file has a history. Twenty lines per §10 entry, hard.

**§4 — data model.** `Config` no longer has `secciones`; the derived-views list
loses the per-section breakdown; a category is a name, an icon, a color and an
optional `padreId`. Also record the schema rule flatly, with no story: schema
version 2, and no migration path from 1 — the app refuses to boot against
version-1 data.

**§10.3 — the `Repo` port.** `list()`'s query loses `seccion`.

**§10.22 — rewrite it.** It currently specifies the chip carousel, the `tipo`
ordering, and `seccion` being derived from the category. It should now state:

- what a category is — name, icon, color, optional `padreId`, no type, no
  section;
- that `Movimiento.categoria` stores the picked id whatever its level, and every
  consumer treats both levels identically;
- the picker — collapsed field opens a sheet, two levels, flat search across
  both, Custom on both levels inheriting the level's parent, orphans render
  top-level, archived never appear, a fresh open always starts at level 1;
- the icon/color suggestion and the icon ranking — offline, multilingual, a
  reordering and never a filter, a visible pre-selection and never a silent
  apply;
- the create modal — siblings-scoped duplicate check, no autofocus, parent shown
  and never chosen, `upsertCategoria` returning a boolean the modal waits on.

**§10.23 and §10.41** — anything about the movement sheet that names the chip
carousel or the section.

**§11 backlog** — delete anything this feature closed. A done item is deleted,
never annotated as done.

**READMEs:**

- `src/features/tags/README.md` — rewritten; it currently describes
  `CategoryPicker`, `TagPickerSheet` and `categoryOrder`, all deleted.
- `src/components/shared/README.md` — add `PagedGrid`.
- `src/features/settings/README.md`, `src/lib/export/README.md` — sections and
  the CSV column.
- `ARCHITECTURE.md` — only if a top-level folder appeared or disappeared. None
  did, so most likely leave it alone.

**`docs/ui/design-tokens.md` has a live contradiction to fix.** It offers
`gap-[7px]` and `text-[46px]` as acceptable, while `scripts/no-raw-px.sh` — part
of `bun run check` — fails the build on any `[<n>px]` in `src`. The script is
the enforced rule; correct the doc's two examples so an agent reading it does
not write code that cannot land.

**`docs/pendientes-usuario.md`:** item 30 (the data wipe) is closed by the user,
not by you. Item 18 has a diagnosed cause — `crypto.randomUUID()` is `undefined`
outside a secure context, so a LAN `http://` session cannot create a category or
a movement, and `bun run dev:https` is the answer. Record the cause; leave the
item open until the user closes it. Items 20 and 24 also touch this area — report
their state and change nothing.

## What you do not do: compact this folder

`docs/tasks/` holds two- to four-line summaries of shipped work, and
`docs/tasks/category-experience/` will eventually collapse into one short
`category-experience.md`. **That is not your job and it is not yet time.**

Per `AGENTS.md` § "A task's own `.md` has two lives", a brief is replaced by its
minimal form at step 6 of the cycle — after the user has confirmed the feature
works. You run at phase 3, before that confirmation. The nine briefs stay at
full length; the operator compacts them once phase 4 closes.

Leave them alone even if they read as stale to you. Until the user has said the
feature works, they are the only record of what it is supposed to do, and a
failure at phase 4 sends the work back to an implementer who needs them intact.

## Premortem

- **Most likely failure: a sweep that only greps `src/`.** The brief named
  comments and `.md` files specifically. Grep the repo.
- **Second: writing history into `specs.md`.** "The picker was replaced by…" is
  exactly what `AGENTS.md` forbids and is the natural way to write a rewrite.
  Describe the system, not the change.
- **Third: closing a `docs/pendientes-usuario.md` item.** Only the user closes
  those, including item 18, whose cause is known.
- **Fourth: a §10.22 that grows past 20 lines.** If it will not fit, it is two
  entries — the category model and the picker — not one long one.
- **Fifth: collapsing the task folder.** It reads like the natural last step of
  a sweep, it is a different role's step 6, and it happens after a gate you run
  before.

## Acceptance

- Every sweep command returns nothing, or a written justification per hit,
  listed in your report.
- No unused key under `tags.*` or `settings.categories.*`, and the four locale
  files have identical key sets.
- `specs.md` §10.22 is under 20 lines and contains no date, name, or history.
- Every rule in the rewritten §10.22 has at least one test that fails if it is
  broken — your report lists which test covers which rule, and names any rule
  that has none.
- `docs/ui/design-tokens.md` no longer contradicts `scripts/no-raw-px.sh`.
- `bun run check` green, output reported verbatim.
