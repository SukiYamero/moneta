# Wave 4 — operator plan

The **execution** view of Wave 4: file ownership, the conflicts resolved
before dispatch, the per-track briefs, and the live status table.
`docs/waves.md` keeps the _shape_ of the wave; `specs.md` stays authoritative
for **behavior** and outranks both. If this file and `waves.md` disagree on
execution, this file wins; if either disagrees with `specs.md` on behavior,
`specs.md` wins.

Wave 3 and 3.1 are fully merged and reviewed; every worktree was removed. This
wave starts from a clean `main`.

## 1. Stage 1 — two tracks, in parallel

| Track  | Spec   | What it is                                                           |
| ------ | ------ | -------------------------------------------------------------------- |
| **Z**  | §10.19 | The Drive sync engine — op-log format, merge, transport, watermark   |
| **G1** | §10.22 | The category picker + the taxonomy-reference migration underneath it |

Both specs are written. Neither track builds a screen the other needs, and
§2 below proves they share no writable file.

### 1.1 Why these two together

G1 unblocks Track F (the movement sheet) in stage 2 — a movement cannot be
created without assigning a category, so G1 is on the critical path, not a
parallel nicety. Z is the largest structural gap in the project (`specs.md`
§12 has carried it since Wave 2) and is pure logic with a contract suite: it
can be built and unit-tested immediately, with no UI and no dependency on
G1's output.

### 1.2 Operator-owned files (no track edits these directly)

Per the Wave 2/3 convention, so parallel tracks cannot clobber each other:

| File                  | Why                                               |
| --------------------- | ------------------------------------------------- |
| `docs/waves.md`       | both tracks' status rows + the worktree log       |
| `docs/wave-4-plan.md` | this file                                         |
| `ARCHITECTURE.md`     | G1 adds a top-level folder (`src/features/tags/`) |

`specs.md` edits are **append-only** per `AGENTS.md`: each track adds its own
§11/§12 lines and never rewrites another's. A track's `README.md` lines land
**in the same commit as its merge**, never batched at the end — `AGENTS.md`
§ Review protocol #5 measured what happens otherwise.

## 2. File ownership, and the conflict hunt

`AGENTS.md` asks specifically for the _unowned_ file two tracks will both
want. Run deliberately for this stage:

### Track Z owns

- `src/lib/repo.drive.ts` (new), the sync engine and its flush triggers
  (new files under `src/lib/`), `src/lib/bootstrap.ts`, `src/lib/drive.ts`
- `specs.md` §4's file-layout paragraph (already flagged in §10.19 as
  requiring update in the same change)

### Track G1 owns

- `src/features/tags/**` (new)
- `src/lib/schema.ts` — additive fields on `Categoria` + the two corrected
  comments
- `src/lib/dataStore.ts` — three new actions
- The taxonomy-reference sweep: `src/components/shared/movimientoView.ts`,
  `src/components/shared/MovimientoRow.tsx`,
  `src/features/history/BreakdownCard.tsx`,
  `src/features/search/SearchScreen.tsx`,
  `src/features/search/FilterSheet.tsx`, `src/lib/export/csv.ts`,
  `src/lib/repo.fake.ts`, `src/lib/repo.contract.ts`,
  `src/lib/seedConfig.ts`, `src/routes/Kit.tsx`
- The four locale files under `src/lib/i18n/locales/`

### The contested files, resolved before dispatch

- **`src/lib/outbox.ts` — assigned to Z, read-only for G1.** G1 discovered
  that a `config` op carries the whole `Config` and therefore loses a
  concurrent category from another device (`specs.md` §12, 2026-08-19). It
  is real, unreachable today, and **G1 does not fix it** — the fix changes
  §10.19's sync format, which is Z's. G1 files it and moves on.
- **`src/lib/repo.contract.ts` — assigned to G1.** Z will want to run the
  contract suite against `repo.drive.ts`. It may **run** it; it may not
  **edit** it this stage. If Z finds the suite genuinely cannot express a
  Drive-only failure mode, it stops and escalates to the operator rather
  than editing a file G1 is rewriting fixtures in.
- **`src/lib/schema.ts` — assigned to G1.** §10.19 states explicitly that
  sync metadata lives in the op envelope and `schema.ts` is untouched by Z,
  so this is not actually contested — recorded so it is not rediscovered.
- **`src/lib/db.ts` — assigned to neither, and that is correct.** G1's
  change is value semantics, not storage shape (`seccion`/`categoria` stay
  strings, the `[seccion+fecha]` indexes keep working). Z stores nothing new
  locally. If either finds it needs a `db.ts` version bump, that is a
  planning error — stop and escalate.
- **`src/lib/i18n/locales/*.json` — assigned to G1.** Z ships `LEEME.txt`
  content, which §10.19 requires localized. Z writes that copy into **its
  own module** (`src/lib/drive/leeme.ts` or equivalent), not into the shared
  locale JSONs, because those files are key-parity-enforced and two tracks
  editing them in parallel is a guaranteed merge conflict. Z's copy is
  prose, not UI strings, so it does not belong in the i18n table anyway.

## 3. Briefs

Each track gets its spec, not a summary of it. What follows is only what the
spec does **not** already say.

### Track Z — Drive sync engine (§10.19)

