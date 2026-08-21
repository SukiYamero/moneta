# Wave 4.1 — operator plan

The **execution** view of Wave 4.1: staging, file ownership, the conflicts
resolved before dispatch, the per-track briefs and the live status table.
`docs/waves.md` keeps the _shape_ of the wave; `specs.md` stays authoritative
for **behavior** and outranks both. If this file and `waves.md` disagree on
execution, this file wins; if either disagrees with `specs.md` on behavior,
`specs.md` wins.

Wave 4 stage 3 is fully merged and reviewed; every worktree was removed. This
wave starts from a clean `main` measured green: `bun run check` — 131 files,
1375 tests, 2 pre-existing `react/only-export-components` warnings
(`button.tsx`, `FirstSyncGate.tsx`), not errors.

## 1. Staging — three in parallel, then one

Confirmed with the user 2026-08-20.

| Stage | Tracks     | Why                                                                                                                         |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| **1** | AD, AE, AF | Zero shared writable files (§2 proves it). Priorities 1–3 in `waves.md`.                                                    |
| **2** | AG         | AG reuses `boot.ts`'s rebind path, which **AD moves** in stage 1. Running them together puts two writers on the cold start. |

Stage 2 is blocked until every stage-1 track has merged **and** passed its own
code review (`AGENTS.md` § Review protocol), not merely merged.

## 2. File ownership, and the conflict hunt

`AGENTS.md` asks specifically for the _unowned_ file two tracks will both
want. Run deliberately for this stage — Wave 3 stage 1 shipped three
device-scoped databases because this step was skipped.

### Track AD — the cold-start surface (§10.29 + §10.21)

- `src/features/auth/RequireAuth.tsx`, plus a new returning-user screen under
  `src/features/auth/**`
- `src/features/boot/**` — including **deleting** `BootScreen.tsx` and its
  floor (§10.29), and reshaping `BootGate.tsx`
- `src/features/sync/FirstSyncGate.tsx` (the handoff into
  `DriveDownloadScreen`; the download screen itself is **read-only** for AD)
- `src/router.tsx`, `src/routes/AppShell.tsx`, `src/main.tsx`
- `src/components/shared/**` — **only** to add a new shared brand-mark
  component if it decides it needs one. No edits to existing shared files.
- i18n namespaces `auth` and `common`

### Track AE — the light theme (§10.30)

- `src/styles/index.css` — **`:root` only**. `.dark` is correct and stays.
- `index.html` (drop the hardcoded `class="dark"`, add the synchronous
  pre-paint theme script)
- A new theme-resolution module under `src/lib/`
- `src/features/settings/PreferencesEditor.tsx` (the theme row);
  `OptionList.tsx` is **read-only** — Track AC just gave it real keyboard
  behaviour, do not reshape it for one consumer
- `docs/ui/design-tokens.md`
- i18n namespace `settings`

### Track AF — the PIN screens + the lock's two identities (§10.2 / §10.2.1)

- `src/features/lock/**` (`LockScreen`, `LockSettings`, `AppLock`, its copy)
- `src/features/profile/SecuritySection.tsx`
- `src/lib/lockStore.ts`, `src/lib/pinLock.ts` (the session-less guest path)
- `src/lib/deviceStore.ts` — **AF is the only writer this stage**
- i18n namespaces `lock` and `profile`

### The contested files, resolved before dispatch

- **`src/lib/i18n/locales/{en,es,es-AR,pt-BR}.json` — the real contested
  file, and all three tracks need it.** Assigning them to one track (Wave 4's
  answer) does not work here: every stage-1 track ships user-facing copy.
  **The rule instead is namespace-scoped:** a track edits _only_ its own
  top-level namespaces (AD: `auth`, `common` · AE: `settings` · AF: `lock`,
  `profile`), never reorders or reformats the file, and appends new keys
  inside its own block. The namespaces are far apart textually, so git merges
  them cleanly; `resources.test.ts`'s key-parity check is the loud safety net
  if a merge ever goes wrong. **`common` belongs to AD alone** — AE must not
  put theme copy there.
