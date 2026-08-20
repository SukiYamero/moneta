import { DRIVE_SCOPES, requestAccessToken } from '@/lib/auth'
import { useAuthStore } from '@/lib/authStore'
import { i18next } from '@/lib/i18n'
import { isSupportedLocale, type SupportedLocale } from '@/lib/i18n/resources'
import { useOutboxStore } from '@/lib/outbox'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import {
  pull,
  push,
  startSyncTriggers,
  useSyncStore,
  type SyncContext,
  type SyncTriggerHandle,
} from '@/lib/sync/engine'
import { toast } from '@/lib/toastStore'

// syncSession.ts — the live context specs.md §10.26 §2 asks for, and the
// one place that starts/stops `engine.ts`'s triggers. Neither the token nor
// the profile may be captured once: this module re-reads `authStore`'s
// current session and `repoProvider`'s current binding on every trigger
// firing (via the getter `startSyncTriggers` already takes), not once at
// `startSyncSession()` time.

// A token is refreshed this far ahead of its real expiry, not exactly at
// it — a trigger firing with a token already dead on arrival is a
// user-facing 401, not "reacquire and continue" (specs.md §10.11's own
// language for this exact situation, applied here to §10.26's "token
// expires mid-pull" edge case).
const TOKEN_REFRESH_SKEW_MS = 60_000

const currentLocale = (): SupportedLocale => {
  const lng = i18next.resolvedLanguage ?? i18next.language
  return isSupportedLocale(lng) ? lng : 'es'
}

/**
 * Silent, GIS-standard re-auth for a scope this session already granted
 * (the identical shape `authStore.ts`'s own `requestDriveSession` uses) —
 * never surfaced to the user, since a trigger firing in the background is
 * not the place for a consent prompt. `authStore`'s own `session` is
 * updated on success so every *other* reader of it (the vault sync, a
 * future push/pull in the same tick) also sees the fresh token, not just
 * this one call. A failure is logged and treated as "not eligible right
 * now" — the next trigger retries, matching every other self-healing
 * degrade in this module (docs/error-handling.md §7: a background retry
 * loop, not a dead end).
 */
const reacquireDriveToken = async (): Promise<string | null> => {
  try {
    const session = await requestAccessToken('', DRIVE_SCOPES)
    useAuthStore.setState({ session })
    return session.accessToken
  } catch (e) {
    console.warn(
      'sync: could not silently refresh the Drive-scoped token, will retry on the next trigger',
      e,
    )
    return null
  }
}

/**
 * Eligible only with a Drive-scoped session (`drive !== null` — set only by
 * `connectDrive()`/`reacquireDriveIfNeeded()`, always alongside the
 * matching `session`, so the two are never mismatched — see
 * `authStore.ts`'s own comments) and an active profile already bound by the
 * boot sequence. A guest (`status !== 'authenticated'`) and a signed-in
 * user who never connected Drive (`drive === null`) both resolve to `null`
 * here, which is what keeps `startSyncTriggers`' every trigger a safe
 * no-op for them — specs.md §10.26's "a guest must never start triggers"
 * is enforced by never handing them a context, not by a separate guard.
 */
export const getSyncContext = async (): Promise<SyncContext | null> => {
  const { status, drive, session } = useAuthStore.getState()
  if (status !== 'authenticated' || drive === null || session === null) return null

  const binding = getActiveProfileBinding()
  if (!binding) return null

  const token =
    Date.now() >= session.expiresAt - TOKEN_REFRESH_SKEW_MS
      ? await reacquireDriveToken()
      : session.accessToken
  if (!token) return null

  return { token, profile: binding.profile, locale: currentLocale() }
}

let handle: SyncTriggerHandle | null = null

/**
 * The one place `startSyncTriggers`' returned handle is owned in
 * production (specs.md §10.26 §2 — until this, only the engine's own tests
 * ever called it). Idempotent: a second call while already started is a
 * no-op, so every eligible-transition hookpoint in `authStore.ts` can call
 * this unconditionally rather than each having to know whether another one
 * already did.
 */
export const startSyncSession = (): void => {
  if (handle) return
  handle = startSyncTriggers(getSyncContext)
}

/**
 * Stops on sign-out, on guest entry, and on lock (specs.md §10.26 §2) — the
 * hookpoints live in `authStore.ts`/`lockStore.ts`. Safe to call when
 * nothing is running: `stop()` only removes listeners that were actually
 * attached, and a locked/logged-out phase that never started a session
 * simply no-ops here.
 */
export const stopSyncSession = (): void => {
  handle?.stop()
  handle = null
}

