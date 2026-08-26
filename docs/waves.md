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

- **That constraint has now been stress-tested with real numbers, not
  assumed** (`specs.md` §11, 2026-08-19). Asked directly what a backend
  would cost, the analysis found the money is irrelevant — free tiers hold
  hundreds of users and $5–25/month covers success. What it costs is the
  thesis: "your data is in your Drive" is _verifiable_, "trust my server" is
  what every competitor already says. Plus data-controller obligations for
  financial data that do not scale down. **It is no longer an inherited
  assumption; it is a decision someone checked.** The escape hatch stays
  exactly where §6 put it: a stateless function that stores no user data, and
  only for something that genuinely cannot work otherwise.

## Where the codebase actually is (2026-08-19)

Kept short and honest, so a fresh agent doesn't have to infer it from commits:

- **What is real:** the app opens and navigates **offline**; local data is
  **scoped per profile**, so real data has a correct home the day it arrives;
  there are form primitives and a confirm dialog for Wave 4 to build with; a
  deploy no longer takes over an open tab silently; CSV export works. Wave 3
  stage 1 shipped all of that (five tracks, each reviewed, plus a cross-track
  pass).
- **What is not real yet, and is the whole point of what comes next:** the
  app still reads the **fake repo** — `repoProvider.getRepo()` is a
  deliberate stub — because flipping it without a create UI would leave a
  correct, empty, unusable app. There is **no write path** and **no Drive
  sync implemented**. Data lives only on the device, which `specs.md` §12
  records as a knowingly accepted risk, not an oversight.
- **What is decided but unbuilt:** the Drive sync architecture (§10.19) —
  per-device append-only operation logs, sharded by month, merged by one
  rule. Specced 2026-08-19 precisely so the write path (Track T) is built
  against it instead of inventing a convention that contradicts it.

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

## Wave 3 — foundations (✅ complete, 2026-08-19)

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

**Stage 1 is ✅ complete (merged to `main`, 2026-08-19):** R, S, U, V and W,
each with its own code review, plus a cross-track pass over the seams.

**Stage 2 is trimmed to Track T alone (user decision, 2026-08-19): take only
what is needed now.** Track X (§10.17 diagnostics) was already the designated
first cut and is deferred — nothing depends on it and no promise sits behind
it. Track T is the one thing on the critical path: **nothing can write yet**,
so neither the `repoProvider` flip nor any Wave 4 feature can move without it.

**Track T is now gated on `specs.md` §10.19** (Drive sync, specced
2026-08-19). T builds the local write path _and the outbox that feeds sync_ —
if it settles its convention without knowing the operation-log format it
feeds, that convention gets rewritten. Reading §10.19 is part of T's brief,
not optional context.

Tracks run in **three stages, not all in parallel** — see "Wave 3 — staging
and dependencies" in `specs.md`. A later stage is blocked until every track
in the previous one has merged **and passed its code review**. The
`repoProvider` stub flip is deliberately **not** in this wave: without a
create UI (Wave 4, Track F) it would leave the app empty and unusable.

---

## Wave 3.1 — ✅ COMPLETE (merged to `main`, 2026-08-19)

One track, raised by the user while reviewing Wave 3's own output. Specified in
`specs.md` §10.20 — read the spec, not this summary.

| Track                        | Scope                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **AA — sign-out + identity** | Invalidate the vault on logout; give `ProfileRecord` an account key; the unsynced-and-unlinked confirm; an inert delete control |

It exists because Track Y's review traced a confirmed defect — with a PIN set,
"Sign out" returned the user to the account they had just left — and the user's
own questions found the deeper gap under it: the registry records _what_ a
profile is, never _whose_. That missing field is what makes "delete the data on
sign out" look reasonable; the field is the fix, deleting was the workaround.

---

## Wave 4 — the app comes alive (re-scoped by priority, 2026-08-19)

