# Wave 2 — execution plan and per-track briefs

**This file is the source of truth for Wave 2 execution.** Every agent
dispatched in this wave works from its own track section below and from
nothing else operational. The operator (the orchestrating session) owns this
file and edits it as reality changes — if an agent's brief and this file
disagree, this file wins; if this file and `specs.md` disagree on _behavior_,
`specs.md` wins and this file gets fixed.

Relationship to the other docs:

- `specs.md` — authoritative for behavior/decisions, permanently. Each track's
  **Spec** block below is written in `specs.md` §10 template form on purpose:
  when the track merges, the operator folds it into `specs.md` §10 verbatim.
  That is why a track does not need to write its own §10 section.
- `docs/waves.md` — the sequencing/status board and worktree log. Kept short;
  it links here for Wave 2 detail.
- `AGENTS.md` — the coding rules. Binding for every agent, no exceptions.

---

## 0. Scope decision for this wave

Wave 2 ships **Tracks I, E1, K, J, L, E2, E3, E4** (below).

**Tracks F (Movement/Add sheet + Voice), G (Tags/Profile/Settings) and H
(Groups/Áreas) are explicitly deferred to Wave 3** by operator/user decision.
Nothing in Wave 2 may start implementing them; where a Wave 2 screen needs to
point at one of them, it renders a disabled affordance carrying a
`// STUB(trackF|trackG|trackH): <what the real impl needs>` comment, per the
stub convention in `docs/ui/implementation-plan.md`.

### Why the Toast (Track K) is still in this wave even though its consumer moved to Wave 3

`specs.md` §12 justifies the Toast as "build it before the screen tracks so
four parallel tracks don't invent four error surfaces." With F/G/H deferred,
Wave 2's screens (Home, Search, History) are **read-only** — no failed write
needs a home, so that justification technically lapses for this wave.

It stays anyway, and the reason is different: **Wave 3 is three tracks (F, G,
H) that all need it.** Building it now is what lets Wave 3 start all three in
parallel on day one instead of serializing behind a shared-surface track. A
blocker built one wave early is the cheapest kind of parallelism.

---

## 1. Operating rules for this wave (read before anything else)

These are Wave 2 amendments to `AGENTS.md` § Working in parallel. They exist
to remove whole classes of merge conflict rather than resolve them one by one.

### 1.1 The operator creates worktrees, not the agents

Agents do **not** run `git worktree add` and do **not** edit `docs/waves.md`.
The operator creates each worktree, logs its row in `docs/waves.md`, merges the
branch, removes the worktree, and clears the row. An agent works inside the
directory it is given and never leaves it.

### 1.2 Shared docs are operator-owned this wave

An agent must **not** edit any of these, even though `AGENTS.md` would normally
ask it to:

| File                                       | Why                                              |
| ------------------------------------------ | ------------------------------------------------ |
| `specs.md`                                 | 137 KB, 3 append anchors, 8 tracks               |
| `docs/waves.md`                            | one shared table, every track appends to it      |
| `docs/wave-2-plan.md` (this file)          | operator's control surface                       |
| `ARCHITECTURE.md`                          | one shared list                                  |
| `AGENTS.md`                                | one shared rule set                              |
| existing `README.md` of an existing folder | e.g. `src/lib/README.md` — many tracks add to it |

