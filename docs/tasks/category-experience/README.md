# Category selection & creation

Nine tasks that replace how a category is picked and created. Read this file
before opening any of them: it holds the phase gates, the file ownership, the
styling contract every task builds against, and the rules that stop two agents
from building the same thing twice.

Each task is a separate branch and a separate agent. `AGENTS.md` and
`docs/roles/implementer.md` bind as usual; this file only adds what is specific
to this feature.

## What changes, in one paragraph

A movement's category stops being a carousel of chips and becomes a single
`Categoría` row that opens a large bottom sheet: a searchable, swipeable
3-column grid of category tiles, 9 per page, with page dots. A tile that has
children drills into a second level (the parent itself plus its children); a
tile with no children is selected outright. Underneath, `Categoria` loses `tipo`
and `seccionId`, the `Seccion` concept leaves the data model entirely, and a
single optional `padreId` gives the two levels their shape. Creating a category
keeps the existing modal, minus the controls that no longer have a meaning, plus
an icon grid that pages and reorders itself around the name being typed.

## Phases and gates

A phase's tasks may run in parallel. **A phase does not start until every task
of the previous phase is merged into `main` and `bun run check` is green there.**

### Phase 1 — foundations (4 agents in parallel)

| Task                                                         | Branch                      |
| ------------------------------------------------------------ | --------------------------- |
| [01 — category contract](01-category-contract.md)            | `feat/category-contract`    |
| [02 — paged grid](02-paged-grid.md)                          | `feat/paged-grid`           |
| [03 — icon allowlist](03-icon-allowlist.md)                  | `feat/icon-allowlist`       |
| [04 — overlay autofocus opt-out](04-overlay-no-autofocus.md) | `feat/overlay-no-autofocus` |

**Gate: all four merged, `bun run check` green on `main`.**

### Phase 1.5 — the user wipes stored data (no agent)

Task 01 bumps `SCHEMA_VERSION` to 2 and deliberately registers no migration, so
the app refuses to boot against version-1 data. Before anyone runs the app
again, the user clears local and Drive storage — the steps are item 30 in
`docs/pendientes-usuario.md`.

**Gate: the user confirms the app boots and shows the seeded categories.**

### Phase 2 — the experience (3 agents in parallel)

| Task                                        | Branch                |
| ------------------------------------------- | --------------------- |
| [05 — seed catalog](05-seed-catalog.md)     | `feat/seed-catalog`   |
| [06 — category sheet](06-category-sheet.md) | `feat/category-sheet` |
| [07 — category form](07-category-form.md)   | `feat/category-form`  |

**Gate: all three merged, `bun run check` green on `main`.**

### Phase 3 — the sweep (1 agent, alone)

| Task                                        | Branch                 |
| ------------------------------------------- | ---------------------- |
| [08 — sweep and docs](08-sweep-and-docs.md) | `chore/category-sweep` |

Runs alone on purpose: it greps the whole tree for what the previous eight tasks
were supposed to have removed, and that is only meaningful once they all landed.

### Phase 4 — the user confirms, then the briefs are compacted

The operator tells the user what to test and what to expect. Nothing is
documented as done, and nothing merges to `main` as finished work, before the
user says it works.

**These nine files stay at full length until then.** They are briefs for agents
that have none of this conversation, so their length is the point — see
`AGENTS.md` § "A task's own `.md` has two lives". Only once the user confirms
does the operator replace the folder with a single short
`docs/tasks/category-experience.md` saying what now exists and why it was
needed. No task in phases 1–3 trims its own brief, and none trims another's.

## File ownership

One writer per file. If a task needs to change a file another task owns, it
stops and reports to the operator instead of editing it.

