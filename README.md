# KuroBello

Personal-finance PWA, mobile-first and local-first. Income/expenses and assets,
organized in user-defined sections and categories, optionally synced to the
user's own Google Drive. No backend: identity is Google, data lives in the
user's Drive, the developer stores nothing.

> The user-facing brand lives in `src/lib/branding.ts` (`APP_NAME`) and changes
> freely — currently **KuroBello**. Storage identifiers (Drive folder, dexie DB,
> lock HKDF info) are frozen at the 2026-08-18 baseline and do not follow later
> renames.

## Where to start

- **`specs.md`** — the source of truth: architecture, data model, security
  model, feature specs and backlog. Read it before touching code.
- **`AGENTS.md`** — rules for AI coding agents (any model). `CLAUDE.md` just
  points there.
- **`src/lib/schema.ts`** — the data contract. Import it, never redefine it.

## Stack

React 19 + Vite + TypeScript (SPA, no SSR) · Tailwind CSS v4 + shadcn/ui ·
zustand · React Router v8 · dexie (IndexedDB) · vite-plugin-pwa ·
Vitest + Testing Library · bun · oxlint + Prettier.

## Commands

```sh
bun install
bun run dev        # local dev server
bun start          # dev server + Cloudflare Tunnel at dev.kurobello.com, for testing on a real phone
bun run check      # typecheck + lint + test (the done-gate)
bun run build      # production build
```

Google login needs `VITE_GOOGLE_CLIENT_ID` in `.env.local` (see `.env.example`). Its
Google Cloud Console OAuth client needs `dev.kurobello.com` (not a raw LAN IP —
Google rejects those as an origin) in Authorized JavaScript origins to test login
from a phone; `bun start` is what serves the app there.
