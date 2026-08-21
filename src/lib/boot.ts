import { create } from 'zustand'
import { RepoError, type RepoErrorCode } from '@/lib/repo'
import {
  bindActiveProfile,
  getActiveProfileBinding,
  resolveActiveProfileBinding,
} from '@/lib/repoProvider'
import { setOutboxDatabase } from '@/lib/outbox'
import { useDataStore } from '@/lib/dataStore'
import { resumePendingAdoption } from '@/lib/profiles'

// The boot sequence (specs.md §10.28): resolve the active profile, bind it,
// load its data, then let the app render — run once, unlocked, before any
// screen can observe a repo bound to the wrong profile or to none at all.
export type BootStatus = 'idle' | 'running' | 'ready' | 'error'

interface BootState {
  status: BootStatus
  error: RepoErrorCode | null
  run: () => Promise<void>
}

// A concurrency guard kept *outside* the store, deliberately not the
// `status` field below. `status` only flips to 'running' when a genuine
// (re)load is about to happen — a repeat call that resolves the exact same
// profile as already bound (e.g. BootGate remounting because the user
// navigated to /settings, a separate top-level route) must stay silent, or
// every such navigation would re-show the brand screen (specs.md §10.9: no
// per-navigation loader). That decision needs the profile resolved first,
// which is itself async — so a bare `status`-based check-then-set guard
// (dataStore.load()'s pattern) can't also serve as the StrictMode
// double-invoke lock without prematurely announcing 'running' for what
// might turn out to be a no-op. Two separate concerns, two separate guards.
let inFlight: Promise<void> | null = null

const runOnce = async (
  set: (partial: Partial<BootState>) => void,
  get: () => BootState,
): Promise<void> => {
  const previous = getActiveProfileBinding()
  const binding = await resolveActiveProfileBinding()
  const isRebind = binding.profile.id !== previous?.profile.id
  bindActiveProfile(binding)
  // The outbox and the repo must always point at the same profile (specs.md
  // §10.25 addendum, §12 2026-08-19) — a guest's pending operations must
  // never queue into a signed-in account's outbox, or vice versa.
  setOutboxDatabase(binding.database)

  if (!isRebind && get().status === 'ready') return

  // specs.md §10.32/§11 (2026-08-21): finishes a guest-data adoption the
  // person already consented to but that didn't finish before this device
  // last closed. Consent was already given, so this needs no prompt — it
  // is completion, not a new offer — and runs once per genuine (re)bind
  // (login, restore, hydrate, a §10.31 switch), never on the no-op remount
  // the early return above already short-circuits. Fire-and-forget: this
  // must never slow down or fail the boot it rides on (it self-catches
  // internally), only ever finish a move that was already promised.
  void resumePendingAdoption(binding.profile)

  set({ status: 'running', error: null })
  // A rebind (signing out and into a different account, specs.md §10.28's
  // highest-risk edge case) must never show the previous profile's rows
  // even transiently under the new binding — clear before, not after, the
  // new load.
  if (isRebind) useDataStore.getState().reset()
  await useDataStore.getState().load()

  const dataState = useDataStore.getState()
  set({
    status: dataState.status === 'error' ? 'error' : 'ready',
    error: dataState.status === 'error' ? dataState.error : null,
  })
}

export const useBootStore = create<BootState>((set, get) => ({
  status: 'idle',
  error: null,
  run: () => {
    if (inFlight) return inFlight
    inFlight = runOnce(set, get)
      .catch((e) => {
        // resolveActiveProfileBinding() ultimately touches IndexedDB
        // (profile registry read/write, then opening the profile's own
        // database) — private mode, denied storage or exhausted quota can
        // throw here, before dataStore.load() ever gets a chance to land
        // its own RepoErrorCode. Same taxonomy either way (docs/error-
        // handling.md §1): never a white screen, never a silent fallback.
        set({ status: 'error', error: e instanceof RepoError ? e.code : 'unknown' })
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  },
}))

// Called once by authStore.ts's `logout()` (specs.md §10.28, §10.20): a
// sign-out ends this boot session — the *next* one may resolve an entirely
// different profile (a different Google account, or guest), so the stale
// 'ready' this session leaves behind must not survive into the next
// `BootGate` mount. Without this, a fresh `BootGate` mounted after
// logout()+login() reads `alreadyReadyAtMount` off a `status` that is still
// 'ready' from the *previous* account, renders `children` instantly, and
// only reacts once `run()`'s async resolve finds a rebind — by then the
// previous profile's rows (or a mid-reset empty state) have already been on
// screen, exactly the "even transiently" case the rebind path exists to
// prevent (confirmed via `BootGate.test.tsx`'s rebind-after-stale-ready
// case). Reachable only *between* boots — `logout()` only ever fires from a
// screen `BootGate` itself rendered, so no `run()` is ever in flight when
// this runs, and resetting `status` alone is enough; `inFlight` needs no
// attention.
export const invalidateBootForSignOut = (): void => {
  useBootStore.setState({ status: 'idle', error: null })
}

export const __resetBootStoreForTests = (): void => {
  inFlight = null
  useBootStore.setState({ status: 'idle', error: null })
}
