# src/features/sync

The first-run download view (`specs.md` §10.19/§10.26 §3) — presentation
and gating only. The sequencing logic (`getSyncContext()`,
`runInitialSync()`, the trigger start/stop) lives in `src/lib/sync/
syncSession.ts`; this folder wires it into the render tree at the one point
that's guaranteed safe to.

- `FirstSyncGate.tsx` — sits inside `BootGate` (`src/router.tsx`, both
  `RequireAuth` routes), between "the local boot finished" and "the app is
  actually usable." Decides once, synchronously, from state already
  available at first render (no flash of `null` while an effect resolves
  it): a Drive-linked profile that has never pulled successfully
  (`sync/status.ts`'s `hasEverSynced`) blocks on `DriveDownloadScreen`;
  everyone else (guest, no Drive, or already synced before) renders
  `children` immediately, with `runInitialSync()` firing behind it for a
  returning user — "pull on app open" (`specs.md` §10.19) lives here rather
  than in `syncSession.ts` itself, because this is the one place a
  `repoProvider` binding is guaranteed to exist (`syncSession.ts`'s own
  start moment can race `boot.ts`'s bind — see that module's README entry).
  Remounts fresh on every boot rebind (`BootGate` unmounts its children
  while a rebind is `'running'`), which is the only time the gate decision
  could legitimately change. On a successful gated download, resets and
  reloads `dataStore` (mirroring `boot.ts`'s own rebind path — `load()`
  alone is a no-op once already `'ready'`) before revealing `children`.
- `DriveDownloadScreen.tsx` — the screen itself, built from existing
  primitives per the user's 2026-08-20 decision (`specs.md` §10.26 §3)
  rather than blocked on a canvas design; replaceable in place if one lands
  later. Real progress from `useSyncStore.pullProgress` (files reconciled
  of total), never an indeterminate spinner. Offline is its own state,
  checked before attempting — never a generic failure for the routine "no
  network yet" case (`specs.md` §10.11's language). A failed attempt offers
  retry and "continue without Drive for now" (honest on a genuinely new
  device: there is nothing local to protect by refusing to proceed).