/**
 * "Pull on app open" (specs.md §10.19's "when it syncs") — the reliable
 * place for it turns out to be the first-run gate (`src/features/sync/
 * FirstSyncGate.tsx`), not `startSyncSession()`'s own start moment: that
 * moment is driven by `authStore`'s `drive` field becoming non-null, which
 * can fire *before* `boot.ts` has bound an active profile (the automatic
 * `reacquireDriveIfNeeded()` path runs from `RequireAuth`, a sibling of
 * `BootGate`, not a child of it) — `getSyncContext()` would then see no
 * binding and silently no-op the very "pull on open" this exists for.
 * `FirstSyncGate` mounts strictly after boot is `'ready'`, so calling this
 * from there is the one place a binding is guaranteed to exist. A no-op,
 * not a failure, when there's nothing to sync (guest, no Drive) — the
 * caller doesn't need to check eligibility itself first.
 */
export const runInitialSync = async (): Promise<void> => {
  const ctx = await getSyncContext()
  if (!ctx) return
  await pull(ctx.token, ctx.profile, ctx.locale).catch((e: unknown) =>
    console.warn('sync: initial pull failed, will retry on the next trigger', e),
  )
  if (useOutboxStore.getState().dirty) {
    await push(ctx.token, ctx.profile).catch((e: unknown) =>
      console.warn('sync: initial push failed, will retry on the next trigger', e),
    )
  }
}

export const __resetSyncSessionForTests = (): void => {
  handle?.stop()
  handle = null
}

const isEligible = (state: { status: string; drive: unknown }): boolean =>
  state.status === 'authenticated' && state.drive !== null

// The actual start/stop wiring — a reactive subscription on `authStore`,
// not explicit calls added inside `login`/`restore`/`hydrate`/`connectDrive`/
// `logout`/`continueAsGuest`. `authStore.ts` cannot import this module back:
// this module already imports `authStore.ts` for `useAuthStore.getState()`
// above, and a reverse import would be the exact circular dependency
// `lockStore.ts`'s own bottom-of-file subscription comment describes for
// the identical shape of problem — so, like that one, this module listens
// for the transition it cares about from the outside instead. Covers every
// path that can make `drive` go from `null` to set (`connectDrive()`,
// `reacquireDriveIfNeeded()` from any of `login`/`restore`/`hydrate`) and
// every path that clears it (`logout()`, `continueAsGuest()`) with one rule
// instead of one call added at each site — a future auth path that starts
// setting `drive` doesn't need to remember this module exists.
//
// "Stop on lock" is *not* covered here: `lockStore.ts`'s `lock()` never
// touches `authStore`'s `status`/`drive` at all (locking is a lockStore-
// only state flip), so this subscription would never fire for it — that
// hookpoint lives in `lockStore.ts` itself, the one place that can see it
// (this module must not import `lockStore.ts`, or the same circular-import
// problem reappears in the other direction). `hydrate()`'s own `set()` on a
// successful unlock — called unconditionally, not only when a value
// actually changed — is what restarts it: `startSyncSession()`'s
// idempotency means firing on every authStore update, not just a genuine
// eligibility flip, costs nothing.
useAuthStore.subscribe((state, prev) => {
  if (isEligible(state) === isEligible(prev)) return
  if (isEligible(state)) startSyncSession()
  else stopSyncSession()
})

// The revived-movement notice (specs.md §10.19: "the app briefly says
// why," §10.26 §4). One subscriber here, not a toast call added at each of
// `pull()`'s several call sites (the trigger wiring, the first-run download
// view, a manual retry) — `lastPullSummary` changing is the one signal that
// covers all of them, so whichever call site actually ran the pull, the
// notice fires exactly once. Reference-equality check: `pullOnce()` sets a
// fresh object every real pull, but two coalesced `pull()` callers
// (specs.md §10.26 §1) share the *same* object, so this never double-fires
// for one pull.
useSyncStore.subscribe((state, prev) => {
  if (state.lastPullSummary === prev.lastPullSummary) return
  const revived = state.lastPullSummary?.revivedMovIds.length ?? 0
  if (revived === 0) return
  // toastStore.ts's `ToastMessageKey` is a plain leaf-path type with no
  // i18next plural-suffix awareness (unlike `useTranslation()`'s own `t()`,
  // which resolves `notices.revived` to the right `_one`/`_other` key
  // internally) — picking the literal key here, once, is cheaper and safer
  // than teaching that shared, load-bearing type a new pluralization rule
  // for this one caller.
  toast.success(revived === 1 ? 'sync:notices.revived_one' : 'sync:notices.revived_other', {
    count: revived,
  })
})
