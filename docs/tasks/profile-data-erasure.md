# Profile data erasure — the Drive side, scoped deliberately

## Goal

A person can remove their financial data from the one place this app doesn't
already give them a one-tap way to erase it — their own Google Drive —
without the app growing a second, redundant "clear local storage" button that
duplicates what uninstalling already does.

## Scope decision

- **Local erasure is out of scope for this control.** Uninstalling the app /
  clearing site data already wipes every IndexedDB database under the origin
  (`kurobello`, `kurobello-<profile>`, `kurobello-device`) — a real, one-tap
  OS/browser action the user already has. `DataSection.tsx`'s current stub
  copy should be repointed to Drive-only, or its local-data language dropped
  — decide once the UI copy is drafted.
- **This control targets Drive only**, because that half has no equivalent
  one-tap path today. The only existing route
  (`docs/pendientes-usuario.md` item 30) is: `drive.google.com` → find and
  delete the `KuroBello` folder, empty trash → Settings → Manage apps →
  delete hidden app data. That is the multi-step, non-obvious path this
  feature replaces with one button.

## What has to actually happen, per `specs.md` §10.19's file layout

- The `KuroBello` folder holds `mov-<device>-<YYYY-MM/YYYY>.json` and
  `act-<device>.json` **written by every device that has ever synced this
  account**, not just the device tapping delete. `drive.file` scope grants
  this app access to every file it created for this user regardless of which
  device created it — the multi-device sync design already depends on this
  (device A has to read device B's files to merge with them) — so a
  full-account wipe from any one signed-in device is reachable: list every
  file this app owns in that folder, delete each one, then delete the folder.
- `appDataFolder`'s `config-<device>.json` files are per-device and live
  under `drive.appdata`, invisible in the normal Drive UI — same reasoning:
  list and delete every `config-*.json` for this account, not just the
  current device's.
- **This device's own local copy of the profile must be cleared too** as
  part of "delete" — otherwise the button claims to delete data while
  leaving a full local copy sitting right there.

## The land-mine to design around, not skip past

If a **second device** is signed into the same account with unsynced local
writes (or fully-synced data and a live sync engine), it has no way to know
an erasure just happened. Its next push writes its own dirty state as a
brand-new op file — the account silently "resurrects" from that device's
side. There is no tombstone/erasure signal in the sync protocol today
(`specs.md` §10.19 has none), and building one is a materially bigger feature
(every device's pull path would need to check for and honor an erasure
marker) that this task must not silently grow into.

**Confirmed scope:** delete everything reachable in Drive right now, and
clear this device's local copy in the same operation — a Drive-only delete
that leaves the initiating device's local copy intact would let the very
next sync push it straight back, which is not a deletion at all. State the
other-device caveat honestly in the confirmation copy (e.g. "this clears
your data in Drive and on this device now; another device signed into this
account may still have its own copy and could re-upload it the next time it
syncs"). A silent, guaranteed-everywhere erasure with no caveats isn't
achievable without an authoritative backend that can fence off every device,
which this app deliberately doesn't have. Log the multi-device gap in
`specs.md` §11 at completion, the same way the `config` whole-object clobber
and the cross-tab race are already logged there — this task does not solve
it, only avoids pretending otherwise.

## Rules (each one is a bug if violated)

1. The control lives where `DataSection.tsx`'s existing (currently disabled)
   delete stub already is — no new, duplicate entry point.
2. It requires an explicit confirmation naming what will happen (Drive +
   this device, the other-device caveat above) — never silent, never a
   default anywhere.
3. It stops this profile's sync triggers (per `specs.md` §10.26's stop
   conditions) before deleting anything, so the engine can't race a
   mid-flight push against the delete.
4. After a successful delete, the profile's `dataStore` reloads to an empty
   state immediately — no stale rows lingering in memory until next
   navigation.
5. A partial failure (e.g. folder files deleted but the `appDataFolder`
   config delete throws) must not report success — surface which part
   failed, and never retry by re-uploading anything.
6. This never touches other profiles on the device — every Drive API call is
   scoped to the account being erased, never "all files this app owns."

## Implementation notes

- New function(s) likely belong in `src/lib/sync/driveFiles.ts` (file
  enumeration/deletion already lives there) or a new `src/lib/sync/erase.ts`
  — check which fits before adding a file.
- Reuse whatever `sync/engine.ts` already exposes for stopping triggers on
  sign-out/lock (§10.26) — do not reinvent a second stop path.
- `DataSection.tsx`'s current disabled stub and its i18n copy need real
  wording for the actual, scoped guarantee — never overstate what gets
  deleted.

## Files this task owns

`src/features/profile/DataSection.tsx`, `src/lib/sync/driveFiles.ts` (or a
new `erase.ts`), whatever `sync/engine.ts` exposes for stopping triggers
(read-only unless it's missing an export this needs), the relevant
`profile`/`dataSection` keys in `src/lib/i18n/locales/*.json`, and
corresponding tests. Do not touch anything under `src/features/auth/` —
guest adoption is `docs/tasks/guest-movement-adoption.md`'s file set.

**Runs in parallel with `docs/tasks/guest-movement-adoption.md`** — file sets
are disjoint (that task adds its own new component rather than touching
`DataSection.tsx`). The only shared files are the four
`src/lib/i18n/locales/*.json`, and each task only adds/edits its own keys
(`profile`/`dataSection` here vs. `auth.adoption.*` there) — rebase before
merging rather than assuming no diff overlap.

## Acceptance per rule

1. Test: triggering delete calls the Drive deletion path, not a local-only
   wipe, and never touches another profile's data.
2. Manual: the confirmation dialog states the Drive+this-device scope and
   the other-device caveat in the actual copy shown.
3. Test: sync triggers are stopped (mock the stop function, assert called)
   before any Drive delete call fires.
4. Test: `dataStore` reflects zero movements/activos immediately after a
   successful delete resolves.
5. Test: a mocked partial failure (one Drive call rejects) surfaces an error
   state, never a success toast.
6. Test: deleting profile A's data never issues a Drive API call scoped to
   profile B's folder/files.
