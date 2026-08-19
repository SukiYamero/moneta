# KuroBello — Development waves

This file is the **sequencing/status board**: which tracks exist, in what
order, who owns what files, and whether they're done. It does not decide
_behavior_ — that's `specs.md` (§10 feature specs, §11 decisions, §12
verification backlog). If this file and `specs.md` ever disagree on a
decision, `specs.md` wins; fix this file, not the other way.

## Vision — what KuroBello is, and where the signals point

The hard facts, from `specs.md` §1/§2: a **mobile-first personal-finance
PWA**. Records income/expenses (flow) and assets/investments (balance),
organized into user-defined sections/categories, with totals/breakdowns/
charts by day/week/month/year, an optional PIN lock, and — the
non-negotiable architectural spine — **no backend of any kind**: identity is
Google, data lives in the user's own Drive, the developer hosts nothing.
Privacy comes from that architecture, not from a promise.

Reading the signals from decisions made so far (this section is synthesis,
not a new decision — nothing here overrides `specs.md`):

- **It started as a personal tool, but isn't staying that small.** `specs.md`
  §1 already names "the future possibility of a friend using it with their
  own Google account" as in-scope thinking. The `Moneda` type has supported
  multi-currency since before multi-currency was needed. The UI investment
  (native-app-feel transitions, a real design system, dark theme built from
  an actual design canvas) is more polish than a single-user script needs.
- **The locale list requested for i18n (English, Argentine Spanish,
  Brazilian Portuguese, neutral Spanish for Colombia/Mexico/Ecuador/
  Venezuela/Peru) is a concrete signal, not a guess:** this reads as
  preparing for a Latin-America-first audience (Spanish-speaking countries
  as the core, Brazil as the biggest adjacent market, English as the
  catch-all) rather than a single country's personal tool. That's a
  meaningful shift in ambition worth naming explicitly, even though it
  hasn't been written up as a formal decision yet.
- **The no-backend constraint is a product decision as much as a technical
  one.** It caps what's possible (no push notifications with a real server,
  no cross-device background jobs, no "smart" receipt scanning without
  either an on-device model that doesn't exist for mobile yet or an
  explicit, deliberate exception) — see `specs.md` §11 2026-08-18 for the
  receipt-scan/voice research that ran into exactly this wall. The app's
  identity is "your money, in your Drive, nobody else's server" — that's
  the thing to protect when a feature request tempts a shortcut.

If this reading is wrong, or the ambition is different from what the
signals suggest, that's worth a real conversation and a `specs.md` §11
entry — not silently building past it.

## How the waves work

- A **wave** is a batch of tracks that can run in parallel (separate
  worktrees, zero shared files, per `AGENTS.md` § Working in parallel).
- A **track** is one unit of work, one branch, one worktree, owned by one
  agent at a time.
- Waves are sequential (a track in Wave _N+1_ may depend on Wave _N_ having
  merged); tracks within a wave are not.
- When a track finishes, mark it ✅ here and log/clear its worktree row
  below — don't leave the record stale.

---

## Wave 1 — ✅ COMPLETE (merged to `main`, 2026-08-18)

| Track                                   | Scope                                                                                                                                                                                         | Owns                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **A — data port (real impl)**           | Real dexie-backed implementation of the `Repo` interface. CRUD for `Movimiento`/`Activo`/`Config`, `schemaVersion` check. TDD.                                                                | `src/lib/repo.ts` (extended), `src/lib/repo.test.ts`, `src/lib/db.ts` |
| **B — Drive opt-in + token refresh**    | Real "Drive permission" + "Welcome" screens (replacing `LoginScreen.tsx`), calling `authStore.connectDrive`; `pinLock.updateSession` wired into every session-refresh path.                   | `src/features/auth/**`, `src/lib/authStore.ts`                        |
| **D — Foundational UI kit + fake repo** | `BottomSheet`, `CenterModal`, `IconAvatar`, `MovimientoRow`, `TagChip`, `DateChipPicker`, `SegmentedControl`, `Toggle`, `InfoButton` + `repo.fake.ts` (shared in-memory `Repo`, seeded data). | `src/components/shared/**`, `src/lib/repo.fake.ts`                    |

---

## Wave 2 — ✅ COMPLETE (merged to `main`, 2026-08-19)

