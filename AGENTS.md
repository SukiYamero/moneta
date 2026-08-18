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
- `bun run typecheck` · `bun run lint` · `bun run format`
- `bun run test` (CI) · `bun run test:watch`
- **`bun run check` = typecheck + lint + test. It must pass before you claim any
  task done, commit, or open a PR.** Report its real output — never claim green
  without running it.

## UI: mobile-first, Tailwind v4 + shadcn/ui

- **Mobile-first, always.** Design and build for a phone screen first; layouts
  target one-handed use. Add larger breakpoints (`sm:`/`md:`/…) only to enhance,
  never as the base. Touch targets ≥ 44px, content clear of the safe-area insets.
- Style with Tailwind utility classes; no separate CSS modules unless unavoidable.
- Use shadcn/ui components from `@/components/ui`. Add new ones with
  `bunx shadcn@latest add <name>`. Compose with the `cn()` helper from `@/lib/utils`.
- Icons: `lucide-react`. Theme tokens (colors, radius) live in `src/styles/index.css`.

## State: zustand

Shared/global state goes in zustand stores under `src/lib` or the owning feature.
Local-only state stays in React hooks. No Redux.

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