> **Execution detail lives in [`wave-4-plan.md`](wave-4-plan.md)** — the
> operator's decomposition: file ownership, the conflicts resolved up front,
> the per-track briefs and the live status table. This file keeps only the
> shape of the wave. If the two disagree on execution, `wave-4-plan.md` wins;
> on behavior, `specs.md` wins over both.

Re-planned with the user, who set the product priorities; the operator set the
staging from the dependencies. **Priority, in the user's words:** operations —
balances, expenses, creating an income or an expense — are the high one; tags
are core because nothing can be created without them; sync matters early so it
can be exercised; the account slide is medium and largely already shipped;
voice is medium and near the end; groups/areas are last.

### What already exists, so nobody rebuilds it

Wave 3's foundations were spent precisely here. A create-movement sheet needs:
`BottomSheet`, `AmountField` (locale-aware, never a hand-rolled parser),
`TextField`, `DateChipPicker`, `SegmentedControl`, `ConfirmDialog`, the Toast,
`MovimientoRow`, and a write path — **all of them exist**
(`dataStore.createMovimiento` included, §10.13). The account sheet exists too
(§10.18, Track Y): identity, profiles, the PIN lock and export are real; only
the preferences behind it are inert.

**What is actually missing is two things:** a way to _assign_ a category
(`TagChip` renders and filters, it does not assign), and real data behind
`getRepo()`.

### The dependency that sets the order

**A movement cannot be created without assigning a category**, so tags is not
a pleasant parallel extra — it **blocks** the create sheet. If the create
sheet improvises its own picker, tags later replaces it and the codebase ends
up with two conventions, which is the defect shape `AGENTS.md` names as this
project's most expensive lesson.

### Staging

**Stage 1 — ✅ COMPLETE (merged to `main`, 2026-08-20):** Z and G1, each with
its own code review applied, plus an operator cross-track pass over the seams.

**Stage 1 — parallel (no shared files):**

| Track                     | Spec              | Owns                                                                                              |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| **Z — Drive sync engine** | §10.19 ✅ written | `repo.drive.ts`, the sync engine + flush triggers, `bootstrap.ts`, §4's layout. **No screens.**   |
| **G1 — category picker**  | §10.22 ✅ written | `src/features/tags/**` + the taxonomy-reference sweep — see `wave-4-plan.md` §2 for the full list |

**Stage 2 — ✅ COMPLETE (merged to `main`, 2026-08-20):** F and G2, each with
its own code review applied, plus an operator groundwork commit before dispatch
and a cross-track pass after. The `repoProvider` flip (§10.25) is the one item
left: it is unblocked now that creating a movement works, and needs the honest
empty state to land with it.

**Stage 2 — blocked on stage 1:**

| Track                            | Spec              | Owns                                                                                                     |
| -------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| **F — movement sheet**           | §10.23 ✅ written | `src/features/movimientos/**` — view/edit, create, delete. G1 has merged, so unblocked.                  |
| **The `repoProvider` flip**      | §10.25 ✅ written | Operator step. Gated on F **and** on the guest-cliff decision — now `docs/pendientes-usuario.md` item 6. |
| **G2 — "Personalizar" settings** | §10.24 ✅ written | `src/features/settings/**` + the lock i18n retrofit. All four §12 prerequisites decided in the spec.     |

**Stage 3 — ✅ COMPLETE (merged to `main`, 2026-08-20).** The app persists and
syncs. Step 1 (boot + the flip), then AB and AC in parallel, each with its own
code review applied, plus the operator's cross-track pass. `bun run check`:
131 files, 1375 tests.

Kept below as written, because the "before" it describes is what the stage
was measured against: the app could create, edit and delete a movement and
none of it survived a reload — `repoProvider.ts` returned `fakeRepo` — and the
sync engine was built, tested and called by nobody. It was sequenced **serial
then parallel**, because the flip moved the ground the sync wiring stands on.

**Step 1 — the flip (operator, alone, its own commit).** §10.25 plus its
2026-08-20 addendum: the async profile binding (`getRepo()` is synchronous and
the real binding is not — nine call sites), redirecting the outbox to the
active profile's database, the honest empty state, and the seed taxonomy
localization that becomes reachable that same day. §10.25 requires this not
share a commit with anything else.