> **Execution detail lives in [`wave-2-plan.md`](wave-2-plan.md)** — the
> operator's decomposition: per-track specs, file ownership, stage
> sequencing, the conflict analysis, and the live status table. This file
> keeps only the shape of the wave. If the two disagree on execution,
> `wave-2-plan.md` wins; on behavior, `specs.md` wins over both.

`src/components/shared/**` + `repo.fake.ts` are on `main`; every track below
can build against them.

**Scope decision (2026-08-19, operator + user): Wave 2 ships tracks I, J, E
and the Toast; tracks F, G and H move to Wave 3.** The Toast stays in Wave 2
even though its only Wave-2 consumer moved out with Track F — Wave 3 is three
tracks that all need it, and building the shared surface a wave early is what
lets all three start in parallel. Track E is split into four tracks (E1 data
layer, L shell, E2 Home, E3 Search, E4 History) so stage 3 runs three screens
concurrently instead of one agent serialising them; see `wave-2-plan.md` §2.

**Blocker before the screen tracks: the Toast (`specs.md` §10.6).** It is
the only surface for an error raised where no screen owns it — a failed
write from a sheet that already closed. `implementation-plan.md` files it
under Track F, but E, G and H need it just as much, and four tracks with no
shared surface will invent four. Build it with (or immediately after) Track
I, before E/F/G/H start writing screens.

**Sequencing note:** run **Track I (i18n) first**, before E/F/G/H write much
new UI copy. Every new screen built before Track I lands is Spanish text
that has to be retrofitted — the earlier the scaffolding exists, the less
retrofit work piles up. Track J is small and can follow right after I.

### Track I — i18n scaffolding (new, do this first)

**Not started. Documented here for planning — no code written yet.**

- **Goal:** every screen sources its copy from a translation table, never a
  hardcoded string, so adding a locale later is data, not a code change.
- **Locales:** `en` (English), `es` (neutral Spanish — Colombia, Mexico,
  Ecuador, Venezuela, Peru; also the fallback for any unmatched Spanish
  variant), `es-AR` (Argentina), `pt-BR` (Brazilian Portuguese).
- **Library:** `react-i18next` — mature, actively maintained, works cleanly
  with Vite, self-hostable (bundled JSON, no CDN — required by `AGENTS.md`'s
  no-CDN rule).
- **Structure (proposed, confirm when picked up):** `src/lib/i18n/index.ts`
  (init) + `src/lib/i18n/locales/{en,es,es-AR,pt-BR}.json`.
- **Locale selection:** detect from the browser on first run, mapped to the
  nearest supported locale (unmatched Spanish variants fall back to `es`
  neutral, unmatched everything else falls back to `en`); user-overridable
  later from Settings (Track G).
- **Persistence:** where the chosen locale lives is an open question to
  resolve when this track starts, not here — `Config.preferencias` (per
  `AGENTS.md`'s schema rule, new optional fields go through `extra` first,
  not a first-class column) is the natural home since it already syncs via
  Drive, but needs its own small `specs.md` §10 addendum before
  implementing, same pattern as Track H's `Grupo` type below. Don't invent
  the shape inline while implementing.
- **Retrofit scope:** `WelcomeScreen.tsx` and `DrivePermissionScreen.tsx`
  (Wave 1) are the only screens with hardcoded copy today — pull their
  strings into the `es` locale file as part of this track.
- **Done when:** the pattern exists, is documented in `AGENTS.md` § Coding
  rules (supersedes the current "user-facing UI copy is Spanish" line — that
  becomes "sourced from the i18n table, `es` as the base locale"), and the
  two Wave 1 screens use it. Translating into the other 3 locales can follow
  incrementally — the scaffolding existing is what unblocks everyone else,
  not full translation coverage on day one.

### Track J — Drive-permission screen refinements (small, do after I)

**Not started. Documented here for planning — no code written yet.** Follow-up
to Track B's `DrivePermissionScreen`, requested during Wave 2 planning:

