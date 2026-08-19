# Wave 3 — operator plan (foundations)

`docs/waves.md` says _which_ tracks exist and in what order. `specs.md`
§10.11–§10.18 says _what each one must do_ (and each carries a **Blast
radius** line that is binding). **This file is the execution surface**: file
ownership, staging, the conflicts the operator resolved up front, and the
per-track briefs.

Precedence: `specs.md` (behavior) > this file (execution) > `docs/waves.md`
(status board). Same rule Wave 2 used.

---

## 0. What this wave is, in one paragraph

Wave 3 builds **plumbing, not screens**. The app keeps reading the fake repo
(`repoProvider.getRepo()` still returns `fakeRepo` — the stub flip is
deliberately **not** in this wave, see `specs.md` "Wave 3 — staging and
dependencies"). What changes is that by the end of it: the app opens and
navigates **without a network**, local data is **scoped to a profile** so real
data has a correct home the day it arrives, there is **one write path** instead
of three invented ones, there are **form primitives** to build Wave 4's sheets
with, a deploy can't break an open tab, and there is a **door** (the profile
sheet) for all of it to live behind.

The user's framing for this wave, recorded so no track re-derives it:
_"tomar parte del funcionamiento offline para que sea posible navegar mostrando
por ahora los datos stub, pero que tengamos todo listo para cuando llegue la
data real"_ — plus an explicit instruction to **over-engineer the structure**.

### What "over-engineer" means here, and what it does not

It is a licence to build the **seam properly**, not to grow the diff:

- ✅ Real abstractions with real boundaries (a store that owns one concern; a
  pure module with no store/UI imports; a parameterised factory instead of a
  module-level singleton).
- ✅ Exhaustive typing over hand-waving: a `Record<Union, X>` that fails to
  compile when the union grows, not a `switch` with a `default`.
- ✅ Tests that pin the invariant, not just the happy path — including the
  failure and rollback paths.
- ✅ Documented _why_ on anything non-obvious, per `AGENTS.md`'s comment rule.
- ❌ **Not** more surface: no speculative options nobody passes, no config
  knobs with one caller, no abstraction over a single implementation "in case".
  Wave 2's most valuable review findings were a duplicated table and a
  defaulted parameter nobody passed — both are the failure mode of exactly
  this instruction taken too far.
- ❌ **Not** more files than the blast radius allows. A track that touches
  more than `specs.md` says has misunderstood the job, and that rule survives
  the over-engineering instruction intact.

---

## 1. Operating rules for this wave

Wave 3 amendments to `AGENTS.md` § Working in parallel. Carried over from
`docs/wave-2-plan.md` §1 because they worked; the deltas are marked **[new]**.

### 1.1 The operator creates worktrees, not the agents

Agents do **not** run `git worktree add`, do **not** create branches, and do
**not** edit `docs/waves.md`. The operator creates each worktree, logs its row,
merges, removes the worktree and clears the row. An agent works inside the
directory it is given and never leaves it.

### 1.2 Shared docs are operator-owned

An agent must not edit these, even though `AGENTS.md` would normally ask it to:

| File                              | Why                                       |
| --------------------------------- | ----------------------------------------- |
| `specs.md`                        | 200 KB+, several append anchors, 8 tracks |
| `docs/waves.md`                   | one shared table                          |
| `docs/wave-3-plan.md` (this file) | operator's control surface                |
| `ARCHITECTURE.md`                 | one shared list                           |
| `AGENTS.md`                       | one shared rule set                       |
| `src/lib/README.md`               | four of five stage-1 tracks add a line    |
| `src/components/shared/README.md` | contended in later stages                 |

Everything a track wants recorded goes in **one file it alone owns**:
`docs/wave-3/<track-id>.md`, created as part of the track's own diff:

```markdown
# Track <id> — report

## Decisions made (for specs.md §11)

## Backlog / deferred (for specs.md §12)

## Doc lines to add (exact file, exact place, exact text)

## Spec deltas (where this brief or §10.x turned out wrong)

## Open questions for the operator

## `bun run check` output (pasted, real)
```

A **new** `README.md` for a **new** directory the track creates is a new file,
has no conflict, and **is** the track's job — write it.

