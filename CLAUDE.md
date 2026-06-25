# Moneta — project rules for Claude

## Source of truth: `specs.md`

We follow **spec-driven development**. `specs.md` is the source of truth.

1. **Before building any feature**, read `specs.md`. If the feature isn't
   specified, write its spec in §10 first (Goal · User story · UI · Data touched ·
   Edge cases · Done when), then implement.
2. **After any decision**, record it in `specs.md` §11 (Decisions log).
3. If code and `specs.md` disagree, `specs.md` wins — update the code or update
   the spec, never let them silently drift.
4. Bumping behavior or data shape ⇒ update `specs.md` in the same change.

## Data contract: `src/lib/schema.ts`

- **Import the types, never redefine them.** It is the stable contract.
- Domain field names stay in Spanish (`Movimiento`, `seccion`, `monto`…): they are
  the real Drive columns. Do not translate them.
- Structural change (rename/split/delete a field) ⇒ bump `SCHEMA_VERSION` +
  idempotent migration + spreadsheet backup before running it. Additive/optional
  fields go through `extra` first.
- `monto` always positive (sign from `tipo`); `id` = `crypto.randomUUID()`;
  dates ISO `yyyy-mm-dd`; views are derived, never stored.

## Coding rules

- **TypeScript always.** No `.js`/`.jsx`. `strict` is on; keep it green.
- **Everything in English**: code, identifiers, comments, commit messages, docs,
  spec files. (Exception: the `schema.ts` domain terms above.)
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
- Tests live next to code as `*.test.ts(x)`. Use Vitest + Testing Library.

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
