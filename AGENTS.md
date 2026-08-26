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
4. The backlog lives in §12: genuinely open work only, one or two sentences per
   item. An item that is done gets **deleted**, not annotated as done.

### `specs.md` is not a log, and this is enforced

The file reached 13,000 lines because every track wrote its reasoning into it.
It is now ~1,100. Keeping it there is a rule, not an aspiration:

- **Never write history into it.** No dates, no track or agent names, no batch
  names, no commit hashes, no "was changed to" / "previously" / "take two".
- **Never write process into it.** No review-pass write-ups, no what-a-sweep-
  covered, no CONFIRMED/PLAUSIBLE marks, no who-escalated-what, no lessons
  learned about how the project works.
- **Never write a decisions log.** A decision that still governs behavior is a
  **rule** in its §10 entry, stated flatly with no story. A decision that
  governs nothing is not worth a line. §11 is a stub kept only because old code
  comments cite it.
- **The reasoning goes in the commit message**, which already captures it, is
  free to read, and is attached to the change it explains.
  `git log -S'<term>' -- <path>` finds it later.
- **~20 lines per feature entry, hard.** Longer means it is two features, or it
  is being narrated instead of specified.
- **Present tense, describing the system as it is.** A reader must not be able
  to tell the file has a history.

If you find yourself writing "this was found by" or "the user decided on", stop
— that sentence belongs in your commit or your report to the operator.

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
- **Comments only when truly necessary** — explain the _why_ (tradeoff, workaround),
  never the _what_. No conversational/changelog/restating comments.
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
  plugins are available but unused — see `specs.md` §11, 2026-08-19, for
  why. When a rule produces a genuine false positive against this
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
  exempt. This exists because the inversion appeared twice in Wave 4 alone
  from two independent tracks — see `specs.md` §11, 2026-08-20.
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
  why). Fonts: Manrope (`@fontsource-variable/manrope`), matching the
  design — supersedes the earlier Geist/Nova-preset default, see `specs.md`
  §11, 2026-08-18.
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

## State: zustand

Shared/global state goes in zustand stores under `src/lib` or the owning feature.
Local-only state stays in React hooks. No Redux.

## Architecture & file naming

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

## How every agent works (reviewers, implementers, researchers)

These apply to any agent on this project, whatever it was asked to do.

- **Fix the shape, not the instance.** When you fix a defect, sweep your whole
  area for other occurrences of the _same shape_ before calling it done, and
  report what the sweep found — including "nothing else" when that is the
  honest answer. This is the single most expensive lesson this project has
  learned: an unguarded storage read was fixed in one function while its twin
  sat unfixed in a sibling function, and a read-modify-write race was fixed in
  one module and never ported to the identical pattern in another. Both
  shipped past a fully green test suite and were later found as CRITICAL.
- **Question the framing you were given.** Whoever dispatched you has blind
  spots, and a brief is an argument, not a specification of reality. If the
  task is scoped wrongly, if a stated assumption is false, or if the real
  problem is next to the one you were pointed at, say so. Disagreeing with
  the operator, with reasoning, is doing the job — not a failure to follow
  instructions.
- **Name systematic blind spots.** If you notice that a _process_ keeps
  producing a class of defect, report the process problem, not just the
  defect. That finding is usually worth more than the bug that revealed it.
- **Never pad a report.** A short, honest "three real issues, here they are"
  beats a long one inflated to look thorough. Say plainly when something is
  fine. Padding hides the real findings among the filler.
- **Separate what you proved from what you reasoned.** Mark a finding
  CONFIRMED only if you traced it precisely or reproduced it — say which —
  and PLAUSIBLE otherwise. If you cannot write a concrete failure scenario
  (specific inputs or actions leading to a specific bad outcome), say so and
  lower your own confidence.
- **Verify before you claim.** Never report a command as passing without
  running it and reading its real output. A test you did not watch fail
  proves nothing — write it first, see it fail for the right reason, then
  fix.
- **A design reference disagreeing with existing code is a question, not a
  licence.** Being handed a Claude Design link does not mean "overwrite what
  is there": the canvas section may be older than the code, or the code may
  have moved on deliberately. Implementing the canvas faithfully can silently
  revert real work; assuming the code wins can silently drop a change the user
  wanted. **Ask which is authoritative for that specific section**, naming what
  already exists and in what form. The exception, so this doesn't fire
  constantly: divergences already recorded in `docs/ui/design-tokens.md` or
  `specs.md` §11 (fluid layout over the fixed frame, Lucide over CDN Phosphor,
  tokens over inline styles, ≥44px targets) are settled decisions — proceed.
  Full rule in `docs/ui/implementation-plan.md`.
- **Read the project's own rules before applying generic best practice.**
  This file, `specs.md` (the source of truth), `docs/error-handling.md`,
  `docs/waves.md`, `ARCHITECTURE.md`, and the per-directory `README.md`s.
  Check the relevant `specs.md` §10 entry before calling something a
  mistake — what looks wrong may be a stated rule. Check whether a relevant skill exists before
  inventing an approach.
- **Stop rather than guess** when something is genuinely cross-cutting or
  outside what you own. Report it and let the operator decide; do not edit
  another track's files, and do not silently widen your scope.

## Review protocol (operator-owned, user-mandated 2026-08-19)

This is not optional and not per-wave — it applies to every track, in every
session, and the operator/orchestrator owns running it.

1. **Every track gets its own review subagent, scoped to that track's
   section alone.** Dispatched after the track's work is verified and
   merged, so a reviewer never files findings against code a later stage
   rewrites.