- **Trim to one permission item.** The screen currently shows two cards
  ("Crear y editar sus propios archivos" / "No accede a tus otros
  archivos"). Keep only the view/edit-your-own-files item; drop the other.
- **Make that one item a bit bigger.** Step the remaining item's text up one
  token in the type scale (`--text-sm` → `--text-ms`, per
  `docs/ui/design-tokens.md`) and enlarge its icon badge slightly to match —
  it's carrying the whole message alone now, so it should read as more
  prominent, not identical in weight to before.
- **Persist the decision — ask once per device, not once per session.**
  Today `driveOptIn` is pure in-memory zustand state (`specs.md` §11
  2026-08-18, "in-memory, per-session, never persisted") — a deliberate
  choice at the time, made because the identity session itself was already
  rebuilt every cold start. That reasoning has a gap: once persisted-session
  paths exist (the PIN lock's cached vault, `hydrate()`), a user who already
  connected or dismissed Drive sees this screen again on every reopen. Fix:
  persist the decision locally (device-scoped IndexedDB record via
  `db.ts`, **not** `localStorage`/`sessionStorage` per `AGENTS.md` §7, and
  **not** `Config` — a user who dismisses Drive has no Drive to persist a
  Config-based preference into). Only re-prompt when no persisted decision
  exists yet. Supersedes the `specs.md` §11 2026-08-18 "in-memory,
  per-session" entry — record that supersession when this lands.
- **Add a short reassurance line near "Ahora no."** Something like _"Podés
  continuar sin vincular tu Drive — más adelante podés hacerlo desde tu
  Perfil."_ Dismissing isn't a dead end; say so. (The actual Profile "Drive"
  row this promises is Track G's job — the copy can ship before that row
  exists, since it just needs to be a promise Track G will keep, not a
  working link yet.)

### Track E — Home + Search + History

Dashboard (extend `Home.tsx`) + the `movimientoStats` aggregation module
(real, pure computation — `specs.md` §4, "views are derived," not a stub) +
Search/Filter sheet + History overlay. One track: all three share
`MovimientoRow` and the aggregation module.

Owns: `src/routes/Home.tsx`, `src/lib/movimientoStats.ts`,
`src/features/search/**`, `src/features/history/**`

---

## Wave 2.1 — ✅ COMPLETE (merged to `main`, 2026-08-19)

Two small tracks raised by the user after using the merged Wave 2 build.
Both are specified in `specs.md` (§10.7, §10.8) — read the spec, not this
summary. They share no files and run in parallel.

| Track                                | Scope                                                                                                                                      | Owns                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **N — region-aware formatting**      | Device region as an axis independent of the copy locale; region-derived initial `monedaPrincipal`; `narrowSymbol`; the sign on the number. | `src/lib/i18n/**`, `src/components/shared/movimientoView.ts`, `src/lib/schema.ts` (`Moneda` union only), `repo.local.ts`, `bootstrap.ts` |
| **O — per-category `TagChip` color** | The chip's icon always carries its category tint; selecting tints the whole pill in that family instead of a uniform primary green.        | `src/components/shared/TagChip.tsx`, `src/features/search/FilterSheet.tsx`, `src/routes/Kit.tsx`                                         |

Track N is the revisit condition `specs.md` §11 (2026-08-19) attached to the
`es → es-CO` formatting trade-off; Track O closes a single-source-of-truth
leak, not a design change — `getMovimientoVisual` already returned the tint
and the filter sheet was discarding it.

---

## Wave 2.2 — ✅ COMPLETE (merged to `main`, 2026-08-19)

Specified in `specs.md` §10.9 and §10.10 — read the spec, not this summary.

| Track                  | Scope                                                                                                                                   | Owns                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **P — loading system** | `Skeleton` primitive, `ScreenLoading`, the two-sided anti-flash gate, and one shared loading treatment across Home/Search/History.      | `src/components/shared/**` (new), the three screens' loading states, `src/router.tsx`, `Kit.tsx` |
| **Q — guest entry**    | Guest as a distinct auth state, `RequireAuth` letting it through, the Welcome screen's `or` divider + guest button, and the boot flash. | `src/lib/authStore.ts`, `src/features/auth/**`, the `auth` locale namespace                      |

**The seam between them:** §10.9's Tier 1 fix (boot must not flash the login
screen) lives in `RequireAuth.tsx`, which Track Q owns — so Q implements it
with a minimal inline boot state and P builds the shared `ScreenLoading` it
should eventually use. The operator swaps one for the other after both merge.

---

## Wave 3 — foundations (stage 1 in flight, 2026-08-19)

> **Execution detail lives in [`wave-3-plan.md`](wave-3-plan.md)** — the
> operator's decomposition: file ownership, the conflicts resolved up front,
> the per-track briefs and the live status table. This file keeps only the
> shape of the wave. If the two disagree on execution, `wave-3-plan.md` wins;
> on behavior, `specs.md` wins over both.

