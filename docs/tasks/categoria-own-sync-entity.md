# Categoria becomes its own synced entity, out of the Config blob

## Sequencing — starts after `docs/tasks/outbox-profile-integrity.md` lands

That task fixes `dataStore.ts`'s `runMutation` to capture its target database
explicitly. This task's rewritten `upsertCategoria`/`archiveCategoria`/
`deleteCategoria` still call `runMutation` (same as `Movimiento`'s
mutations), so starting this after that fix is merged means it's built on
the corrected version for free, instead of two branches independently
touching the same function and one of them having to rebase through a
conflict. Also rebase onto `docs/tasks/profile-data-erasure.md` if it has
already merged by the time this starts — both add new, non-overlapping
functions to `sync/driveFiles.ts`, low conflict risk but a shared file
worth checking.

## Goal

Two devices adding, editing, or archiving different categories offline never
clobber each other. Establish the reusable rule: anything that is a growing
collection of user-created records is its own synced entity, never a field
inside a whole-object-synced settings blob — `Config` shrinks to genuinely
scalar settings only.

## Why this is safe to build, not just a good idea

`sync/opLog.ts`'s `replayConfig` already calls the **same generic
`replayEntity`** function that `replayMovimientos`/`replayActivos` use —
"last id wins" isn't a different algorithm for config, it's the identical
per-id merge, just fed a single artificial id (`'config'`) that makes the
whole object act as one record. Giving `Categoria` its own real per-record
id (it already has one) and routing it through the same generic engine is
not new merge logic — it's removing the one place that misuses the existing
one.

