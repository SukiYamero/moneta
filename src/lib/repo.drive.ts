import type { ProfileDb } from '@/lib/db'
import type { Repo } from '@/lib/repo'
import { createLocalRepo } from '@/lib/repo.local'

// repo.drive.ts — the second `Repo` implementation specs.md §10.19's blast
// radius names ("a new repo.drive.ts behind the existing Repo port").
//
// It delegates every CrudRepo/getConfig/updateConfig call straight to
// `repo.local.ts`'s `createLocalRepo()`, and that delegation is the point,
// not a shortcut taken to avoid writing it: §10.19 states explicitly that
// **the local database is always the merged truth** — the op log is a
// storage/transport format, replayed once per pull, and "no screen ever
// sees them." Every read and write on this app's hot path is therefore a
// local dexie operation whether or not the profile the repo belongs to
// syncs to Drive at all; there is no "read from Drive" or "write to Drive"
// path for `list()`/`add()`/`update()` to take, because that path doesn't
// exist by design. What actually makes a profile Drive-backed — the op
// log, the revision-checked pull, the append-only push, yearly compaction,
// the "when it syncs" triggers — lives entirely in `sync/engine.ts`,
// deliberately outside the `Repo` port: `repo.contract.ts` (the contract
// every implementation must satisfy) has no notion of "push" or "pull" to
// test, because a screen reading through `getRepo()` must stay unaware any
// of this exists.
//
// So this module's real job, honestly stated, is narrower than its name
// suggests: it is the explicitly Drive-identified `Repo` instance a
// Drive-linked profile binds to (`repoProvider.ts`'s future wiring point —
// not flipped this wave, per AGENTS.md), built by reusing
// `repo.local.ts`'s already-correct validation/pagination/error behavior
// rather than re-deriving it. Passes the exact same `repo.contract.ts`
// suite as `repo.local.ts`/`repo.fake.ts` for exactly this reason: it *is*
// `repo.local.ts`, scoped to a Drive-linked profile's own database.
export const createDriveRepo = (database: ProfileDb): Repo => createLocalRepo(database)