Instead, each track writes everything it wants recorded into **one file it
alone owns**: `docs/wave-2/<track-id>.md` (create it; it is part of the
track's diff). The operator folds it into the real docs on `main` after the
merge. Structure it as:

```markdown
# <track id> — report

## Decisions made (for specs.md §11)

## Backlog / deferred (for specs.md §12)

## Doc lines to add (say exactly which file and where)

## Spec deltas (anything where the brief below turned out wrong)

## Open questions for the operator
```

A **new** `README.md` for a **new** directory the track creates (e.g.
`src/features/search/README.md`) is a new file, has no conflict, and **is**
the track's job — write it.

### 1.3 Frozen files — ask the operator, never edit unilaterally

`src/lib/schema.ts`, `src/styles/index.css`, `.oxlintrc.json`,
`package.json`/`bun.lock` (except Track I), `src/lib/db.ts`, `src/lib/repo.ts`,
`src/lib/pinLock.ts` (except Track J), `src/components/ui/**`.

If a track believes it needs one of these, it **stops and reports** rather than
editing. Needing a new design token or a schema field is a real signal, not a
blocker to route around.

### 1.4 The done-gate

`bun run check` (typecheck + lint + lint:units + test) must pass, with the real
output pasted in the track's final report. A track that reports green without
having run it has failed the task regardless of the code.

### 1.5 Questioning the brief is part of the job

Every brief below is an argument written by the operator with incomplete
information. If a track finds the scoping wrong, an assumption false, or a
better/simpler/more idiomatic approach, it says so **before** implementing —
with reasoning. `AGENTS.md` § How every agent works is binding here.

### 1.6 Locale keys

Track I pre-creates the namespace skeleton for the whole wave, so later tracks
add keys **inside an existing namespace object** rather than all appending to
the end of the same file. Namespaces reserved up front:
`common`, `auth`, `driveConsent`, `toast`, `nav`, `home`, `search`, `history`.

---

## 2. Sequencing

Stages are barriers: every branch in a stage merges to `main` and passes
`bun run check` on `main` before the next stage is dispatched.

| Stage | Tracks (parallel)                                       | Depends on                                        |
| ----- | ------------------------------------------------------- | ------------------------------------------------- |
| **1** | **I**, **E1**                                           | `main` as of Wave 1                               |
| **2** | **K**, **J**, **L**                                     | I (i18n, `main.tsx`, auth screens)                |
| **3** | **E2**, **E3**, **E4**                                  | E1 (stats/data), L (shell + routes), K (toast), I |
| **4** | review agents, one per merged track                     | everything merged                                 |
| **5** | operator browser smoke test + human-interaction handoff | stage 4                                           |

Known conflicts and how they are handled:

- `src/features/auth/DrivePermissionScreen.tsx` — I (i18n retrofit) then J
  (restructure). Sequential by stage. **Resolved.**
- `src/main.tsx` — I (i18n init import) then K (mount Toaster). Sequential.
  **Resolved.**
- `src/components/shared/index.ts` — K appends Toast exports, L appends
  `BottomNav`. Same stage, both single-line appends at the end of a barrel.
  Operator merges K first and resolves L's one-line conflict. **Accepted.**
- `src/lib/i18n/locales/*.json` — J and K and L all add keys in stage 2.
  Mitigated by §1.6's pre-created namespaces (edits land in different objects).
  Operator resolves any residual. **Accepted.**
- `src/lib/README.md`, `docs/waves.md`, `specs.md` — operator-owned per §1.2.
  **Eliminated.**

---

## 3. Second-order effects the operator identified up front

Recorded here so a reviewer can check them, and so they are not rediscovered
as bugs.

1. **`LockSettings` falls off the app when Home is rebuilt.** `LockSettings`
   (the PIN-lock dev harness, `specs.md` §12) is today reachable only because
   `Home.tsx` renders it. Track L's new Home shell would silently delete the
   only way to enable/disable the PIN lock. → **Track L moves it to the
   dev-only `/kit` route** and the operator files a §12 item: the lock has no
   production entry point until Track G (Wave 3) builds the real Settings.

2. **No Drive→`Repo` pipeline exists at all.** `bootstrap.ts` creates the
   three JSON files in Drive, and `repo.local.ts` is a dexie-only
   implementation. Nothing reads or writes those Drive files through the
   `Repo` port. Wave 2's screens therefore read the **fake** repo behind one
   explicit swap point (Track E1's `repoProvider.ts`). This is the honest
   state, not a shortcut — but it is a bigger gap than the wave plan implied
   and the operator flags it to the user as the largest Wave 3 candidate.

3. **The locale had no persistence story, and does not need one yet.**
   `docs/waves.md` Track I left "where the chosen locale lives" open, leaning
   toward `Config.preferencias`. Resolved for this wave: **there is no locale
   picker in Wave 2**, so there is nothing to persist — detection from the
   browser is deterministic and repeats identically every boot. Persistence
   (and the `Preferencias` field, and the picker) belongs to Track G in
   Wave 3. This deliberately keeps Track I out of `schema.ts` and out of the
   device DB, which in turn keeps it out of `pinLock.ts`/`authStore.ts` —
   files Track J needs in the same wave.

4. **`Movimiento.monto` is a JS `number`.** Any aggregation that sums it in
   floating point will drift (`0.1 + 0.2`). Track E1 sums in integer minor
   units. Non-negotiable, tested.

5. **ISO date strings must not be parsed with `new Date('yyyy-mm-dd')`.**
   That parses as UTC midnight and shifts the day backwards for every user
   west of UTC — which is every user this app targets (COP, Latin America).
   Track E1 compares/buckets dates as strings or via `date-fns`'
   local-parsing helpers, and proves it with a test run under a negative-offset
   `TZ`.

6. **A toast raised while the app is locked must not queue up and fire on
   unlock.** The lock exists to hide content; a notification about data is
   content, and a stale one appearing seconds later is worse than a dropped
   one. Track K drops them.

---

## 4. Track briefs

Every brief assumes the agent has already read, in this order: `AGENTS.md`,
this file's §1, its own track section, and `specs.md` §4/§5/§7 plus the §10
subsection nearest its work. `docs/error-handling.md` is required reading for
any track that writes a `try` or surfaces a failure.

---

### Track I — i18n scaffolding

- **Branch:** `feat/wave2-i18n` · **Stage 1** · rigor: normal
- **Owns:** `src/lib/i18n/**` (new), `package.json`, `bun.lock`,
  `src/main.tsx`, `src/features/auth/WelcomeScreen.tsx` + its test,
  `src/features/auth/DrivePermissionScreen.tsx` + its test,
  `docs/wave-2/track-i.md` (new)
- **Must not touch:** anything in §1.2/§1.3, `src/features/auth/errorCopy.ts`
  (see below), any other feature folder.

#### Spec

- **Goal:** every user-facing string in the app is looked up from a
  translation table keyed by a stable id, so adding a locale is data, not a
  code change.
- **User story:** as a Brazilian user opening the app for the first time, the
  interface is already in Portuguese without me configuring anything.
- **UI:** none of its own. Two existing screens (`WelcomeScreen`,
  `DrivePermissionScreen`) must render identically to today, sourcing their
  copy from the table.
- **Data touched:** none. **No `schema.ts` change, no IndexedDB, no
  persistence** — see §3.3.
- **Library:** `react-i18next` + `i18next`, bundled JSON (no
  `i18next-http-backend`, no CDN — `AGENTS.md`'s no-CDN rule).
- **Locales:** `es` (neutral Spanish — **base and fallback**), `en`, `es-AR`,
  `pt-BR`.
- **Locale selection:** read `navigator.languages`, map through an explicit
  `Record` (`AGENTS.md`: value→value mappings are lookup tables, never
  `switch`). Exact match wins; then language-subtag match; any unmatched
  Spanish variant → `es`; anything else unmatched → `en`. This mapping is
  pure and separately unit-tested with `navigator.languages` stubbed.
- **Type safety:** the key space is typed via `react-i18next` module
  augmentation off the `es` resource, so `t('does.not.exist')` is a compile
  error. This is the main reason to take the dependency at all — do not skip
  it.
- **Namespace skeleton (create all of them, even empty):** `common`, `auth`,
  `driveConsent`, `toast`, `nav`, `home`, `search`, `history` — see §1.6.
- **Translation coverage:** `es` is complete for the two retrofitted screens.
  `en`, `es-AR`, `pt-BR` must exist as real files with the same key shape;
  translate what you retrofit (it is two screens — do it properly, do not
  ship three files of copied Spanish).
- **Edge cases:**
  - `Suspense` — configure i18next so resources are loaded synchronously
    (they are bundled), `react: { useSuspense: false }`, so no screen flashes
    empty. Prove it with a test that renders `WelcomeScreen` and asserts text
    on first paint.
  - `APP_NAME` interpolation — `DrivePermissionScreen` embeds `APP_NAME` in
    three strings. Keep `branding.ts` the single source: pass it as an
    interpolation value, never bake the brand into a locale file.
  - `errorCopy.ts` (auth) and `errorCopy.ts` (lock) are `Record<message,
copy>` tables whose **keys are error messages, not copy**. Leave the keying
    alone. You may move the Spanish _values_ behind `t()` **only** if the
    tables stay pure functions with the same signature and their existing
    tests (which derive keys from real error construction —
    `docs/error-handling.md` §7) still pass unchanged. **If that gets ugly,
    do not do it** — report it as a follow-up instead. Do not weaken those
    tests.
  - `<html lang>` must track the active locale.
  - Tests must not depend on the runner's ambient locale — force `es` in the
    test setup, and add one test that a different `navigator.languages`
    produces a different render.
- **Done when:** both Wave 1 screens render from the table with all four
  locale files present and key-identical; the detection map is unit-tested;
  `t()` is compile-time key-checked; a `src/lib/i18n/README.md` explains how
  to add a key and a locale; `bun run check` green with output pasted.
- **Out of scope:** any locale picker UI, persistence, `Preferencias.idioma`,
  number/currency/date formatting (that is `Intl` at the call site, not
  i18next), pluralization beyond what the two screens actually need.

#### Report back

The exact replacement wording for `AGENTS.md`'s "user-facing UI copy is
Spanish" line (operator applies it), plus the `src/lib/README.md` line for the
new `i18n/` folder.

---

### Track E1 — aggregation + the screens' data layer

- **Branch:** `feat/wave2-stats` · **Stage 1** · rigor: **high** (money math,
  TDD mandatory per `AGENTS.md`)
- **Owns:** `src/lib/movimientoStats.ts` + `.test.ts`, `src/lib/dataStore.ts` +
  `.test.ts`, `src/lib/repoProvider.ts` + `.test.ts`, `docs/wave-2/track-e1.md`
- **Must not touch:** anything in §1.2/§1.3, `repo.fake.ts`, `repo.local.ts`,
  any component.

#### Spec

- **Goal:** one pure, tested module that derives every number the Home,
  History and Search screens show, and one store that gives all three screens
  the _same_ `Movimiento[]` so their totals cannot disagree (`specs.md` §4:
  views are derived, never stored; `AGENTS.md`: single source of truth).
- **User story:** as a user, the balance on Home, the balance in History for
  the same month, and the sum of what Search returns are the same number.

##### `movimientoStats.ts` — pure functions only, no imports from stores/UI

Required surface (names are a proposal; argue if you have better, but keep it
pure and keep `Periodo` from `schema.ts`):

- `periodRange(periodo: Periodo, anchor: string, primerDiaSemana: 0 | 1)` →
  `{ from: string; to: string }` inclusive ISO `yyyy-mm-dd` bounds.
- `filterByRange(movimientos, { from, to })`.
- `totals(movimientos)` → `{ ingresos: number; gastos: number; balance: number }`
  where `balance = ingresos - gastos` and every `monto` is positive in the
  input (the sign comes from `tipo` — `specs.md` §4).
- `breakdownBy(movimientos, 'seccion' | 'categoria', tipo?)` → array of
  `{ key, total, share }` sorted by `total` desc, `share` summing to 1
  (guard the empty/zero case — no `NaN`, no division by zero).
- `series(movimientos, periodo, range, primerDiaSemana)` → one bucket per
  sub-period with `{ bucketStart, ingresos, gastos }`, **including empty
  buckets** (a week with no movements still needs seven bars).

**Money rule (non-negotiable):** accumulate in integer minor units —
`Math.round(monto * 100)` in, divide once on the way out. A test must prove
that summing values like `0.1` and `0.2` (and a realistic COP set) yields an
exact result, and must fail if someone reverts to naive `+=` on floats.

**Date rule (non-negotiable):** `fecha` is an ISO `yyyy-mm-dd` string. Never
`new Date('2026-08-19')` — that is UTC midnight and shifts the day for every
negative-offset timezone. Compare as strings, or parse with a local-time
helper. A test must run under a negative-offset `TZ` (e.g. `America/Bogota`)
and prove a movement dated on a month boundary lands in the right month.

**Week rule:** week boundaries respect `Config.preferencias.primerDiaSemana`
(`0` Sunday / `1` Monday). Tested both ways.

##### `dataStore.ts` — zustand

- Holds `movimientos`, `activos`, `config`, plus `status`
  (`'idle' | 'loading' | 'ready' | 'error'`) and `error`.
- `load()` is idempotent and race-safe (a second call while loading does not
  fire a second read — the `restore()` guard in `authStore.ts` is the
  in-repo precedent for how to do this; read it).
- Owns its own error handling entirely — a component calling
  `void dataStore.load()` must never need a `try`
  (`docs/error-handling.md` §7). Failure lands in `error` as a code/state,
  never a raw `.message` for the UI to render.
- Replaces state immutably (`AGENTS.md`), never mutates arrays in place.
- **No derived values stored.** Totals come from `movimientoStats` at the
  call site (or a selector), never cached on the store — that is the exact
  drift `specs.md` §4 forbids.

##### `repoProvider.ts` — the single swap point

- Exports `getRepo(): Repo`, returning the shared **fake** repo today, with a
  `// STUB(wave3): swap to the Drive-backed Repo once one exists — see
docs/wave-2-plan.md §3.2` marker. One file, one line to change later.
- **Do not** add environment branching, lazy imports, or a registry. One
  honest line beats a configurable indirection nobody has a second
  implementation for yet.

- **Edge cases:** empty dataset everywhere (no movements at all); a single
  movement; all-income and all-expense months; a period with a boundary
  movement at exactly `from` and exactly `to` (both inclusive); `share` when
  the total is 0.
- **Done when:** every function above has tests written **before** its
  implementation (`AGENTS.md` TDD rule — the report must state which test you
  watched fail first and why it failed); the money and timezone tests exist
  and are meaningful; `bun run check` green with output pasted.
- **Out of scope:** anything touching `Activo` beyond storing it in the store,
  charts, formatting (`Intl` belongs at the render site), and any component.

---

### Track K — Toast, the global notification surface

- **Branch:** `feat/wave2-toast` · **Stage 2** · rigor: normal
- **Owns:** `src/lib/toastStore.ts` + `.test.ts`,
  `src/components/shared/Toaster.tsx` + `.test.tsx`,
  `src/components/shared/Toast.tsx` (if you split it) + test,
  `src/components/shared/index.ts` (append exports),
  `src/features/lock/AppLock.tsx` + its test, `src/main.tsx`,
  the `toast` namespace in `src/lib/i18n/locales/*.json`,
  `docs/wave-2/track-k.md`
- **Must not touch:** anything in §1.2/§1.3, any other shared component,
  `lockStore.ts`.

#### Spec

**`specs.md` §10.6 is the spec — read it in full; it is already written.**
This brief only records the decisions §10.6 explicitly left to the builder,
so you implement them rather than re-deciding them:

- **Stack cap: 3 visible.** A 4th arrival drops the **oldest** immediately
  (not queued — §10.6's "dropped, not queued indefinitely").
- **Durations:** success 4 s, error 7 s. Each toast owns its own timer; a new
  arrival never touches an existing one's countdown.
- **Duplicate collapse:** an identical `(variant, message)` pair already in the
  stack does **not** add a card — it increments that card's count and **resets
  that one card's timer**. Note the tension with "a later arrival never resets
  an earlier one": that rule is about _distinct_ toasts; a re-raised identical
  message is the same notification happening again, so restarting its own
  clock is the intended reading. If you disagree, argue it before building.
- **Lock interaction:** the `Toaster` renders inside `AppLock` and only while
  `phase !== 'locked'`. A toast raised **while locked is dropped, not
  queued** — see §3.6. Test both: nothing renders over `LockScreen`, and
  nothing appears after unlocking.
- **Public API:** plain functions importable from anywhere with no provider
  and no React context — `toast.success(message)`, `toast.error(message)`.
  Callers pass **already-localized** copy (`t('…')`); the toast never looks up
  copy itself and **never renders a raw `error.message`**
  (`docs/error-handling.md` §5/§7).
- **`AppErrorBoundary` / `RouteErrorFallback` must keep working** — the
  `Toaster` mounting in `main.tsx`/`AppLock` must not end up outside the error
  boundary. Read `main.tsx` before moving anything.
- **Touch:** swipe-to-dismiss via **Pointer Events** with a deliberate
  `touch-action` (`AGENTS.md` § UI), not mouse/touch handler pairs.
- **A11y:** `role="alert"` for errors, `role="status"` for confirmations;
  dismissal always reachable by keyboard (WCAG 2.2.1); it never traps focus.
- **Style:** `--color-success*` / `--color-danger*` and the existing
  `animate-*` tokens only. **No new tokens** (§1.3) — if the design needs one,
  stop and report.
- **Done when:** every "Done when" bullet in `specs.md` §10.6 is met and
  demonstrated by a test, plus the decisions above; `bun run check` green with
  output pasted.
- **Out of scope:** undo affordances, persistence, any queue outliving the
  session, and **any consumer** — nothing in Wave 2 raises a toast. Add a
  demo in `/kit` (dev-only route) so it is exercisable by hand; do not wire it
  into a real screen.

---

### Track J — Drive-permission screen refinements + device-scoped decision

- **Branch:** `feat/wave2-drive-consent` · **Stage 2** · rigor: **high**
  (auth-adjacent, touches `pinLock.ts` and `authStore.ts`)
- **Owns:** `src/features/auth/DrivePermissionScreen.tsx` + test,
  `src/features/auth/RequireAuth.tsx` + test, `src/lib/authStore.ts` + test,
  `src/lib/deviceStore.ts` (renamed from `loginMarker.ts`) + test,
  `src/lib/pinLock.ts` **(import path only)** + its test's import,
  the `driveConsent` namespace in the locale files, `docs/wave-2/track-j.md`
- **Must not touch:** anything else in §1.2/§1.3; `src/lib/db.ts` (the
  `kurobello` DB with the frozen vault) is **not** where this goes; no new
  OAuth scope, ever (`specs.md` §7).

#### Spec

Three changes, from `docs/waves.md` Track J:

1. **Trim to one permission item.** Drop the "No accede a tus otros archivos"
   card; keep only "Crear y editar sus propios archivos".
2. **Make the remaining item more prominent.** Its body text steps up one type
   token (`--text-sm` → `--text-ms`) and its icon badge grows to match. It now
   carries the whole message alone, so it should read heavier than before —
   not identical.
3. **Persist the decision per device — ask once, not once per session.**
   - **Why:** `driveOptIn` is in-memory zustand (`specs.md` §11, 2026-08-18,
     "in-memory, per-session, never persisted"). That was defensible when
     every cold start rebuilt the identity session anyway. It no longer is:
     with the PIN lock's cached vault and `hydrate()`, a user who already
     connected — or already said "Ahora no" — sees this screen again on every
     reopen. **This supersedes that §11 entry**; say so in your report.
   - **Where:** device-scoped IndexedDB. **Not** `localStorage`/
     `sessionStorage` (`specs.md` §7). **Not** `Config` — a user who dismissed
     Drive has no Drive to store a Config preference in. **Not** `db.ts` — its
     `v1` vault table is frozen.
   - **How (operator decision, argue if wrong):** `src/lib/loginMarker.ts`
     already owns exactly the right thing — a separate tiny Dexie database
     `kurobello-device` for non-secret, per-device signals — but its name now
     under-describes it. **Rename the module to `src/lib/deviceStore.ts`**,
     keep the DB name `kurobello-device` **frozen** (renaming it orphans the
     login marker and silently forces a re-login for every existing user), and
     add the drive decision as a second row/table alongside the login marker.
     Update the two importers (`authStore.ts`, `pinLock.ts`) and the tests.
     One device-signal module beats a third Dexie database.
   - **Semantics:** persist `'connected' | 'dismissed'`; absence means "never
     asked" → show the screen. `RequireAuth` must read it before deciding to
     render `DrivePermissionScreen`, without flashing the screen during the
     async read — decide and implement a deliberate loading state rather than
     letting it flicker.
   - **Failure posture:** a storage read that throws must degrade to "no
     decision recorded" (show the screen) and a write that throws must not
     fail the Drive connection it rides on — the same best-effort posture
     `loginMarker.ts` already documents. Follow that file's existing comments;
     they explain the reasoning.
   - **Clearing:** logging out, and `pinLock.resetVault()` (which already
     clears the login marker), must clear the Drive decision too — otherwise a
     lockout-forced re-login lands a different account on the previous
     account's answer. **Check this; it is the kind of twin-shape bug
     `AGENTS.md` calls the project's most expensive lesson.**
4. **Reassurance line near "Ahora no."** Spanish copy along the lines of
   _"Podés continuar sin vincular tu Drive — más adelante podés hacerlo desde
   tu Perfil."_ It promises a Profile row that Track G (Wave 3) will build;
   that is fine, the promise ships first. Wording is yours — keep it one short
   line, and put it in the `driveConsent` namespace in all four locales.

- **Edge cases:** two tabs open, one connects and the other has the screen up;
  a decision recorded but `connectDrive` later fails (the recorded state must
  reflect what actually happened, not what was attempted); the user dismisses,
  then logs out and logs in as a different Google account on the same device.
- **Done when:** the screen shows one enlarged item plus the reassurance line;
  the decision survives a reload and a lock/unlock cycle; it is cleared on
  logout and on vault reset; every path is tested; `bun run check` green with
  output pasted.
- **Out of scope:** the Profile "Drive" row itself (Track G), any change to
  `connectDrive`'s OAuth behavior, any new scope.

---

### Track L — app shell: bottom nav, routes, FAB

- **Branch:** `feat/wave2-shell` · **Stage 2** · rigor: normal
- **Owns:** `src/router.tsx`, `src/routes/Home.tsx` (shell/layout only — the
  dashboard **content** is Track E2), `src/routes/Kit.tsx`,
  `src/components/shared/BottomNav.tsx` + test,
  `src/components/shared/index.ts` (append one export),
  `src/features/search/SearchScreen.tsx` (placeholder, handed to E3),
  `src/features/history/HistoryScreen.tsx` (placeholder, handed to E4),
  the `nav` namespace in the locale files, `docs/wave-2/track-l.md`
- **Must not touch:** anything in §1.2/§1.3; `AppLock.tsx`/`main.tsx` (Track K
  has them this stage); any dashboard content.

#### Spec

- **Goal:** the navigation skeleton the three screen tracks plug into, so
  E2/E3/E4 can be built in parallel without any of them owning the router.
- **UI:** pull the current design fresh via `DesignSync get_file` on
  `Moneta.dc.html` in project `18d93152-c2e6-4bde-8eff-f944b1537ad8` and build
  the bottom nav from it (icons mapped Phosphor→Lucide 1:1, see
  `docs/ui/design-tokens.md`).
- **Routes:** `/` (Home), `/search`, `/history` — all inside `RequireAuth`,
  each with the existing `errorElement`. History is designed as a full-screen
  overlay; implement it as a **route** using the `--animate-push-in` token so
  it reads as a native push, not a web modal (`AGENTS.md` § UI). If you think
  overlay-state-on-Home is genuinely better, argue it before building.
- **Placeholders:** `SearchScreen.tsx` and `HistoryScreen.tsx` render a
  minimal, honest empty screen (title + back affordance) so the routes work.
  Tracks E3/E4 replace their bodies in stage 3 — keep each file's default
  export name and props stable and say what they are in your report.
- **FAB:** render it per the design, **disabled**, with
  `// STUB(trackF): opens the Add-movimiento sheet` and an `aria-label`. It
  must not be a dead enabled button.
- **`LockSettings` move (§3.1):** `Home.tsx` currently renders `LockSettings`,
  which is the **only** way to enable/disable the PIN lock. Moving it is not
  optional cleanup — dropping it silently removes the feature. Move it into
  the dev-only `/kit` route and confirm by hand (or by test) that it still
  works there.
- **Touch/a11y:** targets ≥ 44 px, safe-area insets respected
  (`env(safe-area-inset-bottom)`), the active tab exposed to assistive tech
  (`aria-current="page"`), Pointer Events not mouse/touch pairs, no
  hover-only affordance.
- **Units:** `bun run lint:units` fails on any arbitrary px length — use `rem`,
  `dvh`/`dvw`, and the token scale.
- **Done when:** all three routes render and the nav moves between them; the
  FAB is visibly present and inert; `LockSettings` is reachable at `/kit`;
  nav labels come from the i18n table in all four locales; `bun run check`
  green with output pasted.
- **Out of scope:** any dashboard content, search logic, history logic, the
  Add sheet.

---

### Track E2 — Home dashboard content

- **Branch:** `feat/wave2-home` · **Stage 3** · rigor: normal
- **Owns:** `src/features/home/**` (new), `src/routes/Home.tsx` (content
  inside the shell L built), the `home` namespace in the locale files,
  `docs/wave-2/track-e2.md`
- **Must not touch:** `src/router.tsx`, `BottomNav.tsx`, `src/features/search/**`,
  `src/features/history/**`, anything in §1.2/§1.3.

#### Spec

Build the dashboard from `docs/ui/implementation-plan.md` § Home, against the
**fresh** design pulled via `DesignSync` (the design is a living document —
re-pull, do not trust a snapshot).

- Greeting header + notification bell → `StubNotifications`, **no unread
  dot**: there is no notification source, and a fake dot is a lie the user
  will act on. `// STUB(wave3)`.
- Search entry → navigates to `/search` (route exists from Track L).
- Calendar strip + balance card: week-day strip, balance total with a
  hide/show toggle, income/expense mini-totals. **Real** numbers from
  `movimientoStats` + `dataStore` (Track E1) — never a hardcoded figure.
- Weekly bar chart — real, same source, `recharts` (already a dependency).
  Respect `prefers-reduced-motion`.
- "Áreas" banner → renders, does not navigate, `// STUB(trackH)`.
- Recent movimientos → `MovimientoRow` from `@/components/shared`.
- **Formatting:** `Intl.NumberFormat` with the active locale and
  `Config.preferencias.monedaPrincipal` — not a hand-rolled formatter, and
  not baked into a locale file. Check `movimientoView.ts`'s existing
  `formatMonto` first (`AGENTS.md`: search before you write).
- **States:** loading, empty (no movements at all), and error — all three
  designed and rendered, not just the happy path. An error from `dataStore`
  lands inline on this screen (it owns the load), not in a toast
  (`docs/error-handling.md` §7).
- **Component size:** extract hooks/subcomponents into `src/features/home/`
  rather than growing one large `Home.tsx` (`AGENTS.md` § Architecture).
- **Done when:** every number on screen traces to `movimientoStats`; the three
  states render; a test asserts Home's total equals `totals()` for the same
  range (this is the cross-screen consistency guarantee); `bun run check`
  green with output pasted.

---

### Track E3 — Search + Filter sheet

- **Branch:** `feat/wave2-search` · **Stage 3** · rigor: normal
- **Owns:** `src/features/search/**` (replacing L's placeholder), the `search`
  namespace in the locale files, `docs/wave-2/track-e3.md`
- **Must not touch:** `src/router.tsx`, `src/routes/**`,
  `src/features/history/**`, anything in §1.2/§1.3.

#### Spec

From `docs/ui/implementation-plan.md` § Search, against the freshly pulled
design.

- Search input (debounced), active filter chips, results as `MovimientoRow`,
  and a real empty state ("no results" ≠ "no data" — they are different
  screens and both must exist).
- **Filter sheet** in a `BottomSheet`: date-range presets + calendar
  (`DateChipPicker`), type filter (`SegmentedControl`), tag/category filter
  (`TagChip`, multi-select).
- Reads through `dataStore` (Track E1) — **never its own repo call**, or
  Search's numbers drift from Home's.
- Matching is client-side over the loaded set: case- and accent-insensitive
  (`localeCompare`/`Intl.Collator` or `String.normalize('NFD')` — a Spanish
  app where "camion" does not find "camión" is broken). Test that case.
- Filter state lives in the URL query string if it is cheap to do so
  (shareable/back-button-correct); if you judge it not worth it, say why in
  the report rather than silently skipping it.
- Sheet interaction follows `AGENTS.md` § UI: Pointer Events, `animate-sheet-up`,
  `useOverlay`'s existing stack (read `src/components/shared/useOverlay.ts` —
  it already solves nesting, Escape, focus and scroll lock; do not
  reimplement).
- **Done when:** typing filters results; each filter narrows correctly and
  combines with the others; clearing restores everything; both empty states
  render; accent-insensitivity tested; `bun run check` green with output
  pasted.

---

### Track E4 — History

- **Branch:** `feat/wave2-history` · **Stage 3** · rigor: normal
- **Owns:** `src/features/history/**` (replacing L's placeholder), the
  `history` namespace in the locale files, `docs/wave-2/track-e4.md`
- **Must not touch:** `src/router.tsx`, `src/routes/**`,
  `src/features/search/**`, anything in §1.2/§1.3.

#### Spec

From `docs/ui/implementation-plan.md` § History, against the freshly pulled
design.

- Year menu, scope `SegmentedControl` (day/week/month/year → `Periodo` from
  `schema.ts`), and the day/week/month pickers.
- Balance card + "por etiqueta" breakdown with progress bars —
  `breakdownBy()` from Track E1, including its `share` values. Do not compute
  percentages locally.
- Movements list via `MovimientoRow` (pending-badge variant where the design
  shows it) + empty state per scope.
- Period navigation (previous/next) must respect
  `Config.preferencias.primerDiaSemana` — that is `periodRange()`'s job, not
  yours; call it.
- Reads through `dataStore`, same instance as Home and Search.
- **Done when:** switching scope and stepping through periods produces
  correct, non-drifting numbers; a test asserts History's month total equals
  Home's for the same month (the cross-screen guarantee, from the other
  side); empty states render; `bun run check` green with output pasted.

---

## 5. Review stage (stage 4)

One review agent per merged track, dispatched after **all** build tracks are
merged — deliberately at the end, not per-merge, so a reviewer never files
findings against code a later stage rewrites.

Each review agent gets: the track's diff (`git log`/`git diff` for its
branch), its brief above, and `AGENTS.md` § How every agent works. It must:

1. Verify the "Done when" list is actually met — running the commands, not
   reading them.
2. Look for the **shape** of any defect it finds elsewhere in its area, and
   report what the sweep found, including "nothing else."
3. Separate CONFIRMED (traced or reproduced — say which) from PLAUSIBLE.
4. Apply fixes that are clearly correct and in-scope; **ask the operator**
   for anything that is a judgment call, cross-cutting, or would widen scope.
5. Not pad the report.

## 6. Human-interaction backlog (stage 5)

Anything that needs a real person in a real browser gets collected here by the
operator instead of being faked or skipped, for the user to run on return.
Current standing item from `specs.md` §12: verifying `connectDrive` against a
live Google account (needs a human in the OAuth popup).

---

## 7. Live status

| Track | Branch                     | Stage | Status      |
| ----- | -------------------------- | ----- | ----------- |
| I     | `feat/wave2-i18n`          | 1     | dispatched  |
| E1    | `feat/wave2-stats`         | 1     | merged      |
| K     | `feat/wave2-toast`         | 2     | not started |
| J     | `feat/wave2-drive-consent` | 2     | not started |
| L     | `feat/wave2-shell`         | 2     | not started |
| E2    | `feat/wave2-home`          | 3     | not started |
| E3    | `feat/wave2-search`        | 3     | not started |
| E4    | `feat/wave2-history`       | 3     | not started |

Status values: `not started` → `dispatched` → `reported, verifying` →
`merged` → `reviewed`.
