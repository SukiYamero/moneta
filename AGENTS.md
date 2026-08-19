# KuroBello — project rules for AI agents

These rules apply to every coding agent working in this repo (Claude Code,
Codex, Cursor, Gemini CLI, …). `CLAUDE.md` is only a pointer to this file.

## Source of truth: `specs.md`

We follow **spec-driven development**. `specs.md` is the source of truth.

1. **Before building any feature**, read `specs.md`. If the feature isn't
   specified, write its spec in §10 first (Goal · User story · UI · Data touched ·
   Edge cases · Done when), then implement.
2. **After any decision**, record it in `specs.md` §11 (Decisions log).
3. If code and `specs.md` disagree, `specs.md` wins — update the code or update
   the spec, never let them silently drift.
4. Bumping behavior or data shape ⇒ update `specs.md` in the same change.
5. The work queue lives in `specs.md` §12 (Backlog) — pick up from there and
   keep it updated when you finish or defer something.

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
  copy is Spanish.)
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

## Working in parallel (multiple agents)

- One agent = one branch = one worktree. Never two writers on the same branch.
- Each task declares the files it owns (see the track plan in `specs.md` §12);
  do not edit files owned by another in-flight track.
- `specs.md` edits from parallel tracks are **append-only**: add your own §10
  subsection or §11/§12 lines, never rewrite someone else's.
- Merge to `main` early and often (trunk-based, no `develop`); rebase your
  worktree on `main` before finishing.
- Every agent in every track follows the Coding rules comment policy above
  strictly: add a comment only when it is genuinely necessary to explain a
  non-obvious _why_. No exceptions per-track.
- **Log every worktree** you create in `specs.md` §12 "Worktree log" the
  moment you create it (path, branch, status `active`). When your track's
  branch merges to `main`, remove the worktree (`git worktree remove <path>`)
  and delete its row — don't leave it lying around "just in case".
  At the start of any parallel session, check the log against
  `git worktree list` and prune anything stale (merged-but-not-removed, or
  present on disk but missing/finished in the log).
- **Subagent model/effort:** always Sonnet 5, never downgrade to another
  model. Only two effort tiers — pick per task, don't default to `high` out
  of habit:
  - `normal` — straightforward/mechanical work: search/lookup, boilerplate,
    small well-scoped edits, running commands and reporting results.
  - `high` — anything correctness-critical or open-ended: architecture or
    design decisions, money math, auth/lock/crypto code, debugging a real
    bug, code review/verification passes.