**[new] The operator applies "Doc lines to add" in the track's own merge
commit, never in a batch at the end.** This is the review-protocol §5 rule that
Wave 2.2 paid for: five sets of README drafts sat unapplied at once and two
were already wrong about the code they described. If a draft is ever applied
late anyway, every line gets verified against the current code first.

### 1.3 Frozen files — stop and report, never edit unilaterally

`src/lib/schema.ts`, `src/styles/index.css`, `.oxlintrc.json`,
`src/lib/repo.ts` (the port contract), and **any file owned by another track in
the same stage** (§2's ownership table is the authority).

`package.json` / `bun.lock`: **Track U only** this stage.

Needing a frozen file is a real signal, not a blocker to route around. Say so
and stop.

### 1.4 The done-gate

`bun run check` (typecheck + lint + lint:units + test) must pass, with the real
output pasted in the track's report. A track that claims green without running
it has failed the task regardless of the code.

### 1.5 Questioning the brief is part of the job

Every brief below is an argument written by the operator with incomplete
information. If the scoping is wrong, an assumption false, or a simpler/more
idiomatic approach exists, say so **before** implementing, with reasoning.
`AGENTS.md` § How every agent works is binding.

### 1.6 No screens this stage

Stage 1 ships **zero new screens**. Track R touches three existing screens'
_error branches only_ — no layout, no new component on them. Track U's
components are exercised in `/kit` (dev-only) and nowhere else. If a track
finds itself designing a screen, it has drifted; stop and report.

This also means **no track needs the design canvas this stage**, which is why
`DesignSync` — unavailable to subagents anyway (`docs/wave-2-plan.md` §1.6) —
does not appear in any stage-1 brief.

### 1.7 Locale keys

Four locale files, key-parity enforced by `src/lib/i18n/resources.test.ts`: a
key added to `es.json` alone fails `bun run check`. Every track translates its
own keys into `en`, `es-AR` and `pt-BR` — copy-pasted Spanish is not a
translation.

**Namespace reservations for stage 1** (edits land in different objects, so the
same file is safe for two tracks):

| Track | May add keys under                                                                          |
| ----- | ------------------------------------------------------------------------------------------- |
| R     | `common.*`, a new top-level `errors.*`, and the `auth`/`home`/`search`/`history` namespaces |
| W     | a new top-level `update.*` namespace, and `toast.*`                                         |
| S     | none — no UI this wave                                                                      |
| U     | none — `/kit` is dev-only and `ConfirmDialog` takes its copy as props                       |
| V     | none — no UI this wave                                                                      |

### 1.8 Storage identifiers are frozen

`AGENTS.md` is binding: the Drive folder `KuroBello`, the dexie DB `kurobello`,
the device DB `kurobello-device`, the lock HKDF info `kurobello-lock-dek`, the
package name. Track V **adopts** the existing `kurobello` database as the first
profile — it does not rename or migrate it. Any new database name is a
**suffix** on the frozen base.

---

## 2. Stage 1 — file ownership (the conflict map)

Five tracks, dispatched together. Ownership is exclusive: if a file is listed
under a track, no other stage-1 track may open it for writing.

| Track          | Owns (writes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R** (§10.11) | `src/lib/authStore.ts` (+test), `src/lib/lockStore.ts` (+test), `src/lib/pinLock.ts` (+test), `src/lib/networkStore.ts` (new +test), `src/lib/errorCopy.ts` (new, moved from `features/home`), `src/features/home/errorCopy.ts(+test)` (deleted), the error branches of `Home.tsx` / `SearchScreen.tsx` / `HistoryScreen.tsx` and their error-state components, `src/features/auth/errorCopy.ts` (+test), `src/features/lock/errorCopy.ts` (+test), `src/features/{auth,home,search,history,lock}/README.md`, locale files (§1.7) |
| **S** (§10.12) | `src/lib/export/**` (new folder: module, delivery, tests, `README.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **U** (§10.14) | `src/components/ui/**` (additive), `src/components/shared/TextField.tsx` / `AmountField.tsx` / `ConfirmDialog.tsx` (+tests), `src/components/shared/index.ts`, `src/routes/Kit.tsx` (+test), `src/components/ui/README.md`, `package.json` / `bun.lock`                                                                                                                                                                                                                                                                           |
| **V** (§10.15) | `src/lib/db.ts` (+test), `src/lib/repo.local.ts` (+test), `src/lib/repoProvider.ts` (+test), `src/lib/profiles/**` (new folder + `README.md`)                                                                                                                                                                                                                                                                                                                                                                                     |
| **W** (§10.16) | `vite.config.ts`, `src/lib/swUpdate.ts` (new +test), `src/main.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 2.1 The three conflicts the operator resolved up front

**These are decisions, not suggestions. A track that "fixes" one of them
re-opens a conflict the operator already closed.**

1. **`src/lib/db.ts` — V owns it, and R must not touch it.** R needs to cache
   the Google profile alongside the session in the vault (§10.11), which
   _sounds_ like adding columns to `LockVault` in `db.ts`. It must not. R
   extends the **plaintext inside `tokenCipher`** into a versioned envelope
   (`{ v: 2, session, user }`), bumping the vault's own `schemaVersion` and
   decoding the old shape as `{ session, user: null }`. This is both the
   conflict-free path **and** the better design: the profile is PII and stays
   encrypted under the same DEK instead of sitting in a plaintext column
   (`specs.md` §7). Keep the field name `tokenCipher` — renaming a stored
   field buys nothing and costs a migration.

2. **`src/main.tsx` — W owns it, R must not touch it.** R's network store
   therefore **self-initialises at module scope** (attach `online`/`offline`
   listeners on first import, guarded for a non-`window` environment and
   idempotent), rather than needing a bootstrap call in `main.tsx`. It must be
   resettable for tests.

3. **`src/routes/Kit.tsx` — U owns it, exclusively.** Track S ships **no UI
   trigger this wave** (`specs.md` staging table says so explicitly); that is
   what keeps S off `Kit.tsx`. §10.18's profile sheet wires the export button
   in stage 3.

### 2.2 Second-order effects identified up front

Recorded so a reviewer can check them and so they aren't rediscovered as bugs.

1. **`navigator.onLine` lies in one direction.** It reports `true` on a
   connected-but-dead network (captive portal, dead uplink). §10.11 already
   says treat it as a hint; concretely that means the store exposes a way for a
   **failed request to downgrade** the state, and `true` alone never gates a
   user out of anything.

2. **The 7-hour window is anchored to the last successful online validation,
   not to app launch.** That timestamp has to survive a cold boot, so it is
   persisted (device-scoped, like every other device signal) — an in-memory
   anchor resets to "just validated" on every reopen and the window never
   fires. This is the single easiest thing to get wrong in Track R.

3. **`dataStore.load()` short-circuits once `status === 'ready'`** (load once
   per session, Wave 2 decision). Wave 3's writes update store state directly
   rather than refetching. Do not add a refetch path — that is Track T's rule
   and stage 1 must not pre-empt it.

4. **A repo instance memoises `ready()` per database** (`repo.local.ts`'s
   `readyPromises` WeakMap is keyed on the `db` object, not the repo instance).
   That design already anticipates Track V's per-profile databases — V should
   confirm it holds rather than assume, and keep the memo keyed per database.

5. **Track U's `AmountField` must not be `<input type="number">`.** Native
   spinners, no control over locale grouping, and `valueAsNumber` ignores the
   locale's decimal separator entirely. `inputMode="decimal"` on a text input,
   parsed through the locale (`src/lib/i18n/localeFormatting.ts`), is the
   answer — `specs.md` §10.14 says "never a hand-rolled parser" and
   `docs/wave-3-audit-surface.md` §3 predicts this exact rediscovery.

6. **Track W flipping `registerType` from `autoUpdate` to `prompt` changes
   real runtime behavior**, not just config. Everything that currently updates
   silently now needs the prompt to actually work, or updates stop arriving.
   Prove the registration module, don't just write it.

7. **Nothing in stage 1 may flip `repoProvider.getRepo()` to a real repo.**
   §10.15 gates it, and Wave 4's create UI is what unblocks it. V builds the
   per-profile real-repo path and **proves it with tests**; the app keeps
   reading the fake. The `// STUB(wave3)` line stays a stub.

### 2.3 Backlog items stage 1 is expected to close

From `specs.md` §12. Only these; anything else stays in the backlog.

- **Track R:** `authGeneration` is honoured by one of five async auth paths —
  R is rewriting those paths anyway, so it closes the inconsistency. Also
  **evaluate** `logout()` not re-locking the vault (a same-tab logout leaves
  the DEK in memory): fix it if it doesn't create an `authStore ↔ lockStore`
  import cycle; **report instead of forcing** if it does.
- **Explicitly NOT in stage 1:** the lock's full i18n retrofit (`LockScreen`,
  `LockSettings`, `errorCopy`). R adds its one new error entry consistent with
  the existing hardcoded table and leaves the retrofit as the §12 item it is —
  R is already the widest track in the stage.

---

## 3. Track briefs

Every brief assumes the agent has read, in this order: `AGENTS.md`, this
file's §1 and §2, its own §10.x spec, and `docs/error-handling.md` if it writes
a `try` or surfaces a failure.

### Track R — §10.11 offline entry, network state, unified error copy

The widest and highest-value track in the stage: it closes a claim `specs.md`
§3 has made since the first commit and today's code contradicts.

**Read first:** `specs.md` §10.11 in full, `docs/wave-3-audit-runtime.md`
finding 1 (the two defects, traced with line references), `specs.md` §5.

**Build:**

1. **`src/lib/networkStore.ts`** — one small zustand store owning online/
   offline. Self-initialising per §2.1(2). `navigator.onLine` is a hint: a
   failed request can downgrade the state (§2.2(1)). It owns the **7-hour
   offline window** too: the anchor is the last successful online validation,
   **persisted** (§2.2(2)) via `deviceStore`'s pattern, and it exposes a
   derived "may this write proceed?" answer rather than making every call site
   re-derive it from a timestamp. Reads no other store; nothing about auth or
   the lock belongs in it.
2. **Fix `authStore.restore()`** — a cold boot with no network must not strand
   a returning user on `WelcomeScreen`.
3. **Fix `authStore.hydrate()`** — `fetchGoogleUser()` becomes a **refresh,
   never a gate**. The vault decrypt already proved identity locally; a profile
   fetch is decoration. Cache the profile in the vault per §2.1(1).
4. **`lockStore.resume()`** must stop turning "correct PIN, no network" into
   `SESSION_RESTORE_ERROR`. The lock's error copy distinguishes wrong-PIN from
   no-network.
5. **Move `src/features/home/errorCopy.ts` → `src/lib/errorCopy.ts`.** It maps
   a global `RepoErrorCode`; it was never Home-specific. All three screens use
   it, so a user with no connection is told the same true thing on all three
   instead of a generic string on two.
6. **Offline permissions:** read everything and **create** movements; no edit,
   no delete, no settings changes. The reasoning is in §10.11 and is worth
   preserving verbatim in a comment where it's enforced: **appends commute,
   mutations don't** — every `id` is a `crypto.randomUUID()`, so two devices
   appending merge cleanly while two devices editing the same row do not.
   Stage 1 has no write path yet (Track T, stage 2), so R ships the **policy
   and its tests**, and T consumes it. Do not build a write path here.
7. **Copy never implies data loss.** §10.11 fixes the shape of the 7-hour
   message; the final wording lives in the i18n table, four locales.

**Edge cases that are part of the definition of done:** expired token + valid
local data (read-only, don't bounce to login); back online mid-session
(revalidate quietly, don't interrupt); a **guest** never sees a reconnect
prompt (`status: 'guest'`, no token, nothing to reconnect).

**Done when** (from §10.11, re-stated as things you can test): airplane mode +
biometric unlock reaches the dashboard with real local data; a create is
permitted offline and a delete is refused with an honest message; past 7 hours
writes are blocked and **reads are not**; all three screens name the actual
failure.

**Blast radius:** §2's ownership row. No screen layout changes. No schema
change. No `db.ts`. No `main.tsx`.

---

### Track S — §10.12 CSV export

**Read first:** `specs.md` §10.12 in full — especially the four numbered
hazards, which exist because each one is cheap to handle before writing the
code and expensive after.

**Build one thing well, with no UI:** a module (suggested `src/lib/export/`,
split as pure serialisation vs. delivery — the split is what makes the
serialiser trivially testable) that turns `Movimiento[]` into a CSV file and
hands it to the user.

**Non-negotiables, all four from the spec:** UTF-8 **BOM**; `;` separator with
a leading `sep=;` line; decimal separator from the active locale
(`src/lib/i18n/localeFormatting.ts` — never a hand-rolled number string, and
consider `useGrouping: false` so a thousands separator can't collide with the
field separator); and **CSV injection escaping** for any value starting with
`=`, `+`, `-` or `@`, because `nota` and category names are user-written free
text. That last one is a security issue, not a formatting nit — treat it that
way, and test it. Dates go out as ISO `yyyy-mm-dd`.

**Mobile is the target:** on iOS a plain `<a download>` typically opens a tab
instead of saving. Use `navigator.share({ files })` where available and fall
back to a download link. The delivery half is where the platform branching
lives; keep it out of the serialiser.

**Also decide and record** (report file, §11 section): what the header row
says. The operator's recommendation is the **schema field names** (`fecha`,
`tipo`, `monto`, `moneda`, `seccion`, …) rather than localized labels — they
are the real Drive column contract (`AGENTS.md`), they're stable across
locales, and a spreadsheet the user re-imports somewhere keeps meaning the same
thing. Disagree with reasoning if you think otherwise.

**Edge cases:** empty dataset → a header-only file, not an error; a large
dataset → build in chunks, not one giant string; the file must **never**
contain the OAuth token, vault material or anything from the lock; the filename
carries a date.

**Blast radius:** one new folder + tests. It reads through the existing `Repo`
port, so it is unaffected by which implementation is active. **No UI trigger
this wave** — §10.18 wires the button in stage 3. Do not touch `Kit.tsx`.

---

### Track U — §10.14 form primitives + confirm dialog

**Read first:** `specs.md` §10.14, `docs/wave-3-audit-surface.md` §3 (which
traces exactly what's missing), `AGENTS.md` § UI and § Coding rules.

**Build:**

1. `input` and `label` from shadcn (`bunx shadcn@latest add input label`), then
   **normalise them**: the generator emits `import * as React` and `function`
   declarations; `import/no-namespace` fails `bun run lint` on the first, and
   `src/components/ui` is the one directory exempt from `func-style` — so fix
   the namespace import, and leave `function` alone there. Check the emitted
   classes against `bun run lint:units` (no raw `px` arbitrary values).
2. **`TextField`** — label association + `aria-describedby` for the error
   message, ≥44px touch target. Form a11y is the point of the component, not a
   nice-to-have: the overlay layer's a11y is already a real tested system
   (`useOverlay`), the form layer has no equivalent only because no field
   exists yet.
3. **`AmountField`** — locale-aware. **Not** `<input type="number">`
   (§2.2(5)). Parse through `src/lib/i18n/localeFormatting.ts`; a locale that
   groups with `.` and one that groups with `,` must both round-trip.
4. **`ConfirmDialog`** — built on the existing `CenterModal` and reusing
   `useOverlay`'s stack. It must **never** reimplement Escape handling, focus
   trapping or scroll locking; if it needs something `useOverlay` doesn't
   expose, that is a finding to report, not a reason to hand-roll. Use
   `button.tsx`'s existing `destructive` / `secondary` variants — the current
   `/kit` delete demo hand-rolls raw `<button>`s and is the prior art to
   replace, not to copy.
5. Every new component gets a `/kit` entry.

**Copy:** `ConfirmDialog` takes its strings as props; it adds **no locale
keys** (§1.7). `/kit` is dev-only and stays as it is on that front.

**Done when:** the primitives exist, are in `/kit`, and a delete confirmation
can be assembled without touching overlay internals.

**Blast radius:** `src/components/ui` (additive) + three new shared components

- `Kit.tsx`. **Nothing consumes them until Wave 4** — do not wire them into a
  screen.

---

### Track V — §10.15 local data scoping (profiles)

The track that makes "ready for real data" true. **Read first:** `specs.md`
§10.15 in full, `src/lib/README.md`'s entries for `db.ts` / `repo.local.ts` /
`repoProvider.ts` / `deviceStore.ts`.

**The model is decided, don't re-litigate it:** one dexie **database per
profile**, not a `profileId` column. Isolation costs nothing at query time,
deleting a profile is deleting a database, and cross-profile reads become
impossible rather than merely discouraged.

**Build:**

1. **Parameterise `db.ts`** — a factory that builds the schema against a given
   database name, with the frozen `kurobello` instance still exported as the
   default so nothing that imports `db` today changes behavior. `AGENTS.md`
   §1.8 is binding: `kurobello` is **adopted** as the first profile, never
   renamed or migrated. Additional profiles get a **suffixed** name.
2. **A device-scoped profile registry** — the pattern `deviceStore.ts` already
   uses: id, label, kind (`local` | `google`), created / last-used timestamps,
   database name. Same posture as every other device signal: every read
   self-catches and degrades to "no signal", because storage trouble may
   suppress a convenience and must never block boot.
3. **`repoProvider.getRepo()` binds to the active profile.** Because every
   screen already reads through `getRepo()`, this touches **no screen, no
   `dataStore`, no `schema.ts`**.
4. **`createLocalRepo()` takes its database** (it closes over the module-level
   `db` today). Default it so existing callers and tests are unchanged. Confirm
   the `readyPromises` WeakMap stays keyed per database (§2.2(4)).

**The stub stays a stub (§2.2(7)).** Build and **test** the real per-profile
repo path — prove a guest and a signed-in account read and write entirely
separate stores on the same device — but `getRepo()` still returns the fake
repo when the app runs. Flipping it without Wave 4's create UI produces an
empty, unusable app. That is the whole point of `specs.md`'s sequencing note.

**Explicitly out of scope, and this is where over-engineering would bite:**
no profile switcher, no rename, no delete, no consolidation, no merge logic, no
UI at all (§10.18 renders the read-only list in stage 3, Wave 5+ owns the
rest). "Nothing is ever replaced" is a property of the data model you are
building — a user who signs in with local data ends up with two profiles side
by side — not a feature you implement this wave.

**Edge cases:** a profile whose database fails to open; the same Google account
on two devices (different local databases, reconciled by Drive later, not by
this); guest data when the user later signs in (stays its own profile,
untouched).

**Done when:** §10.15's "Done when", plus: `bun run check` green and a test
proving cross-profile isolation.

---

### Track W — §10.16 service-worker update lifecycle

Smallest track in the stage. **Read first:** `specs.md` §10.16, §10.9's Tier 3
rule (this is a notification, not a blocking modal), `src/lib/toastStore.ts`.

**Build:** flip `registerType` from `autoUpdate` to `prompt`, add a small
registration module around `virtual:pwa-register` (nothing imports it today),
and surface "a new version is available — reload" through the **existing
Toast** with an action. Wire it in `main.tsx` (W owns that file this stage).

**Behavior that has to be right:** don't nag on every navigation; don't reload
out from under a user mid-input; an update that arrives while offline is not an
error. §2.2(6): this changes real runtime behavior — a broken prompt means
updates silently stop arriving, which is strictly worse than today. Prove the
module with tests rather than asserting it works.

**Done when:** a simulated new SW produces the prompt, and taking it reloads to
the new version cleanly.

**Blast radius:** `vite.config.ts`, one registration module, one Toast call,
`main.tsx`. **No feature code.**

---

## 4. Stages 2 and 3 (not dispatched yet)

Barriers, per `specs.md`: a stage is blocked until every track in the previous
one has **merged and passed its code review** — not merely merged.

| Stage | Tracks                                                                 | Blocked by        |
| ----- | ---------------------------------------------------------------------- | ----------------- |
| **1** | R, S, U, V, W                                                          | `main`            |
| **2** | T (§10.13 write path), X (§10.17 diagnostics, cuttable)                | T←R, X←S          |
| **3** | Y (§10.18 profile screen)                                              | V, U, T           |
| **4** | one review agent per merged track, then one general cross-track review | everything merged |

Trim order if the wave gets too big (from `specs.md`): X first, then W, then S.
Never R, T, U, V or Y.

---

## 5. Live status

| Track | Status                                                  |
| ----- | ------------------------------------------------------- |
| R     | merged `1aea99e`, review in flight (`wave3/r-review`)   |
| S     | ✅ merged `823bf59` + review `1058b5c`, worktree removed |
| U     | ✅ merged `32d71d0` + review `3b98736`, worktree removed |
| V     | ✅ merged `f350705` + review `99f3dbf`, worktree removed |
| W     | ✅ merged `3138af7` + review `b44b643`, worktree removed |

Stage-1 decisions and backlog are folded into `specs.md` §11/§12 as each
track closed, per §1.2 — not batched at the end.

The authoritative worktree log stays in `docs/waves.md`; this table is the
per-track execution view.