- **`src/lib/deviceStore.ts` — writable by AF, read-only for AD.** AD reads
  `hasLoggedInBefore()` to decide whether the skeleton's promise is true
  (§10.29); AF may need a device row for a guest's biometric enrolment. One
  writer, so no conflict — recorded so neither track discovers it live.
- **`src/features/sync/DriveDownloadScreen.tsx` — nobody's, read-only.** AD
  owns the _handoff_ into it, not the screen. If AD concludes the screen
  itself must change, it stops and escalates: `docs/pendientes-usuario.md`
  item 5 is still open (the user has not yet seen it running) and a track
  must not redesign a screen awaiting the user's own eye.
- **The `src/components/shared/` tree — AD only, and additively.** The export
  uses one brand mark on Welcome / Return / Drive-permission. If AD extracts
  it, it is a new file; AE and AF add nothing there. AF's keypad lives inside
  `src/features/lock/`, not in shared — it has exactly one consumer.
- **`src/routes/Kit.tsx` — nobody.** No stage-1 track adds a primitive that
  belongs in the gallery. If one thinks it does, escalate rather than edit.
- **`src/lib/boot.ts` — AD, and AG must wait.** AD reshapes the gate above
  it; §10.31 says AG _reuses_ `boot.ts`'s rebind rather than extending it.
  This is exactly why AG is stage 2.
- **`src/test/setup.ts` — nobody.** Track-local helpers stay in the track's
  own test files.

### 2.1 Operator-owned files (no track edits these directly)

| File                         | Why                                   |
| ---------------------------- | ------------------------------------- |
| `docs/waves.md`              | status rows + the worktree log        |
| `docs/wave-4.1-plan.md`      | this file                             |
| `ARCHITECTURE.md`            | AD adds/removes nothing top-level yet |
| `docs/pendientes-usuario.md` | only the user closes an item          |

`specs.md` edits are **append-only** per `AGENTS.md`: each track adds its own
§11/§12 lines and never rewrites another's. A track's `README.md` lines land
**in the same commit as its merge**, never batched at the end.

## 3. Operator decisions taken before dispatch

Recorded here so no track resolves them by assumption, and so a reviewer does
not "fix" them later.

1. **The "CADUCADA" chip uses `--warning`, not the export's literal
   `#E8B84B`.** `docs/ui/design-export-reference.md` flags that hex as
   matching no app token. `AGENTS.md` is unambiguous that every style value
   comes from a token; a one-off literal for one chip is exactly the drift
   the token system exists to prevent. The design's intent (an amber "this
   expired" chip) survives; the number does not.
2. **§10.29's "Done when" sentence is stale against its own revised
   decision.** It reads "exactly one full-screen treatment before Home",
   written before the same-day reversal that deleted the full-screen loader
   entirely. **The binding reading is: zero full-screen loading treatments.**
   What covers the pre-content span is the app's own shell + skeleton, and
   only when `hasLoggedInBefore()` is true. AD appends the clarification to
   §11 rather than shipping to the stale sentence.
3. **The returning-user screen is built from the export** — user-confirmed
   2026-08-20, closing `docs/pendientes-usuario.md` item 2. With one
   mandatory divergence the export cannot supply: the reassurance line is
   **gated on local data actually existing** (§10.21), never rendered
   unconditionally the way the artboard does.
4. **The brand mark is implemented with Lucide, not Phosphor.** The export's
   mark is a gradient rounded square with `ph-fill ph-coins` plus the
   wordmark; `AGENTS.md` freezes Lucide as the icon set and `APP_NAME` as
   the only home for the display name. A real logo asset stays
   `docs/pendientes-usuario.md` item 8 — that item is now **only** the PWA
   icon, since §10.29 deleted the boot screen it was also blocking.
5. **AF ships in two ordered halves and may stop after the first.** The PIN
   surface is fully implementable from the export; the guest biometric path
   is a session-less lock that does not exist yet (§10.2.1). If the second
   half turns out to require reshaping the vault, AF stops, ships the first
   half plus the removal of the guest control that can only fail, and
   escalates. It must **not** grow into encrypting the local database.

## 4. Briefs

Each track gets its spec, not a summary. What follows is only what the spec
does **not** already say.

### Track AD (§10.29 + §10.21 + §10.9)