**Step 2 — two tracks in parallel, no shared files:**

| Track                      | Spec         | Owns                                                                                                                             |
| -------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **AB — sync goes live** ✅ | §10.26       | `src/lib/sync/**`, `authStore.ts` (start/stop hooks), `main.tsx`, the first-run download view, the Drive status row              |
| **AC — review debt** ✅    | §12 + §10.27 | `movimientoStats.ts` + its call sites (§10.27 currency), `OptionList`, `SettingsScreen`, `SecuritySection`, the week-start table |

**AB ships a data-loss fix before it ships a feature.** The general cross-wave
review reproduced a race in `push()` that permanently drops an operation from
Drive (§10.26 §1, §12). It is unreachable today only because nothing calls the
engine — wiring it is exactly what makes it reachable.

### What stage 3 cost, and what the reviews actually caught

Recorded because the numbers are the argument for the protocol, not a
celebration. **Seven CONFIRMED defects were found after their track's author
declared the work done and green**, every one reproduced with a failing test
before being fixed:

- **Two by the operator reading a diff** — a race fixed in two functions and
  given the opposite answer in a third, in the same commit; and `push()`
  coalescing while ignoring its own arguments.
- **Four by per-track reviewers** — a guest binding a signed-out account's
  profile (lost the race on _every_ run, not intermittently); a boot gate
  trusting a module-global "ready"; an unkeyed `pull()` handing a fresh
  profile another profile's stale pull and reporting success; and every PIN
  lock silently killing sync for the rest of the session, which no backlog
  had ever named.
- **One by the cross-track pass** — the first-sync gate re-trapping a user who
  had already dismissed it, because `/` and `/settings` are sibling routes and
  the gate assumed it only remounted on a rebind.

**The shape they share:** all but one live in the seam between two pieces of
work, and every one was invisible to the author who wrote it — not through
carelessness, but because each was correct read alone. The cross-track pass's
own observation is the sharpest version: in both of its findings the defect
sat under a confident, well-written doc comment whose claim the _calling_ file
had quietly falsified. A reviewer checking "is this file internally
consistent" passes it every time.

**Stage 4 — after the app persists:**

