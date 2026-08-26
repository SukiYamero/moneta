# KuroBello — project rules for AI agents

These rules apply to every coding agent working in this repo (Claude Code,
Codex, Cursor, Gemini CLI, …). `CLAUDE.md` is only a pointer to this file.

## Source of truth: `specs.md`

We follow **spec-driven development**. `specs.md` is the source of truth for
**what the product does** — business logic, what each feature is for, how it is
meant to be implemented, and the traps worth knowing about.

1. **Before building any feature**, read its `specs.md` §10 entry. If the
   feature isn't specified, write it first, in the file's own format:
   **Goal** (one sentence) · **Rules** (3–8 bullets, each one a thing that is a
   bug if violated) · **Implementation** (where it lives, and what isn't
   obvious from reading it) · **Watch out** (only if a real trap exists).
2. If code and `specs.md` disagree, `specs.md` wins — update the code or update
   the spec, never let them silently drift.
3. Changing behavior or data shape ⇒ update the §10 entry in the same change.
4. The backlog lives in §11: genuinely open work only, one or two sentences per
   item. An item that is done gets **deleted**, not annotated as done.

### `specs.md` is not a log, and this is enforced

- **Never write history into it.** No dates, no track or agent names, no batch
  names, no commit hashes, no "was changed to" / "previously" / "take two".
- **Never write process into it.** No review-pass write-ups, no what-a-sweep-
  covered, no CONFIRMED/PLAUSIBLE marks, no who-escalated-what, no lessons
  learned about how the project works.
- **Never write a decisions log.** A decision that still governs behavior is a
  **rule** in its §10 entry, stated flatly with no story. A decision that
  governs nothing is not worth a line.
- **The reasoning goes in the commit message**, which already captures it, is
  free to read, and is attached to the change it explains.
  `git log -S'<term>' -- <path>` finds it later.
- **~20 lines per feature entry, hard.** Longer means it is two features, or it
  is being narrated instead of specified.
- **Present tense, describing the system as it is.** A reader must not be able
  to tell the file has a history.

If you find yourself writing "this was found by" or "the user decided on", stop
— that sentence belongs in your commit or your report to the operator. This
no-history rule applies to every doc in the repo, not just `specs.md` — no
dates, no anecdotes, no process write-ups in a `README.md` or `docs/*.md`
either.

## Open items that need the user — `docs/pendientes-usuario.md`

Some work cannot be done by any agent: design in the Claude Design canvas,
product decisions, and verification that needs a human in a browser (a real
OAuth popup, for one). Those live in
[docs/pendientes-usuario.md](docs/pendientes-usuario.md).

**Read it at the start of a session and ask the user about every open item**,
concretely — "did you get to the PIN unlock screen?", not "any updates?".
**Never mark one done on your own:** an item closes only when the user says it
does. If they don't answer, it stays open and gets asked again next session —
silence is not confirmation. When something new turns out to need the user, add
it there immediately rather than leaving it in a conversation that ends.

## Directory docs (agent-readable maps)

- **Start here: `ARCHITECTURE.md`.** A lightweight index — one line per
  top-level folder, linking to that folder's `README.md` for detail. Read it
  before exploring the tree cold.
- **End of task, update docs.** Besides `specs.md` (decisions/backlog — see
  above), if the task changed what lives in a directory or how it's
  organized, update that directory's `README.md` before calling the task
  done. If the task added/removed a top-level folder, update
  `ARCHITECTURE.md` too.
- **Scoped `README.md`, not one giant architecture doc.** When you do
  meaningful work in a directory that doesn't have a short `README.md` yet
  (what lives here, how the pieces fit together, key entry points — a few
  lines, not an essay), add one. Keep it scoped to that directory only —
  don't try to map the whole project in one file, and don't write one for a
  directory you aren't actually touching. `specs.md` stays the source of
  truth for behavior/decisions; these READMEs are just a structural map, so
  they're small and cheap to keep accurate.