| File                                                                            | Owner                                  |
| ------------------------------------------------------------------------------- | -------------------------------------- |
| `src/lib/schema.ts`                                                             | 01, then 05                            |
| `src/lib/db.ts`, `repo.local.ts`, `repo.ts`, `repo.contract.ts`, `repo.fake.ts` | 01                                     |
| `src/lib/sync/validate.ts`, `sync/engine.ts`                                    | 01                                     |
| `src/lib/export/csv.ts`, `export/index.ts`                                      | 01                                     |
| `src/lib/movimientoStats.ts`                                                    | 01                                     |
| `src/lib/seedConfig.ts`                                                         | 01, then 05                            |
| `src/features/movimientos/useMovimientoForm.ts`                                 | 01                                     |
| `src/components/shared/PagedGrid.tsx`                                           | 02                                     |
| `src/lib/categoryIconKeys.ts`, `src/components/shared/categoryIcons.ts`         | 03                                     |
| `src/features/tags/categorySuggest.ts`                                          | 03, then 07                            |
| `src/components/shared/useOverlay.ts`, `BottomSheet.tsx`, `CenterModal.tsx`     | 04                                     |
| `src/components/shared/tintClasses.ts`                                          | 06 (only if a new tier is unavoidable) |
| `src/features/tags/CategoryField.tsx`, `CategorySheet.tsx`, `index.ts`          | 06                                     |
| `src/features/movimientos/MovimientoFormFields.tsx`                             | 01 (compile-green only), then 06       |
| `src/features/tags/CategoryFormModal.tsx`                                       | 01 (compile-green only), then 07       |
| `src/features/settings/CategoriesSection.tsx`                                   | 01 (compile-green only), then 07       |
| every `.md` under `docs/`, `specs.md`, every `README.md`                        | 08                                     |

**Task 01 is allowed a minimal pass over UI files it does not otherwise own,**
for the single purpose of keeping `bun run check` green after the contract
changes. It deletes the controls whose backing field is gone and nothing else —
no layout work, no new behavior. Tasks 06 and 07 reshape those files afterwards.

### The two shared files, and how they are split

1. **`src/lib/i18n/locales/{es,es-AR,en,pt-BR}.json`** — tasks 06 and 07 both
   add copy. Ownership is by key subtree: **06 owns `tags.sheet.*`**, **07 owns
   `tags.form.*` and `settings.categories.*`**. Neither touches the other's
   subtree, and neither reformats the file. A key is added to `es.json` first,
   then to the other three at the same path (`AGENTS.md`). Copy is Spanish for
   `es`/`es-AR`; the `en` and `pt-BR` entries are real translations, not the
   Spanish string copied across.
2. **`src/features/tags/categorySuggest.ts`** — task 03 adds keyword entries,
   task 07 adds the ranking function. They run in different phases, so 03 is
   always finished before 07 opens the file.

## The styling contract

Every task that renders anything builds against this. It is not a summary of
`docs/ui/design-tokens.md` — it is the specific subset this feature needs, with
the handoff's raw pixel values already translated into the tokens that exist.
**Never hand-type a value that has a token.**

### The handoff's numbers, translated

`docs/ui/CategoryFlow (1).zip` quotes CSS pixels. Do not copy them. Use:

| Handoff says                           | Use                                                                 |
| -------------------------------------- | ------------------------------------------------------------------- |
| tile radius `16px`                     | `rounded-xl`                                                        |
| icon-swatch radius `12px` / `11px`     | `rounded-md` / `rounded-sm`                                         |
| search field radius `14px`             | `rounded-lg`                                                        |
| icon swatch `36×36` / `34×34`          | `size-9` / `size-8.5`                                               |
| icon inside a swatch, `16px`           | `size-4`                                                            |
| grid gap `8px`                         | `gap-2`                                                             |
| tile label `11px / 700`                | `text-xs font-bold`                                                 |
| section label `11.5px / 700` uppercase | `text-xs font-bold uppercase tracking-wide`                         |
| modal title `17px / 800`               | `text-xl font-extrabold`                                            |
| field label / value `14px / 700`       | `text-base font-bold`                                               |
| search field height `44px`             | `h-11`                                                              |
| page dot `6px` / active `18px`         | `size-1.5` / `h-1.5 w-4.5`                                          |
| muted text                             | `text-fg-tertiary`, or `text-fg-faint` for the faintest tier        |
| sheet surface, page background         | `bg-card`, `bg-canvas`, `bg-surface-sunken`                         |
| `1px border`                           | `border border-border-subtle` (or `border-strong` for a dashed CTA) |

The full radius scale is `rounded-xs` 8 · `sm` 10 · `md` 12 · `lg` 14 · `xl` 16
· `2xl` 18 · `3xl` 20 · `4xl` 26 · `5xl` 30. The full type scale is `text-2xs`
10 · `xs` 11 · `sm` 12 · `ms` 13 · `base` 14 · `md` 15 · `lg` 16 · `xl` 17 ·
`2xl` 18 (and up). Both live in `src/styles/index.css`.

### Arbitrary pixel values are a build failure