| Track                     | Notes                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Activo` / patrimonio** | Deprioritized to last by the user (2026-08-20), not cut. The assets half of §4, with **zero** UI today — no screen, no write path, no `outbox.ts` union member. Confirmed real missing scope on 2026-08-20, deferred rather than cut. Needs its own §10 spec. |
| **Voice**                 | An addition to F's sheet, so it cannot precede it. Architecture already resolved (§11, 2026-08-18): Web Speech API + a client-side parser, on-device, no backend.                                                                                             |
| **H — groups / "Áreas"**  | Last, per the user. Needs its schema addendum (`Grupo` type, or `extra` on `Categoria`) written **before** implementing — do not invent the shape inline.                                                                                                     |

### Before any of this is dispatched

**Stages 1, 2 and 3 are specified (§10.19, §10.22–§10.27); Track H and the
`Activo` track do not have one.** `AGENTS.md`'s
first rule is that an unspecified feature gets its §10 spec written before it
is built, so Track H still needs one before stage 3. G2's spec in particular has to **decide** four things §12 already
files against it, not discover them mid-build: the week-start bug that becomes
reachable the moment a picker exists; `idioma` not being a field on
`Preferencias`; whether `claro` is offered at all while the light palette is
unreviewed scaffold; and the lock's still-untranslated copy.

### On exercising sync early

Z can be built and unit-tested immediately — it has a contract suite and needs
no UI. But it can only be **exercised end to end** once real data exists,
which means after the flip, which means after F. The alternative §10.15's
staging note already names is to seed the local store and flip early; the
operator recommends against it, because seeded movements in a money app create
a "is this mine or sample data?" ambiguity that is worse than waiting one
stage. Revisit if stage 2 slips.

### Small, unscheduled: the returning-user entry screen (§10.21)

Cheap, self-contained, and worth doing before anyone else meets it: a person
who has used the app for months and reopens it must never see the first-run
screen. The signal is already read at exactly that point (`restore()`'s device
login marker), and §10.20's registry already holds the account name to greet
them with. Pairs with persisting guest mode, which §10.18 unblocked — decide
the two together. See `specs.md` §11 (2026-08-19) for the rule this belongs
to, which is bigger than the screen.

---

## Wave 4.1 — the designed surface (planned 2026-08-20, user + operator)

Raised by the user after using the merged stage-3 build and doing the design
work. Same shape as Waves 2.1/2.2/3.1: small, user-driven, sequenced ahead of
the bigger plan because it is what they actually see.

**Placed before Wave 5 (hardening) deliberately.** Hardening is real and stays
next, but nothing in it is newly reachable: Track Z shipped the validation it
could not ship without, which was the whole point of that split. These four
items are visible on every single app open.

**✅ COMPLETE (merged to `main`, 2026-08-21).** Five tracks, not four: AD, AE
and AF in parallel, then AH and AG in sequence. Each merged with its own review
pass applied, plus an operator cross-track pass over the stage-1 seams.
`bun run check`: 145 files, 1563 tests (the wave started at 131/1375).

**AH was not in the plan.** It exists because the wave's own seam produced it:
AF shipped a guest lock whose copy promised cold-start protection, and guest
mode turned out to be in-memory only — an operator briefing error, recorded as
one in §10.33. Execution detail — staging, file ownership, the conflict hunt,
the decisions taken before dispatch and the escalations resolved after — lives
in [`wave-4.1-plan.md`](wave-4.1-plan.md).

| Track                           | Spec                | Priority | Owns                                                                                                                                                              |
| ------------------------------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AD — the cold-start surface** | §10.29 + §10.21     | 1        | `RequireAuth.tsx`, `src/features/boot/**`, `src/features/sync/FirstSyncGate.tsx`, `router.tsx`, `src/features/auth/**`                                            |
| **AE — the light theme**        | §10.30              | 2        | `src/styles/index.css` (`:root` only), `index.html`, the theme-resolution module, the theme row in `PreferencesEditor`, `docs/ui/design-tokens.md`                |
| **AF — the PIN screens**        | §10.2 (polished UI) | 3        | `src/features/lock/**`, `src/features/profile/SecuritySection.tsx`                                                                                                |
| **AG — the profile switcher**   | §10.31 + §10.32     | 4        | `src/lib/profiles/**`, `ProfilesSection.tsx`, `outbox.ts` + `sync/engine.ts` (the profile-scoped reference), `authStore.ts`'s sign-in moment, the adoption prompt |

### Why AD is one track and not two

§10.29 (one loading moment) and §10.21 (the returning-user screen) both live in
the **same span of time** — from app launch to Home — and both edit
`RequireAuth.tsx`. Splitting them puts two writers on one file for one
user-visible sequence, which is precisely the ownership mistake `AGENTS.md`
records from Wave 3 stage 1. One track owns the cold start end to end:
what shows while auth resolves, how a returning user is greeted, and the
handoff into the first-run download view.

AD carries a **mandatory regression test for §10.9's boot flash** — a
returning user's app must never flash the Welcome screen. This change is
structurally positioned to reintroduce it, and a careful read is not
sufficient evidence.

### AE and AF are independent of AD and of each other

No file overlap. AE is styling plus a synchronously-resolvable theme value;
AF is the lock feature folder plus the guest branch §12 files
(`SecuritySection` shows a guest a control that can only fail).

**AF implements a recorded user decision:** a guest gets **no PIN, biometrics
at most** (§11, 2026-08-20). Where the platform has no biometrics, a guest
sees nothing — never a PIN, and never today's control that only errors.

### AD deletes a screen this project built today

§10.29 was revised the same day it was written: **there is no full-screen
loading screen.** The design export has no splash artboard at all and answers
"busy" with a three-state inline pill, and the user — who had decided the
800ms brand moment that morning — reversed it after opening the built app and
seeing two loaders. `BootScreen.tsx` and its floor are **deleted**, not
reworked. The boot _sequence_ (§10.28) is untouched and correct; only the
screen covering it goes.

What replaces it is not another loader: the app's own skeleton covers the
pre-content span, so the transition into real data is a fill rather than a
swap. §10.9's Tier 1 boot flash is still not available as a trade — AD's
mandatory regression test is what keeps that true.

### AH — the guest who comes back (added 2026-08-20, mid-wave)

**§10.33.** Not in the original Wave 4.1 table: it exists because the wave's
own seam produced it. Track AF shipped the guest biometric lock and reported
that it never gates a cold start, because guest mode is in-memory only — while
the row's copy promises a prompt "when you reopen the app". The operator's own
Track AD brief caused it, by telling AD to leave the guest out when §10.21 had
explicitly asked for guest persistence to be decided together with the
returning-user screen.

Sequenced **before AG**: both touch `authStore.ts`'s account/guest transitions,
and AG's §10.32 adoption prompt fires at exactly the moment AH clears the guest
marker. Small, and it makes AF's shipped control honest rather than merely
worded honestly.

### AG lost its PIN gate, and gained the prompt that prevents the cliff

Two revisions land on AG after the table above was first written, and both
shrink or move work rather than adding it:

- **No PIN when switching** (§10.31 §3, user, revised the same day). The first
  instruction was that a switch shows the PIN screen; presented with what that
  costs — one device-scoped vault holding one account's session, so unlocking
  on a switch would rehydrate the _wrong_ account's session — the user chose
  the simpler rule: the PIN protects opening the app, not moving inside it.
  **AG therefore does not touch the lock at all**, which is also what keeps it
  clear of Track AF.
- **§10.32 joins AG**: a guest signing in is asked, once, whether to bring
  their movements into the account. That is the half that _prevents_ the guest
  cliff; the switcher is the half that _recovers_ from it. Both are AG.

### AG is not "a screen nobody designed"

`docs/pendientes-usuario.md` item 6 has priced the profile switcher as
expensive since Wave 3. It is not: `ProfilesSection` already lists profiles
and marks the active one, `ProfileRecord` already carries the account key, and
`boot.ts` already owns a rebind path proven twice by review. What is missing is
an explicit active-profile pointer (today it is inferred by recency) and a tap
handler.

**AG deliberately makes a deferred bug reachable and must close it**: §12's
"a push in flight drains the wrong profile's outbox" needs a fast
logout+relogin race today; a switcher makes it a button. Same shape as the seed
taxonomy becoming reachable at the flip — the fix lands with the feature that
exposes it, or the feature is wrong.

### The design has gaps, and they are named rather than guessed

From `docs/ui/design-export-reference.md`: **no boot/download artboard**
(resolved above by deleting the screen), **no biometric UI anywhere** — awkward,
because biometrics-only is precisely what was decided for guests the same day —
and **no guest flow at all**, though guest mode shipped in Wave 2.2. The
returning-user screen renders "Tus datos siguen acá, intactos"
unconditionally, which is the dishonest-copy shape §10.21 itself warns
against; it needs a gate at implementation time, not a faithful copy.

### One thing is no longer blocking

**Resolved 2026-08-20:** the design export is versioned at
`docs/ui/Moneta_ Expense Manager UI.zip`, its token table lifted verbatim to
`docs/ui/moneta-theme.css`, and the four areas Wave 4.1 needs extracted into
`docs/ui/design-export-reference.md`. The canvas itself stays unreachable to an
agent session (403, verified), which is why the export is versioned rather than
linked. `docs/ui/README.md` had referred to `Moneta.dc.html` as though it were
readable since Wave 1, and every designed screen through Wave 4 was in fact
built from prose.

### Deliberately not in this wave

- **The brand mark** — deferred by the user; `BootScreen`'s placeholder is
  structured so a real mark replaces one square's contents (§11, 2026-08-20).
- **Notifications** — kept in the canvas, not built. There is no backend, so
  there is no push (§6); anything shippable is local-only or needs §6's
  exception argued.
- **Receipt scanning** — postponed, artboard kept as a record.
- **The account chooser as a Google-popup mock** — resolved 2026-08-20: the
  user had thought it meant several saved Google accounts, and it does not.
  The export's "Elige una cuenta" is Google's own dialog, which we never
  render. What was actually wanted became Track AG above.

---

## Wave 5 — hardening: assume nothing that arrives is trustworthy (2026-08-19)

Raised by the user while scoping Wave 4. The decisions behind it are in
`specs.md` §11 (2026-08-19, "validate the shape, not the characters" and the
rejected client-side encryption) — read those, not this summary.

**The split that matters, and it is not optional:** the validation **Track Z
cannot ship without** stays inside Track Z, in Wave 4. You cannot ship a Drive
reader with no validation and call the validation a later wave — a malformed
file would reach the store on day one. Wave 5 is the **broader pass** on top:
the sweeps, the lint rules, the caps, and the parts with no consumer yet.

### Why this exists at all

The files live in the user's own Drive, in a visible folder, as plain JSON.
They can open one and mangle it. `drive.file` limits what _we_ can see, never
what _they_ can do — so the privacy win and the untrusted-input cost are the
same coin (`specs.md` §10.19).

### What belongs here

| Item                                                       | Why                                                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prototype-pollution guard on every external merge**      | `repo.local.ts`/`repo.fake.ts` merge with `{...existing, ...patch}`; a `__proto__`/`constructor` key from parsed Drive JSON is live the day Z lands. Concrete and currently unguarded. |
| **Number type + range validation on money**                | `monto` must be finite and positive. `1e999` parses to `Infinity`; a `"5"` string poisons every sum in silence. Highest value of anything here for a money app.                        |
| **Size caps** on what is read and written                  | An unbounded file is a self-inflicted DoS.                                                                                                                                             |
| **A lint rule pinning the no-`innerHTML`/`eval` property** | Verified true today across all of `src`; XSS through rendering is structurally closed, and this keeps it closed rather than trusting it stays that way.                                |
| **A test proving no file we write carries a secret**       | The token, PIN and vault material. §10.12 already requires it for the CSV; the same rule belongs on the Drive files — a test, not a promise.                                           |
| **Telling the user when entries were skipped**             | If a mangled file cost them three entries, saying so is the only way they would ever know. §10.19 already says "skip and keep going"; this is the honest half of it.                   |

### What deliberately does NOT belong here

- **A character blocklist on free text.** `nota`/`categoria`/`seccion` are
  Spanish and Portuguese: accents, ñ and emoji are legitimate data. A
  blocklist rejects the user's own valid input and needs every bad thing
  enumerated. Allowlist patterns on _structured_ fields (`fecha`, `moneda`,
  `tipo`, `id`) are the right shape and already the codebase's convention.
- **Client-side encryption of the Drive files** — rejected with reasoning in
  `specs.md` §11. It would cost the promise that makes the whole architecture
  worth having.

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

## Ajustes 1 — the first manual pass on a phone (2026-08-24)

**The wave plan is paused for this batch, at the user's request.** Wave 5 and
everything queued behind Wave 4.1 stays exactly where it is; nothing here
reorders it.

Six defects, all found by one person holding the running app, none by any
review pass. Five are shell/chrome consistency (zoom, a scrolling welcome
screen, four different top margins, a grab handle that scrolls away, a
duplicated button on the return screen). The sixth is not a UI defect at all:
**`specs.md` §10.23's UI section diverged from the design export's Add-sheet
artboard, and the code implemented the spec faithfully.** The artboard had
never been read — it is the one introduced by a bare `<!-- add sheet -->`
comment rather than the `<!-- ===== NAME ===== -->` banner the others use, so
a marker-based search of the export skipped it.

Execution view, file ownership and the resolved collisions:
[`docs/ajustes-1-plan.md`](ajustes-1-plan.md). The extracted artboard:
[`docs/ui/design-export-add-sheet.md`](ui/design-export-add-sheet.md).

**The process finding, which outlives the batch:** a versioned design export
nobody diffs against the spec sections describing the same screens is
decoration. Sixteen artboards are in that position today. Filed to `specs.md`
§12 rather than fixed here — the user asked for adjustments, and sixteen
diffs is its own piece of work.

---

## Worktree log

Every agent that creates a `git worktree` logs a row here the moment it
does, and updates **Status** the moment the track's work merges to `main`.
Check this table against `git worktree list` at the start of any parallel
session; prune anything stale (merged-but-not-removed, or on disk but
missing/finished here).

| Path                                        | Branch                             | Status                                                                      |
| ------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `.claude/worktrees/agent-ad512be09375d9b2e` | `worktree-agent-ad512be09375d9b2e` | active (Track KP-A, amount keypad dismissal + drag-handle, specs.md §10.54) |
| `.claude/worktrees/agent-a2b1c1c235d44a91f` | `worktree-agent-a2b1c1c235d44a91f` | active (Track KP-C, PIN hidden-input keyboard sweep, LockScreen/PinSetup)   |

**Pruned 2026-08-25 (cross-track review, `review-ajustes-2`):** AJ2-A's row
(`../moneta-worktrees/aj2-a`, `aj2-a-amount-display`) still claimed `active`
against `git worktree list`/`git branch -vv` showing neither — the track
merged (`7336c34`) and was reviewed (`11273f2`) without the row being
removed. Same failure this table already names below, a fourth time.

**Operator correction, same day:** the review attributed this to AJ2-A not
following the rule its sibling AJ2-B did. Neither track edited this file —
the operator owned both worktrees end to end, dropped AJ2-B's row at merge
(`fa55828`), and forgot AJ2-A's minutes later. The lesson is therefore
stronger, not weaker: the same person forgot the prune in the same batch
where they had just done it correctly. An enforced trigger (a merge-commit
checklist item, a lint, anything mechanical) is the fix; "whoever merges
remembers" has now failed four times across two roles.

**Pruned 2026-08-25 (cross-track review, `review-cross`):** AJ-A, AJ-E and
AJ-F's rows (`aj-a-shell-standard`, `aj-e-return-guest`, `aj-f-pin-copy`) all
claimed `active` against `git worktree list`/`git branch -a` showing neither
the worktree directories nor the branches still existed — all three tracks
had merged (`31411ff`, `67ce17a`, `ffd3118`) days earlier without their rows
being removed. The same failure this table's own comment already names for
AH (below), recurring three more times in the very next batch: the rule
("prune the moment the track merges") isn't self-enforcing, only checked
when a later session happens to look. Worth a process note past this one
cleanup: this table has now needed an out-of-band prune twice — a track
finishing its own work is evidently not a reliable trigger for also editing
this file's status column.

Wave 4.1 stage 1 (2026-08-20): AD, AE and AF each merged with its own review
pass applied, plus an operator cross-track pass — every worktree removed. AH
(§10.33) is the mid-wave addition the stage's own seam produced; its
`review-ah` row was **pruned 2026-08-24** — the work had merged (`d6907b2`),
but neither the worktree nor the branch still existed, and the row had sat
here claiming `active`.

That is the exact failure this table's own rule exists to catch, so it is
worth naming rather than quietly deleting: a stale `active` row is not
neutral — it tells the next session that a writer is holding a branch that
is gone. Check this table against `git worktree list` at the **start** of a
session, not the end.

Wave 4 stage 3, step 2: AB = §10.26 sync goes live (merged and removed
2026-08-20, along with its own review pass); AC = §10.27 + the review debt
filed in §12 (merged and removed 2026-08-20, along with `track-boot`).

Paths are relative to the repo root (`web/moneta`), i.e. a sibling
`web/moneta-worktrees/` directory outside the repo — deliberately not nested
inside it, so a worktree never shows up as untracked content in `main`.

Status values: `active` → `merged, pending cleanup` → row deleted once
`git worktree remove <path>` runs.