2. **The reviewer looks for four things, not one:** bugs, **redundancy**,
   **optimization**, and **better approaches** than the one taken. A review
   that only hunts correctness bugs is doing a quarter of the job — the
   most valuable Wave 2 findings were a duplicated color table and a
   defaulted parameter nobody passed, neither of which is a bug in the
   "it crashes" sense.
3. **The reviewer applies what it finds** when the fix is clearly correct
   and in scope. It does not merely report a list for someone else.
4. **Anything delicate — a judgment call, a product decision, a
   cross-cutting change, or scope widening — is escalated to the operator,
   who decides.** The reviewer says what it would do and why, and stops.
5. **A reviewer reports its findings to the operator; it does not write them
   into `specs.md`.** A review pass is process, and process is exactly what
   that file may not contain. What a review may add is a **rule** it
   established, folded into the relevant §10 entry in the file's own format —
   never a section describing the review itself. Everything else goes in the
   commit message and the report.
6. **A track's doc lines land in the same commit as its merge, never in a
   batch at the end.** A track hands its `README.md` edits to the operator
   (§1.2 of a wave plan makes those files operator-owned so parallel tracks
   don't clobber each other) — and those drafts **rot**. Measured, not
   feared: five sets sat unapplied at once on 2026-08-19 and two were
   already wrong about the code they described, because later commits moved
   it. A README that reads as trustworthy and is quietly wrong is worse than
   one that was never written. If a draft is applied late anyway, **verify
   every line against the current code first** rather than pasting it.
7. **At the end of the whole batch, the operator launches a general review**
   across everything that landed, deliberately looking for what the
   per-track reviewers structurally _could not_ see: drift between tracks,
   the same concept solved two ways in two folders, a rule applied in one
   place and not its twin, dead seams left between tracks, and consistency
   of the shared surface. Per-track reviewers are blind to the seams
   between tracks by construction — this pass exists for exactly that.

## Working in parallel (multiple agents)

- One agent = one branch = one worktree. Never two writers on the same branch.
- **The rule is one writer per _checkout_, not per branch, and it binds the
  operator too.** A reviewer that applies fixes is a writer; so is the
  operator applying a doc line. Concretely: **review passes get worktrees,
  and while any agent is running, the operator does not commit to `main`** —
  operator edits queue until every agent has returned. Never `git add -A` on
  a shared checkout; stage named paths.
  Measured, not feared. On 2026-08-25 the operator ran three review passes
  directly on the `main` checkout while committing to it, and `git add -A`
  swept a reviewer's uncommitted functional fix into an unrelated docs
  commit (`specs.md` §10.49.2). Two of the three reviewers had to work
  around it on their own and one refused to write its findings at all. The
  lesson was then written down — **and the operator repeated it in the same
  session**, committing to `main` while the cross-track review was live. A
  rule that had just been recorded as the lesson was broken by the role
  that recorded it, minutes later. That is why this is phrased as a
  mechanical constraint ("no commits to `main` while an agent runs") and
  not as advice to be careful.
- Each task declares the files it owns (see the wave/track plan in
  `docs/waves.md`); do not edit files owned by another in-flight track.
- `specs.md` edits from parallel tracks are **append-only**: add your own §10
  subsection or §11/§12 lines, never rewrite someone else's. Same rule for
  `docs/waves.md`'s worktree log.
- Merge to `main` early and often (trunk-based, no `develop`); rebase your
  worktree on `main` before finishing.
- Every agent in every track follows the Coding rules comment policy above
  strictly: add a comment only when it is genuinely necessary to explain a
  non-obvious _why_. No exceptions per-track.
- **Log every worktree** you create in `docs/waves.md` "Worktree log" the
  moment you create it (path, branch, status `active`). When your track's
  branch merges to `main`, remove the worktree (`git worktree remove <path>`)
  and delete its row — don't leave it lying around "just in case".
  At the start of any parallel session, check the log against
  `git worktree list` and prune anything stale (merged-but-not-removed, or
  present on disk but missing/finished in the log).
- **A worktree under `.claude/worktrees/` is inside the repo, so it is inside
  every default glob.** Neither `bun run test` nor `bun run lint` excluded it
  until this bit: one active worktree turned the suite from 158 test
  files into 472, running each in-flight branch's tests against `main`'s own
  `node_modules` and failing 657 of them. `vite.config.ts`'s `test.exclude`
  and the `lint` script's `--ignore-pattern` are what keep the done-gate
  honest — a new tool that walks the tree needs the same exclusion, or
  `bun run check` starts reporting another branch's state as this one's.
- **When drafting a wave's file-ownership table, hunt for the _unowned_ file
  two tracks will both want.** Assigning every file a track will edit is not
  enough: the expensive case is a shared file assigned to nobody, which each
  track then correctly routes around by building its own copy of the thing.
  Wave 3 stage 1 left `deviceStore.ts` unassigned and got three
  device-scoped Dexie databases where one would do — no track was wrong, the
  plan was. Ask explicitly which unassigned file two tracks in the same stage
  will each want for different reasons, and resolve it at planning time
  (`specs.md` §11, 2026-08-19).
- **Subagent model/effort:** always Sonnet 5, never downgrade to another
  model. Only two effort tiers — pick per task, don't default to `high` out
  of habit:
  - `normal` — straightforward/mechanical work: search/lookup, boilerplate,
    small well-scoped edits, running commands and reporting results.
  - `high` — anything correctness-critical or open-ended: architecture or
    design decisions, money math, auth/lock/crypto code, debugging a real
    bug, code review/verification passes.