Read §10.19 in full, plus `src/lib/outbox.ts` and `src/lib/hlc.ts` (Track T
built the op envelope and the logical clock — **do not rebuild them**), and
`src/lib/drive.ts` (`readJsonFile<T>` casts, it does not validate — §10.19's
edge cases make that G1-independent and squarely Z's).

Ordering inside the track: the format, replay and merge first, with the
contract suite green and **no network** — then transport, flush triggers,
sharding/compaction, and the profile watermark. That order means a review can
catch a merge-rule defect before transport code is written on top of it.

**The validation §10.19 calls out is Z's, not Wave 5's.** Wave 5 is the
broader sweep; a Drive reader that ships with no shape validation puts a
malformed file into the store on day one.

The first-run download view is **not** Z's — `docs/pendientes-usuario.md` item
5 still has no owner. Z ships the watermark and a derivable progress state;
the screen is a later track.

### Track G1 — category picker (§10.22)

Read §10.22 in full. The order inside the track is not optional:

1. **The reference migration first**, TDD: `schema.ts`'s additive fields, the
   resolver in `movimientoView.ts`, the sweep of every render site, the two
   fixtures made consistent. `bun run check` green **before** any picker UI
   exists. A half-migrated reference is the worst possible intermediate state.
2. **Then `dataStore`'s three actions**, TDD — including a test for the
   same-tick race §10.22's first edge case names.
3. **Then the picker and the modal.**

`AGENTS.md`'s "fix the shape, not the instance" applies directly: when the
sweep finds one site reading `m.categoria` as a label, look for its twin
before moving on, and report what the sweep found — including "nothing else"
if that is honest.

## 4. Review protocol for this stage

Non-negotiable, per `AGENTS.md` § Review protocol:

1. Each track gets its **own** reviewer, scoped to that track's files alone,
   dispatched **after** the track is verified and merged.
2. The reviewer hunts four things, not one: bugs, **redundancy**,
   **optimization**, and **better approaches**. A correctness-only review is
   a quarter of the job.
3. The reviewer **applies** what it finds when the fix is clearly correct and
   in scope, and escalates anything delicate to the operator instead of
   deciding it.
4. After both merge, the operator runs a **cross-track pass** over the seams
   — specifically what the per-track reviewers cannot see by construction:
   whether Z's validation and G1's fallbacks agree on what "unknown category"
   means, and whether the config-op gap got quietly half-fixed in one place.

## 5. Stage 2 — the contended files, resolved before dispatch

Stage 2 is Track F (§10.23), Track G2 (§10.24) and the `repoProvider` flip
(§10.25, an operator step gated on F and on a user decision).

`AGENTS.md` asks for the _unowned_ file two tracks will both want. Run for
stage 2, it found two files both tracks legitimately need, for different
reasons:

| File                                     | Track F wants                    | Track G2 wants                     |
| ---------------------------------------- | -------------------------------- | ---------------------------------- |
| `src/lib/dataStore.ts`                   | three mutations return `boolean` | `updateConfig`'s blind write fixed |
| `src/features/history/HistoryScreen.tsx` | a row handler to open the sheet  | the `semana` skeleton gate         |

**Resolution: neither track edits either file. Both changes land first, in an
operator groundwork commit on `main`, before either track is dispatched.**

This is deliberately not the obvious answer, which would be "assign each file
to one track and make the other wait." Both changes are small, both are
independently correct, and both are things the _current_ code is already
subtly wrong about — the `Promise<void>` mutations violate
`docs/error-handling.md` §4 today, and `updateConfig`'s blind `set` is a §12
item today. Neither needs its consuming track to exist in order to be right.

Doing them up front means stage 2 has **zero shared writable files** and the
two tracks run genuinely in parallel, instead of one blocking on the other for
a five-line change. Wave 3 stage 1 learned the opposite lesson the expensive
way: `deviceStore.ts` was assigned to nobody and three tracks each built their
own device-scoped database (`specs.md` §11, 2026-08-19).

**The groundwork commit is TDD like any other correctness change** — the
interleaving test for `updateConfig` is the same shape Track G1's review
already used for the three category actions, and the week-start gate has a
characterization test in §12 that must flip from documenting the bug to
asserting the fix.

## 6. Status

| Track | Status                                                      |
| ----- | ----------------------------------------------------------- |
| Z     | ✅ merged `498632a` + seam fix `8806321` + review `8a7d8ce` |
| G1    | ✅ merged `1fdfeb0` + review `ca9c545`                      |
| —     | ✅ operator cross-track pass (layer guard + tint table)     |
| —     | ✅ stage-2 groundwork `ab78db8` (the two contended files)   |
| F     | active — `../moneta-worktrees/track-f`                      |
| G2    | active — `../moneta-worktrees/track-g2`                     |

The authoritative worktree log stays in `docs/waves.md`; this table is the
per-track execution view.

### Stage 2 status

| Track | Status                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F     | ✅ implemented on `track-f`, not yet merged/reviewed — `bun run check` green (114 files, 1226 tests); see specs.md §11, 2026-08-20 for the four pressure-test conclusions |
| G2    | — (running in parallel per §1)                                                                                                                                            |

Track F did not merge to `main` itself, per its brief — the operator merges
after the per-track review this wave's protocol requires (`AGENTS.md` §
Review protocol).