- **Read before you explore.** Before grepping/reading broadly through a
  directory you haven't worked in yet, check for its `README.md` first — it
  should orient you fast enough that you skip rediscovering the area from
  scratch. This is what makes the codebase agentic: a fresh agent (or you,
  in a fresh context) reads the scoped doc instead of the whole tree.

## Architecture and patterns

Read this before exploring the tree. `ARCHITECTURE.md` indexes the folders;
each one's `README.md` has the detail.

### Layers, bottom to top

| Layer                                                        | May import                                        |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `src/lib/` — data contract, storage, stores, auth/lock/sync  | nothing above it                                  |
| `src/components/ui/` — shadcn/Radix primitives               | `lib`                                             |
| `src/components/shared/` — cross-feature composed components | `lib`, `ui`                                       |
| `src/features/<name>/` — one folder per screen/feature       | `lib`, `ui`, `shared`, a sibling feature's barrel |
| `src/routes/` — route pages wired in `src/router.tsx`        | everything below                                  |

`src/lib/` importing `@/components` or `@/features` is a build failure
(`scripts/no-ui-imports-in-lib.sh`, via `bun run lint:units`). The other
directions are not script-enforced but hold everywhere — keep them.

### One write, one read

**Write** — `useMovimientoForm.submit()` → `dataStore.createMovimiento()` →
`runMutation()`: `networkStore.canWrite()` gate → optimistic `set()` →
`getRepo().movimientos.add()` (Dexie, via `repoProvider` → `repo.local.ts`)
→ on success `enqueueOperation()` (`outbox.ts`, a Dexie table on the
profile's own db) → `sync/engine.ts` debounces on `useOutboxStore.dirty` and
`push()`es to Drive. **Nothing writes to Drive directly** — always
outbox, then debounced push.

**Read** — screen mounts → `dataStore.load()` → `getRepo()` (bound once per
boot by `boot.ts`) → `repo.movimientos.list()` → store holds the rows, and
the screen derives totals/breakdowns/ranges with the pure functions in
`movimientoStats.ts`. Drive data only ever arrives through `engine.pull()`
materializing into the same local Dexie db.

### State ownership

Scope is the thing that bites here, so it is named per store:

- **Profile-scoped:** `dataStore` (movimientos/activos/config/status) — reset
  and reloaded by `boot.ts` on every profile rebind. Never treat it as
  global for the app's lifetime.
- **Device-scoped (persisted):** `deviceStore` (markers, Drive decision,
  guest lock), `networkStore`'s `lastOnlineAt` anchor, and the PIN vault
  (`pinLock.ts`, on the default profile database — a device secret, not
  per-profile data).
- **Session-only (in memory):** `authStore`, `lockStore`, `bootStore`,
  `syncStore`, `toastStore`, `landscapeGateStore`, `outboxStore`'s `dirty`
  flag, and the feature-local `movimientoSheetStore`.

Deliberately **not** in a store: derived totals (`movimientoStats.ts`),
category icon/tint resolution (`movimientoView.ts`), and form field state
(local `useState` in `useMovimientoForm.ts`).

### Patterns — copy these files

| Need                     | Copy from                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Feature folder shape     | `src/features/movimientos/` — hook owns state/validation/submit, component is presentational                 |
| Sheet / modal            | `BottomSheet.tsx` or `CenterModal.tsx`, both on `useOverlay.ts` (focus trap, scroll lock, nesting)           |
| Loading + error states   | `HistoryScreen.tsx` with `usePendingDelay()`, plus a `*LoadingState`/`*ErrorState` pair                      |
| UI copy                  | `useTranslation('<ns>')` + `t('key')`; add to `locales/es.json` first, then the other three at the same path |
| Form + validation        | `useMovimientoForm.ts` — errors surface only after a submit attempt                                          |
| Mutation failure         | `dataStore.runMutation()` — optimistic apply, rollback, toast                                                |
| Action failure on screen | `features/auth/errorCopy.ts` — message-keyed table into `role="alert"`, never `error.message` raw            |
| Styles                   | Tailwind utilities from the tokens in `src/styles/index.css`, composed with `cn()`                           |

### Stubs — do not mistake these for finished patterns

- `repo.drive.ts` delegates to `createLocalRepo` and has no production call
  site at all; the real Drive path is outbox → `sync/engine.ts`.
- `Activo` has no outbox variant, so it never pushes to Drive.
- `config` sync is whole-object last-write-wins, no field-level merge.
- `DataSection.tsx`'s "delete stored data" is a disabled stub.
- `/kit` (`routes/Kit.tsx`) is a dev-only gallery, not a real screen.

## Branding vs storage identifiers

- The user-facing app name lives in **`src/lib/branding.ts` (`APP_NAME`)** and is
  provisional — it changes freely and often. Never hardcode the display name
  anywhere else (UI, HTML, manifest all read the constant).
- **Storage identifiers are frozen at the 2026-08-18 baseline** and must NOT
  follow later display renames: the Drive folder `KuroBello`, the dexie DB
  `kurobello`, the lock HKDF info `kurobello-lock-dek`, the package name.
  Renaming any of them orphans user data and requires an explicit migration
  recorded in `specs.md`.

## Data contract: `src/lib/schema.ts`

- **Import the types, never redefine them.** It is the stable contract.
- Domain field names stay in Spanish (`Movimiento`, `seccion`, `monto`…): they are
  the real Drive columns. Do not translate them.
- Structural change (rename/split/delete a field) ⇒ bump `SCHEMA_VERSION` +
  idempotent migration + backup of the JSON data files before running it.
  Additive/optional fields go through `extra` first.
- `monto` always positive (sign from `tipo`); `id` = `crypto.randomUUID()`;
  dates ISO `yyyy-mm-dd`; views are derived, never stored.

## Coding rules

- **TypeScript always.** No `.js`/`.jsx`. `strict` is on; keep it green.
- **Everything in English**: code, identifiers, comments, commit messages, docs,
  spec files. (Exception: the `schema.ts` domain terms above; user-facing UI
  copy is looked up from `src/lib/i18n` — see that folder's `README.md` —
  and is Spanish (`es`) for any string not yet retrofitted into the table.)
- **Pure value → value mappings use a lookup table / `Record`**, never `switch`
  or `if/else` chains.
- **Idiomatic, current code.** Modern standard APIs; avoid deprecated/legacy.
  Prefer native platform APIs (e.g. `crypto.randomUUID`, `Intl.NumberFormat`)
  over extra dependencies.
- **Prefer immutable data patterns.** Don't mutate objects/arrays in place —
  produce new ones (spread, `map`/`filter`/`toSorted`/`with`). Zustand
  updates replace state, they don't mutate it. Predictable state changes are
  easier to reason about and to test.
- **Single source of truth.** Don't store the same value in two places —
  derive it instead of caching a copy that can drift out of sync (this is
  already the rule for the data model: `specs.md` §4 derives totals/history
  from `Movimiento[]`, never stores them; apply the same instinct to
  component/store state).
- **Comments are almost never needed.** A comment survives only if it states a
  fact that does not exist anywhere in this repository and that no amount of
  reading the code, grepping, or checking a type would recover — in practice,
  a fact about the outside world (a browser engine behavior, an OS quirk, a
  third-party API violating its documented contract). It is one line and
  cites nothing — no module headers, no decisions, no past bugs, no
  measurements, no references to `specs.md`, `docs/*`, waves or tracks. If a
  comment doesn't clear that bar, delete it; the reasoning belongs in the
  commit message, findable later with `git log -S`. Self-test every comment
  you are about to write: _could a reader have discovered this by reading
  this repo?_ If yes, don't write it. Where a comment exists because a name
  is vague, **fix the name**.
- **A directive is not a comment.** `// oxlint-disable-next-line …`,
  `// @ts-expect-error`, `// prettier-ignore`, `// v8 ignore` are
  configuration — never sweep them out with the prose.
- **Prose follows the same bar as comments.** A line in a `.md` survives only
  if it states a rule, a mechanism of the product, or a precise location an
  agent needs. No dates, no anecdotes, no decision logs, no process
  write-ups, no "this was found by". The one exception in the whole repo is
  `docs/error-handling.md`, which keeps a section of the bugs this project
  shipped — 2 to 4 lines each, what failed and the rule that came out of it,
  at the end so the rules above it stay dry.
- Use the `@/` alias for imports from `src`.
- **No namespace imports — `import * as React from 'react'` is banned.** Import only
  what you use, named: `import type { ComponentProps } from 'react'`,
  `import { useState } from 'react'`. `React.ComponentProps<'button'>` becomes
  `ComponentProps<'button'>`. The shadcn CLI emits namespace imports as its house
  style, so after `bunx shadcn@latest add <name>` normalize the new component's
  import before committing. Enforced by `import/no-namespace` in
  `.oxlintrc.json` — `bun run lint` fails on any reintroduction.
- **Arrow functions, not `function` declarations.** `const foo = (x: T) => {}`, not `function foo(x: T) {}` — everywhere under `src/`, including nested and test-local helpers. A generic arrow in a `.tsx` file needs the trailing comma (`<T,>(x: T) => x`) or TSX parses `<T>` as JSX. React components keep their name on the `const` (`const Foo = () => {}`, `export default Foo` as a separate statement for a default export) — Fast Refresh and `react/only-export-components` key on the named binding. **Exception:** the `src/components/ui` tree is shadcn-generated (`bunx shadcn@latest add <name>` emits `function`) — leave that directory alone rather than fighting the generator on every add. Enforced by `func-style` in `.oxlintrc.json` (with an override exempting that directory) — `bun run lint` fails on any reintroduced `function` declaration outside it.
- **Modern-syntax rules are enforced, not just requested.** `.oxlintrc.json`
  enables a curated set of `unicorn` rules (prefer `.at()`/`.toSorted()`/
  `.toReversed()`/spread/`structuredClone`/`replaceAll()` and friends,
  DOM-API and async/promise correctness, iterator-callback safety) chosen
  for genuine modernization or error-prevention value — not the plugin's
  full rule set. Deliberately **not** enabled: anything from `unicorn` that
  would rename or reshape the Spanish domain terms `schema.ts` freezes
  (`no-null`, `prevent-abbreviations`, naming/`filename-case` rules), plus
  `no-array-for-each`/`no-array-reduce` (neither method is outdated) and
  pure style preferences with no modernization or correctness payoff
  (`prefer-query-selector`, `no-negated-condition`,
  `consistent-function-scoping`). The `promise`, `node`, and `jsdoc`
  plugins are available but unused — don't assume they're enforced.
  When a rule produces a genuine false positive against this
  codebase (e.g. Dexie's `Collection#reverse()`, which shares a name with
  but isn't `Array#reverse()`), suppress that one site with
  `// oxlint-disable-next-line <rule>` and a comment explaining why —
  don't disable the rule project-wide for one call site's sake.
- **Error handling follows [docs/error-handling.md](docs/error-handling.md).**
  Read it before writing a `try`, adding an error type, or deciding what a
  failure returns. It is binding, not advisory: it fixes the error taxonomy,
  where you may and may not catch, when swallowing is legitimate (and what a
  legitimate swallow must still do), the rule that a failure never returns a
  success-shaped value, and that secrets never enter an error, a log, or the
  DOM. Every rule in it traces to a real bug this codebase actually shipped.

## Security guardrails (see `specs.md` §5, §7)

- No own backend (see §6 for the only exceptions).
- OAuth scopes limited to `drive.file` + `drive.appdata`. **Never** escalate to
  full `drive` or `drive.readonly`.
- The Google Client ID is public and lives in `.env.local` (`VITE_GOOGLE_CLIENT_ID`);
  `.env*` is gitignored. Never commit secrets.
- Sensitive data only in IndexedDB; cached token encrypted with a PIN-derived key.
  Never `localStorage`/`sessionStorage` for it.

## Commands

- `bun run dev` · `bun run build` · `bun run preview`
- `bun run dev:status` — check whether the dev server is up on :5173
  (independent of what an agent last said; run it yourself anytime).
- `bun run typecheck` · `bun run lint` · `bun run format`
- `bun run test` (CI) · `bun run test:watch`
- **`bun run check` = typecheck + lint + test. It must pass before you claim any
  task done, commit, or open a PR.** Report its real output — never claim green
  without running it.

## UI: mobile-first, native-app feel, Tailwind v4 + shadcn/ui

- **Mobile-first, always.** Design and build for a phone screen first; layouts
  target one-handed use. Add larger breakpoints (`sm:`/`md:`/…) only to enhance,
  never as the base. Touch targets ≥ 44px, content clear of the safe-area insets.
- **No desktop design exists yet.** Build for mobile; when tablet/desktop
  breakpoints eventually get their own design, add them as enhancements —
  but don't design the interaction model around a mouse in the meantime (see
  next point). This isn't a license to gold-plate desktop handling now —
  just don't paint yourself into a click-only corner.
- **Relative units, not fixed device sizes.** Never hardcode a mockup
  frame's pixel size (e.g. a `430×844` phone-frame container) as a real
  layout container — the app is fluid. `rem` for type/spacing (respects the
  user's font-size preference); `dvh`/`dvw`, not `vh`/`vw`, for
  viewport-relative sizing — `dvh` accounts for a mobile browser's chrome
  showing/hiding, `vh` doesn't and causes layout jumps. Design against a
  fluid range (~360px min width up through ~430px), not one fixed width;
  Tailwind's `sm`/`md`/`lg` breakpoints are the only fixed numbers that
  matter, and only as the enhancement layer above.
  Enforced by `bun run lint:units` (part of `bun run check`): any arbitrary
  px length in a class — `h-[5px]`, `px-[22px]` — fails the build. Relative
  arbitrary values (`max-h-[88dvh]`) and non-length ones
  (`transition-[left]`, gradients, `data-[...]`) are fine and untouched.
- **`src/lib/` is the bottom layer and may not import `@/components` or
  `@/features`.** The data contract, the stores and the Drive/auth/sync logic
  sit below the UI; when a `src/lib/` module needs a value the UI also uses,
  **move the value down into `src/lib/`** — never import upward. Also enforced
  by `bun run lint:units` (`scripts/no-ui-imports-in-lib.sh`); tests are
  exempt.
- **Touch/swipe is the primary interaction model, not click/hover.** This
  app should feel like a native app, not a website with touch support
  bolted on. Concretely:
  - Use **Pointer Events** (`onPointerDown`/`onPointerMove`/`onPointerUp`),
    not separate mouse/touch handlers — one code path for touch, mouse, and
    pen.
  - Set `touch-action` deliberately on swipeable/draggable elements (e.g.
    `touch-action: pan-y` on a horizontally-swiped row) instead of fighting
    the browser's default gesture handling.
  - Don't build hover-dependent interactions as the only way to reach a
    control — there is no hover on a touchscreen. Hover states are a
    progressive enhancement (`style-hover` in the design → `hover:` in
    Tailwind), never the only path to an action.
  - Screen/sheet transitions use the shared `animate-*` tokens
    (`--animate-sheet-up/pop-in/push-in`, eased with `--ease-ios`) from
    `src/styles/index.css` — this specific curve is what makes it read as
    native rather than a web modal. Never hand-roll a different easing for
    the same kind of transition.
  - Respect `prefers-reduced-motion` — already handled globally in
    `src/styles/index.css`; don't bypass it with an inline animation.
  - `-webkit-tap-highlight-color` is already suppressed globally; don't
    reintroduce the default tap flash on interactive elements.
- Style with Tailwind utility classes; no separate CSS modules unless unavoidable.
- Use shadcn/ui components from `@/components/ui`. Add new ones with
  `bunx shadcn@latest add <name>`. Compose with the `cn()` helper from `@/lib/utils`.
- Icons: `lucide-react` (not Phosphor, even though the design canvas
  prototype uses Phosphor via a CDN — see `docs/ui/design-tokens.md` for
  why). Fonts: Manrope (`@fontsource-variable/manrope`), matching the design.
- **No CDN dependencies, ever — self-host everything.** Fonts, icon sets,
  any library: install it as a real package (`bun add`) and bundle it,
  never load it from a third-party CDN (`unpkg`, `cdnjs`, a Google Fonts
  `<link>`, etc.) at runtime. This app is offline-first (`specs.md` §3); a
  CDN request breaks offline use and adds a third party watching the
  request. This is why Manrope/Lucide won over the design canvas's
  CDN-loaded Phosphor (`docs/ui/design-tokens.md`) — the same rule applies
  to every future dependency, don't re-litigate it case by case.
- **All style values come from tokens in `src/styles/index.css`** — colors,
  radius, font sizes/weights, animation timing all have named tokens there;
  never hand-type a raw hex/px value that duplicates one. See
  `docs/ui/design-tokens.md` for what's tokenized, what's deliberately not
  (one-off layout spacing), and why.

## File and component structure

- **State: zustand.** Shared/global state goes in a store under `src/lib` or
  the owning feature; local-only state stays in React hooks. No Redux. See
  Architecture and patterns above for which store owns what, and at which
  scope.
- **Barrels for public surface, never for the component itself.** A folder that
  exposes multiple things to the outside (e.g. a feature's components/hooks)
  may have an `index.ts` barrel re-exporting them. But a component/view file
  is **never** named `index.tsx` — name it after the component
  (`MovimientosList.tsx`, `LockScreen.tsx`, not `index.tsx`). Multiple
  `index.tsx` tabs open at once are indistinguishable; a named file isn't.
- **Search before you write.** Before adding a function, constant, or
  component, grep for one that already does it (`rg <term> src`) — don't
  duplicate logic that exists under a different name. If a related helper
  file already exists for that domain, add the new helper there; only create
  a new file when nothing fits. Shared helpers live in `src/lib/`;
  feature-only helpers are colocated inside that feature's folder.
- **Keep components small and single-purpose.** A component mixing data
  fetching, business logic, and layout gets split: extract a custom hook for
  state/logic, keep the component focused on markup. Favor composition
  (small components assembled together) over one large component with deep
  conditional branching. This isn't a mandate to pre-split trivial
  components — split when a component actually grows unfocused, not
  preemptively.
- Modern, current APIs and syntax everywhere — this is the same "Idiomatic,
  current code" rule from Coding rules above, applied to architecture-level
  choices too (data fetching, derived state, etc.), not just individual lines.

## Testing

- Vitest + Testing Library. Tests colocated as `*.test.ts(x)`.
- **Interactions use `@testing-library/user-event`, never `fireEvent`** (deprecated style).
- Use TDD for `auth.ts`, `repo.ts`, `pinLock.ts` and any money math — write the
  failing test first, then the implementation.
- **A test earns its place by failing when the product breaks.** Cases that
  differ only in an input value are one `it.each` table, not five `it`s. Do
  not test an implementation detail that could change with no user-visible
  effect, and do not test the framework or the library.
- **Every rule in a `specs.md` §10 entry keeps at least one test that fails
  if it is broken.** That is the coverage bar — not a line percentage.
- The comment rule applies inside tests too. If a comment exists because the
  test's name does not say what it guarantees, **fix the name**.

## Roles and the workflow

Every agent works in one of four roles. The dispatching prompt names the
role; **read `docs/roles/<role>.md` before anything else**, then this file.

| Role        | File                                                   | Output                                 |
| ----------- | ------------------------------------------------------ | -------------------------------------- |
| Operator    | [docs/roles/operator.md](docs/roles/operator.md)       | Dispatches, decides, talks to the user |
| Planner     | [docs/roles/planner.md](docs/roles/planner.md)         | A plan. Never code.                    |
| Implementer | [docs/roles/implementer.md](docs/roles/implementer.md) | Working code on its own branch         |
| Reviewer    | [docs/roles/reviewer.md](docs/roles/reviewer.md)       | Applied fixes plus a report            |

The cycle, which the operator runs:

1. A task exists — the user names it, or it is already written in a `.md`.
   If the feature has no `specs.md` §10 entry, one is written first: Goal,
   Rules, Implementation, short and close to ready to execute.
2. **Implementers** build it, in parallel where the file sets are disjoint.
   Each owns an explicit list of files and touches nothing else.
3. A **reviewer** goes over each finished branch — always, not only when
   something looks wrong.
4. The operator tells the user what to test and **what to expect to see**.
5. The user confirms. Silence is not confirmation; a failure restarts at 2.
6. Only then the docs land: the task's own `.md` is **replaced** by the
   shortest honest statement of what now exists and why it was needed, and
   the `specs.md` §10 entry is consolidated to what the product does.
7. Commit, then merge. A branch waits, unmerged, until 5 and 6 are done.

Documentation is deferred on purpose. Work that has not been confirmed does
not get written down as though it had, and a plan left in place after the
work lands reads as current when it is not.

## Rules every agent follows

Whatever you were asked to do:

- **Question the framing you were given.** A brief is an argument, not a
  description of reality. If the scope is wrong, an assumption is false, or
  the real problem sits next to the one you were pointed at, say so.
  Disagreeing with reasoning is doing the job.
- **Stop rather than guess** when something is cross-cutting or outside what
  you own. Report it and let the operator decide. Never edit another agent's
  files; never silently widen your scope.
- **Fix the shape, not the instance.** Sweep your area for the same shape
  before calling a fix done, and say what the sweep found — including
  "nothing else".
- **Verify before you claim.** Never report a command as passing without
  reading its real output. Mark a finding CONFIRMED only if you traced or
  reproduced it — say which — and PLAUSIBLE otherwise. If you cannot write a
  concrete failure scenario, say so and lower your own confidence.
- **Never pad a report.** Say plainly when something is fine.
- **Name systematic blind spots.** A process that keeps producing a class of
  defect is a bigger finding than the defect.
- **Read this project's rules before applying generic best practice**: this
  file, `specs.md` (the source of truth), `docs/error-handling.md`,
  `ARCHITECTURE.md`, and the per-directory `README.md`s. Check the relevant
  §10 entry before calling something a mistake — what looks wrong may be a
  stated rule. Check whether a relevant skill exists before inventing an
  approach.
- **A design reference disagreeing with existing code is a question, not a
  licence.** The canvas may be older than the code, or the code may have
  moved on deliberately. Ask which is authoritative for that specific
  section, naming what exists and in what form. Divergences already recorded
  in `docs/ui/design-tokens.md` (fluid layout over the fixed frame, Lucide
  over CDN Phosphor, tokens over inline styles, ≥44px targets) are settled —
  proceed.

## Working in parallel

- One agent = one branch = one worktree. **One writer per _checkout_, and it
  binds the operator too:** no commits to `main` while any agent is running,
  and never `git add -A` on a shared checkout — stage named paths. A
  concurrent `git add -A` silently sweeps another agent's uncommitted work
  into an unrelated commit.
- Each task declares the files it owns. When planning parallel work, hunt for
  the file **nobody** owns that two agents will both want — an unassigned
  shared file is how two agents each build their own version of the same
  thing.
- `specs.md` edits from parallel agents are append-only: add your own
  entry, never rewrite someone else's.
- Rebase on `main` before finishing. Remove your worktree once its branch
  merges; prune stale ones at the start of a session (`git worktree list`).
- **A worktree under `.claude/worktrees/` is inside the repo, so it is inside
  every default glob.** `vite.config.ts`'s `test.exclude` and the `lint`
  script's `--ignore-pattern` are what stop an active worktree's tests from
  running as if they were this branch's. A new tool that walks the tree needs
  the same exclusion.
- **Run `bun run check` in the foreground**, as one blocking call. An agent
  that backgrounds it ends its turn with no done gate and the work sits
  unverified.
- **Subagent model/effort:** always Sonnet 5. `normal` for mechanical work
  (search, boilerplate, small scoped edits, running commands); `high` for
  anything correctness-critical or open-ended (architecture, money math,
  auth/lock/crypto, debugging a real bug, review passes).