`Activo` (`src/lib/sync/opLog.ts`'s `ActOpEntry`/`ActOpFile`,
`sync/engine.ts`'s `materializeActivos`/`replayActivos`,
`sync/driveFiles.ts`'s `downloadActFile`/`uploadActFile`) is the structural
template: put/del ops, one growing per-device file (no month-sharding,
categories are a low-volume collection like activos, not high-volume like
movimientos). `Activo` itself is missing the push half — do not fix that
here, it's out of scope (no UI uses `Activo` at all) — copy its _shape_,
not its gap.

## The parent-archived-while-child-added case is already handled

Independent per-record merge introduces a case whole-object merge
accidentally avoided: device A archives a parent category offline while
device B adds a new child under that same parent offline. Both ops apply
independently on replay — the parent ends up archived with a live child
still pointing at it via `padreId`. **This is already a specified, tested
case**: `specs.md` §10.22 — "a category whose own parent is archived
renders at level 1 (an orphan, not hidden)." No new UI/display logic needed;
just confirm the picker's existing orphan handling is exercised by a test
that actually creates this via two independent ops, not just a single
already-orphaned record.

## Rules (each one is a bug if violated)

1. **New entity kind `categoria`** in `src/lib/sync/opLog.ts`:
   `CategoriaPutOp { op: 'put'; hlc; basedOn; categoria: Categoria }`,
   `CategoriaDelOp { op: 'del'; hlc; basedOn; id: string }`,
   `CategoriaOpFile { v; device; ops: CategoriaOpEntry[] }` — mirrors
   `ActOpEntry`/`ActOpFile` exactly. Both `put` and `del` are real: archiving
   is a `put` (`archivado: true`), and `deleteCategoria` (only reachable
   when unused by any movement) is a genuine `del`, exactly like
   `Movimiento`'s del path.
2. **`OutboxOperation`** (`src/lib/outbox.ts`) gains
   `{ entity: 'categoria'; op: 'put'; payload: Categoria }` and
   `{ entity: 'categoria'; op: 'del'; payload: { id: string } }`.
   `entityIdOf` already handles any non-`config` entity generically via
   `payload.id` — confirm this covers the `del` variant's `{ id }` shape too.
3. **`Config` shrinks to `{ schemaVersion, preferencias }`** — the
   `categorias` field is removed from its type entirely. Every reader of
   `Config.categorias` (the category picker, `movimientoView.ts`'s
   resolution, `CategoryFormModal.tsx`'s duplicate-name check, `dataStore.ts`
   itself) is repointed to the new source instead.
4. **A new `categorias` table** in the profile database (`src/lib/db.ts`),
   with a `Repo.categorias: CrudRepo<Categoria>` member reusing the existing
   generic `CrudRepo<T>` factory (`repo.local.ts`) — the same shape
   `activos: CrudRepo<Activo>` already has, not a bespoke path.
5. **`SCHEMA_VERSION` bump with an idempotent migration** (`repo.local.ts`'s
   `MIGRATIONS`) that moves each profile's existing `config.categorias` array
   into the new table, then strips the field from the stored `Config` row.
   Per `AGENTS.md`: back up the local JSON data files before running it
   against real data — low-stakes today since there are no real users, but
   the migration itself must still be written and registered as if there
   were, per the standing rule.
6. **Drive side**: `sync/driveFiles.ts` gains `downloadCatFile`/
   `uploadCatFile` against `cat-<device>.json` (mirrors
   `downloadActFile`/`uploadActFile` exactly); `sync/engine.ts` gains
   `materializeCategorias`/push-side handling for the `categoria` entity in
   both `pushOnce` (a new `pushCatShard`, mirroring `pushMovShard`'s
   find→download→append→upload shape) and `pull()`'s file-kind dispatch and
   replay (mirroring the existing `materializeActivos` call).
7. **Old, already-synced `config` op payloads that still carry an embedded
   `categorias` array** (from before this change) are read and the array is
   ignored — never resurrected as a phantom duplicate source of categories
   on a pull from old data.
8. `dataStore.ts`'s `upsertCategoria`/`archiveCategoria`/`deleteCategoria`
   stop routing through `updateConfig`/`getRepo().updateConfig` entirely —
   they call the new `categorias` repo methods and enqueue the new
   `categoria` outbox operation, following the exact pattern
   `createMovimiento`/`updateMovimiento`/`deleteMovimiento` already use for
   `Movimiento`.
9. **`dataStore`'s public shape for consumers stays as close to unchanged as
   possible** — `CategoryField.tsx`/`CategorySheet.tsx`/
   `CategoryFormModal.tsx`/`movimientoView.ts` should need minimal changes
   beyond reading categories from wherever `dataStore` now exposes them
   (still `state.categorias` or equivalent, not necessarily nested under
   `state.config` anymore) — this task is a sync/storage change, not a UI
   redesign.

## Explicitly out of scope

- Do not build `Activo`'s missing push path while touching this pattern —
  it has no UI and no call site; copying its file-format shape for
  `Categoria` doesn't imply finishing it.
- Do not attempt to also split `Preferencias` out of `Config` — its four
  fields are genuinely scalar settings where whole-object last-write-wins is
  an acceptable, low-stakes risk; this task is scoped to the field that
  actually causes real, visible data loss.

## Files this task owns

`src/lib/schema.ts` (`Config`, `SCHEMA_VERSION`), `src/lib/db.ts` (new table),
`src/lib/repo.ts`/`repo.local.ts`/`repo.fake.ts` (`categorias: CrudRepo<Categoria>`,
the migration), `src/lib/outbox.ts` (new entity variant), `src/lib/sync/opLog.ts`
(new op/file types + normalization), `src/lib/sync/driveFiles.ts` (new
download/upload pair), `src/lib/sync/engine.ts` (push/pull wiring), `src/lib/dataStore.ts`
(category mutations), `src/components/shared/movimientoView.ts` (resolution
source), `src/features/tags/**` (read-path adjustments only), and every
corresponding test file. Coordinate before touching anything under
`src/features/settings/CategoriesSection.tsx` if another task is active
there at the same time.

## Acceptance per rule

1. Test: `replayEntity` fed two `CategoriaOpFile`s from two different
   devices, each `put`-ing a different category, produces **both** —
   the exact scenario that silently drops one today under `replayConfig`.
2. Test: archiving and deleting a category each produce the correct outbox
   entity/op shape.
3. Test: `Config` no longer type-checks with a `categorias` field anywhere
   it's constructed (compiler-enforced by the type change itself).
   4/5. Test: the migration moves an existing profile's embedded categories
   into the new table exactly once, is a no-op on a second run, and the
   post-migration `Config` row has no `categorias` field.
4. Test: a push/pull round trip through mocked Drive files materializes
   categories into the new table via the real replay path, not a bespoke
   test-only shortcut.
5. Test: a pull that encounters an old-format `config` op with an embedded
   `categorias` array ignores it — the new table's contents come only from
   `cat-<device>.json` files.
   8/9. Existing `CategoryField`/`CategorySheet`/`CategoryFormModal`/category
   picker tests keep passing with at most read-path adjustments, not
   behavioral changes — a diff to any of their user-visible behavior is a
   sign of scope creep, not a required part of this task.