`scripts/no-raw-px.sh` (part of `bun run check` via `lint:units`) greps `src`
for `[<n>px]` in any class and fails the build. `h-[18px]`, `gap-[7px]`,
`text-[46px]` all fail. Relative arbitrary values (`max-h-[88dvh]`) and
non-length ones (`transition-[left]`, `ease-[var(--ease-ios)]`) are fine.

Note that `docs/ui/design-tokens.md` still offers `gap-[7px]` and `text-[46px]`
as acceptable examples. **The script wins**; task 08 reconciles the doc. If a
value genuinely has no scale step, pick the nearest step rather than reaching
for an arbitrary value — Tailwind v4's spacing scale accepts half steps
(`size-8.5` = 34px, `w-4.5` = 18px), which covers almost every odd number here.

### Category color

`TINT_CLASSES` in `src/components/shared/tintClasses.ts` is the only place a
tint becomes classes. Each `IconAvatarTint` has four ready tiers:

- `.icon` — the foreground color alone
- `.fill` — a solid background
- `.badge` — a **soft** background at 15% plus the matching text color
- `.pill` — soft background, matching border, matching text

The handoff's "soft tint at ~14% opacity, never a solid or dark fill" is
`.badge`. Use it for every icon swatch, in the collapsed field and in every
grid tile. **Do not hand-write `bg-chart-1/14`**, and do not compose a tint
class name at runtime — the comment at the top of that file explains why
(Tailwind's static scanner only sees literal strings, so a computed class name
is silently absent from the build).

If a genuinely new tier is unavoidable, add it to `TINT_CLASSES` as a fifth
named tier used by every tint, never inline at one call site.

### Touch, motion, layout

- **≥44px touch targets, always** — this overrides the handoff, which draws a
  32px close button and 6px dots. Draw the 32px mark or the 6px dot inside a
  44px hit area. `AGENTS.md` records this divergence as settled; do not ask.
- Interaction is **Pointer Events**, one path for touch/mouse/pen. Set
  `touch-action` deliberately on anything draggable. No hover-only affordance.
- Transitions use `var(--ease-ios)`; sheet/pop/push animations use the
  `--animate-*` tokens. `prefers-reduced-motion` is handled globally in
  `src/styles/index.css` — never bypass it with an inline animation.
- Fluid layout: `rem` for type and spacing, `dvh`/`dvw` never `vh`/`vw`. Target
  360–430px width. No fixed device frame.
- `-webkit-tap-highlight-color` is already suppressed globally; do not
  reintroduce a tap flash.
- Compose classes with `cn()` from `@/lib/utils`.

### The shells are already built — do not restyle them

The handoff specifies the sheet's backdrop opacity, its 30px/44px corner radii
and its drag handle. All of that already exists in `BottomSheet.tsx` /
`CenterModal.tsx` / `useOverlay.ts`, shaped by a run of iOS fixes recorded in
`specs.md` §10.35, §10.49 and §10.53. **Reuse the shells as they are.** This is
the recorded "a design reference disagreeing with built code is a question, not
a licence" case, and it is already answered: the code wins for the shell, the
handoff wins for the contents.

## Rules that bind every task here

- **Nothing of the old flow may survive.** No unreferenced file, no dead export,
  no unused translation key, no test asserting a behavior that no longer exists,
  and no comment or `.md` line naming something that was deleted. Each task
  ships its own area clean; task 08 verifies the whole.
- **No compatibility shims.** There are no users and no production data. Do not
  write a migration, a fallback branch, or an "if the old field is present"
  check for any field this feature removes. That code would never run, and
  unreachable code is worse than no code.
- **A comment survives only under `AGENTS.md`'s bar** — a fact about the outside
  world that no amount of reading this repo would recover. Reasoning goes in the
  commit message.
- **Arrow functions, named exports, no namespace imports, `@/` alias, lookup
  tables instead of `switch`.** All enforced by `bun run lint`.
- **`bun run check` runs in the foreground and passes before a task is done.**
  Report its real output.
- **Every rule written into a `specs.md` §10 entry keeps at least one test that
  fails if the rule is broken.** Task 08 writes the entries; tasks 01–07 write
  the tests as they go.

## Verifying on a real device

`bun run dev:https` serves over HTTPS with a self-signed certificate
(`@vitejs/plugin-basic-ssl`), and it is the only way to test from a phone.
`crypto.randomUUID()` — which both `dataStore.createMovimiento` and
`CategoryFormModal` call to mint an id — is `undefined` outside a secure
context, so a plain `http://<lan-ip>:5173` session cannot create a movement or a
category at all. A "saving does nothing" report from a LAN address is that, not
a form bug.