The feature tracks that used to be Wave 3 moved to Wave 4 (user decision,
2026-08-19) so a wave of **foundations** can land first: the plumbing every
later feature assumes exists. Built from two audits — `docs/wave-3-audit-runtime.md` and
`docs/wave-3-audit-surface.md` (evidence, not plans).

**The specs are written and the wave is not started:** `specs.md`
§10.11–§10.18, each with a _Blast radius_ line saying how much it may touch,
plus a staging table and a trim order at the end of that block.

| Track | Spec   | What it is                                                                      |
| ----- | ------ | ------------------------------------------------------------------------------- |
| R     | §10.11 | Offline entry, network state, the 7-hour window, unified error copy             |
| S     | §10.12 | Export / backup (import deliberately excluded)                                  |
| T     | §10.13 | The write path — `dataStore` mutations + one convention                         |
| U     | §10.14 | Form primitives + `ConfirmDialog`                                               |
| V     | §10.15 | Profiles: per-profile dexie database — **gates the future `repoProvider` swap** |
| W     | §10.16 | Service-worker update lifecycle                                                 |
| X     | §10.17 | Local diagnostics log (cuttable)                                                |
| Y     | §10.18 | Profile / account screen — the access point (lock + guest exit live here)       |

Tracks run in **three stages, not all in parallel** — see "Wave 3 — staging
and dependencies" in `specs.md`. A later stage is blocked until every track
in the previous one has merged **and passed its code review**. The
`repoProvider` stub flip is deliberately **not** in this wave: without a
create UI (Wave 4, Track F) it would leave the app empty and unusable.

---

## Wave 4 — planned (feature tracks, moved here from Wave 3 on 2026-08-19)

These three were originally Wave 2, then Wave 3. They move again so a
foundations wave can land first; all three consume the Toast (Track K) and
the i18n table, which is exactly why those were built a wave early.

### Track F — Movement/Add sheet + Voice

View/edit sheet, create sheet, delete confirm, toast, the Voice unit (Web
Speech API + client-side regex parser — architecture resolved, `specs.md`
§11 2026-08-18: on-device, no backend, cleared to build).

Owns: `src/features/movimientos/**`

### Track G — Tags + Profile + Settings

Tag picker, custom tag modal, profile sheet (including the Drive
reconnect row Track J's copy promises), "Personalizar" settings screen.

Owns: `src/features/tags/**`, `src/features/profile/**`,
`src/features/settings/**`

### Track H — Groups ("Áreas")

List + detail + editor. Needs a schema addition first (`Grupo` type, or
`extra` on `Categoria`) — write that `specs.md` §10 addendum before
implementing, don't invent the shape inline.

Owns: `src/features/groups/**`, `src/lib/schema.ts` (additive only)

---

## Not scheduled

- **Receipt scan** — deferred indefinitely. On-device OCR is unreliable on
  real (thermal-paper) receipts; the on-device path good enough (Chrome's
  Prompt API / Gemini Nano) is desktop-only, missing this app's mobile
  target entirely. User explicitly declined a backend for this. See
  `specs.md` §11 2026-08-18. Don't restart this research without a real
  platform change.

Cosmetic/small items not tied to a wave (PWA icon, OAuth consent branding,
etc.) stay in `specs.md` §12 — they don't need worktree-level tracking.

---

## Worktree log

Every agent that creates a `git worktree` logs a row here the moment it
does, and updates **Status** the moment the track's work merges to `main`.
Check this table against `git worktree list` at the start of any parallel
session; prune anything stale (merged-but-not-removed, or on disk but
missing/finished here).

| Path                          | Branch              | Status |
| ----------------------------- | ------------------- | ------ |
| `../moneta-worktrees/wave3-r` | `wave3/r-offline`   | active |
| `../moneta-worktrees/wave3-s` | `wave3/s-review`    | merged, in review |
| `../moneta-worktrees/wave3-u` | `wave3/u-forms`     | active |
| `../moneta-worktrees/wave3-v` | `wave3/v-review`    | merged, in review |
| `../moneta-worktrees/wave3-w` | `wave3/w-sw-update` | active |

Paths are relative to the repo root (`web/moneta`), i.e. a sibling
`web/moneta-worktrees/` directory outside the repo — deliberately not nested
inside it, so a worktree never shows up as untracked content in `main`.

Status values: `active` → `merged, pending cleanup` → row deleted once
`git worktree remove <path>` runs.