Read §10.29, §10.21, §10.9 and §10.28's still-standing sequence, plus
`docs/ui/design-export-reference.md` §2 and §3.

Order inside the track:

1. **The boot-flash regression test first**, red before anything moves — a
   returning user must never see Welcome flash. §10.29 says in its own blast
   radius that a careful read is not sufficient evidence here.
2. Delete `BootScreen.tsx` + the 800ms floor; reshape what covers the span.
3. The returning-user screen, with the honesty gate.
4. The `FirstSyncGate` → `DriveDownloadScreen` handoff, seamless.

The structural question §10.29 names — `AppShell` renders three levels below
where the decision is made, and hoisting it is **not** the answer — is the
track's to solve, deliberately and minimally. Bottom nav must never appear
over Welcome.

### Track AE (§10.30)

Read §10.30 in full plus `docs/ui/design-export-reference.md` §1. The mapping
table is validated, not guessed — apply it, do not re-derive it. The five
`chart-*` light values are **decided** (§10.30's table); do not recompute
them, and do not touch `.dark`.

The synchronous pre-paint value: §10.30 already rules that a theme preference
is not sensitive data and `localStorage` is legitimate **here specifically**.
Record it explicitly in §11 so it does not read as an `AGENTS.md` §7
violation. The mirror from `Preferencias.tema` follows the existing shape —
`src/lib/i18n/syncStoredLocale.ts` does exactly this for `idioma`; reuse that
pattern rather than inventing a second one.

`sistema` must follow `prefers-color-scheme` **live**, without a reload.

### Track AF (§10.2 + §10.2.1)

Read §10.2, §10.2.1, `docs/superpowers/specs/2026-06-26-pin-lock-design.md`
and `docs/ui/design-export-reference.md` §4.

TDD is mandatory on `pinLock.ts`/`lockStore.ts` (`AGENTS.md` § Testing) —
write the failing test first, watch it fail for the right reason.

"Olvidé mi PIN" is **not a new mechanism**: it is a manual entry point onto
the vault wipe + forced re-login the code already performs after five failed
attempts, behind a confirm that says plainly what is lost. Account-only by
construction.

## 5. Review protocol for this wave

Per `AGENTS.md`, non-optional:

1. Each track gets its **own** review subagent after its work is verified and
   merged — bugs, redundancy, optimization, and better approaches, not just
   correctness. The reviewer applies what is clearly correct and in scope.
2. Anything delicate — a judgment call, a product decision, a cross-cutting
   change — is escalated to the operator, who decides.
3. After the whole stage lands, the operator runs a **cross-track pass** over
   the seams the per-track reviewers structurally could not see. Wave 4 stage
   3 found seven CONFIRMED defects this way, every one invisible to its own
   author.

## 6. Status

| Track | Branch           | Worktree                             | Status               |
| ----- | ---------------- | ------------------------------------ | -------------------- |
| AD    | `track-ad-boot`  | `../moneta-worktrees/track-ad-boot`  | active               |
| AE    | `track-ae-light` | `../moneta-worktrees/track-ae-light` | active               |
| AF    | `track-af-pin`   | `../moneta-worktrees/track-af-pin`   | active               |
| AG    | —                | —                                    | stage 2, not started |

## 7. Operator debt from stage 1 (do not lose these)

- ~~**`syncStoredTheme()` has no caller.**~~ **Closed 2026-08-20** — wired in
  `main.tsx` (`1aefa85`) the moment AD merged and released the file. Track AE built it correctly and could
  not wire it: the one line belongs in `src/main.tsx` beside
  `syncStoredLocale()`, and `main.tsx` is Track AD's file this wave. Until it
  lands, picking a theme writes `Preferencias.tema` and nothing moves on
  screen. **The operator wires it the moment AD merges** — filed in `specs.md`
  §12 by AE as well, so it survives this file.
- **`src/features/profile/PreferencesSection.tsx` was unowned**, and its inert
  "Tema — Oscuro / dark-only for now" row became false the instant AE merged.
  That is a planning miss, not a track's fault: the wave plan assigned the
  settings-side editor and never asked which _other_ file rendered the same
  preference. Authorized to AE's reviewer, with the constraint that the
  `profile` i18n namespace belongs to live Track AF.
