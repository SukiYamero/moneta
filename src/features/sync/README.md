# src/features/sync

The first-run download view — presentation and gating only. Sequencing logic
(`getSyncContext()`, `runInitialSync()`, the trigger start/stop) lives in
`src/lib/sync/syncSession.ts`; this folder wires it into the render tree.

- `FirstSyncGate.tsx` — sits inside `BootGate` (`src/router.tsx`), between
  "the local boot finished" and "the app is actually usable." Decides once,
  synchronously, at first render: a Drive-linked profile that has never
  pulled successfully (`sync/status.ts`'s `hasEverSynced`) blocks on
  `DriveDownloadScreen`; everyone else renders `children` immediately, with
  `runInitialSync()` firing behind it. `dismissedProfileIds` (a module-level
  `Set<profileId>`) remembers an explicit "continue without Drive" skip
  across remounts (e.g. navigating between `/` and `/settings`, each of
  which mounts its own `BootGate`/`FirstSyncGate`). On a successful gated
  download, resets and reloads `dataStore` before revealing `children`.
- `DriveDownloadScreen.tsx` — the screen itself. Shows real progress from
  `useSyncStore.pullProgress` (files reconciled of total), never an
  indeterminate spinner. Offline is its own state, checked before
  attempting. A failed attempt offers retry and "continue without Drive for now".
