import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { useDataStore } from '@/lib/dataStore'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { hasEverSynced } from '@/lib/sync/status'
import { runInitialSync } from '@/lib/sync/syncSession'
import { DriveDownloadScreen } from '@/features/sync/DriveDownloadScreen'

/**
 * Sits inside `BootGate` (specs.md §10.26 §3), between "the local boot
 * finished" and "the app is actually usable" — the one place a caller can
 * rely on `repoProvider`'s binding already existing (`BootGate` only ever
 * renders its `children` once boot is `'ready'`), which is what makes this
 * the reliable home for both:
 *
 * - the first-run full-screen gate, for a Drive-linked profile that has
 *   never pulled successfully (`sync/status.ts`'s `hasEverSynced`); and
 * - "pull on app open" (specs.md §10.19) for a returning user, who must
 *   never meet this screen — `runInitialSync()` runs behind the rendered
 *   UI instead.
 *
 * The gate decision is taken once, synchronously, from state already
 * available at first render — no flash of `null` while an effect resolves
 * it. This component remounts more often than a boot rebind alone: a boot
 * rebind is the only time the decision could legitimately *change*, but
 * `router.tsx` also remounts it on every navigation between `/` and
 * `/settings` (siblings, not nested — `BootGate`'s own doc comment covers
 * why). `dismissedProfileIds` below is what keeps an explicit "continue
 * without Drive" skip from being forgotten on that second, more frequent
 * kind of remount — without it, tapping the settings gear right after
 * dismissing the gate would re-show it, even though §10.19 calls this "the
 * first run of a profile, once." A real success doesn't need the set —
 * `hasEverSynced` stays true from then on — but a skip with no successful
 * pull yet has no other durable signal to key off.
 */
const dismissedProfileIds = new Set<string>()

export const FirstSyncGate = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const drive = useAuthStore((s) => s.drive)

  const [showGate, setShowGate] = useState(() => {
    if (status !== 'authenticated' || drive === null) return false
    const binding = getActiveProfileBinding()
    if (binding === null || dismissedProfileIds.has(binding.profile.id)) return false
    return !hasEverSynced(binding.profile)
  })

  useEffect(() => {
    if (showGate) return // DriveDownloadScreen owns its own pull attempt
    void runInitialSync()
    // Deliberately once per mount (no dependency array items besides the
    // stable `showGate` itself) — this is "on app open," not "on every
    // status/drive update"; the trigger wiring (`syncSession.ts`) owns
    // every later sync.
  }, [showGate])

  const onDone = useCallback(() => {
    // Covers both a real success and an explicit "continue without Drive"
    // skip (DriveDownloadScreen calls this same prop for either) — see the
    // module-level comment above for why a skip needs to be remembered.
    const binding = getActiveProfileBinding()
    if (binding) dismissedProfileIds.add(binding.profile.id)
    // The gated pull just materialized rows into IndexedDB *after*
    // `boot.ts` already loaded `dataStore` from what was there before (an
    // empty profile) — `load()` alone is a no-op once `status` is already
    // `'ready'` (its own idempotency guard), so this needs the same
    // reset-then-reload `boot.ts`'s own rebind path uses, not a full page
    // reload (which would also re-show the brand screen for no reason).
    useDataStore.getState().reset()
    void useDataStore.getState().load()
    setShowGate(false)
  }, [])

  if (showGate) return <DriveDownloadScreen onDone={onDone} />
  return <>{children}</>
}

export const __resetFirstSyncGateForTests = (): void => {
  dismissedProfileIds.clear()
}
