import { create } from 'zustand'
import {
  AuthError,
  requestAccessToken,
  fetchGoogleUser,
  DRIVE_SCOPES,
  type AuthSession,
  type GoogleUser,
} from '@/lib/auth'
import { bootstrap, type DriveLayout } from '@/lib/bootstrap'
import { invalidateBootForSignOut } from '@/lib/boot'
import { hasVault, resetVault, updateSession } from '@/lib/pinLock'
import { resolveGoogleProfile, setActiveProfileId, DEFAULT_PROFILE_ID } from '@/lib/profiles'
import type { ProfileRecord } from '@/lib/profiles'
import {
  clearDriveDecision,
  clearGuestUsed,
  getDriveDecision,
  hasLoggedInBefore,
  hasUsedGuestBefore,
  markGuestUsed,
  markLoggedIn,
  setDriveDecision,
} from '@/lib/deviceStore'
import { useNetworkStore } from '@/lib/networkStore'

// 'guest' is a distinct status, not an 'authenticated' session with a
// synthesized user (specs.md §10.10) — anything gating on
// `status === 'authenticated'` (Drive opt-in, the lock's session sync, a
// future authenticated-only surface) is structurally false for a guest with
// no extra check, instead of relying on every such call site to also
// remember an orthogonal `mode` flag.
export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'guest' | 'error'
export type DriveOptIn = 'pending' | 'connected' | 'dismissed'

type AuthState = {
  status: AuthStatus
  user: GoogleUser | null
  // `status === 'authenticated'` with `session: null` is a real, distinct
  // case (specs.md §10.11): a returning user (hasLoggedInBefore()) restored
  // on a cold boot with no PIN lock enabled and no network to confirm a
  // live Google session with. There is no vault to decrypt on that path —
  // restore() is the no-lock boot path — so there is nothing to cache
  // locally beyond the device's own "logged in before" marker. Every
  // consumer that reads `session` already treats null as "nothing to
  // refresh/cache," never as "not authenticated"; `status` alone is what
  // gates screen access.
  session: AuthSession | null
  drive: DriveLayout | null
  error: string | null
  driveOptIn: DriveOptIn
  driveConnecting: boolean
  driveError: string | null
  login: () => Promise<void>
  restore: () => Promise<void>
  logout: () => void
  continueAsGuest: () => void
  hydrate: (session: AuthSession, cachedUser: GoogleUser | null) => Promise<void>
  connectDrive: () => Promise<void>
  dismissDrive: () => void
}

// Narrower than "any authenticate() failure": access_denied/popup_closed/
// popup_failed_to_open/missing-client-id are all real, non-network outcomes
// that must not downgrade the network hint. GIS failing to load its own
// script, or anything that isn't even an AuthError (the shape a raw fetch()
// TypeError takes when fetchGoogleUser's request can't reach the network at
// all), is the actual network-shaped signal (docs/wave-3-audit-runtime.md
// finding 1 / specs.md §10.11: "let a failed request downgrade the state").
const isNetworkShapedAuthFailure = (e: unknown): boolean => {
  if (e instanceof AuthError) return e.message === 'auth: GIS failed to load'
  return true
}

const authenticate = async (prompt: '' | 'consent') => {
  try {
    const session = await requestAccessToken(prompt)
    const user = await fetchGoogleUser(session.accessToken)
    useNetworkStore.getState().reportOnlineSuccess()
    return { session, user }
  } catch (e) {
    if (isNetworkShapedAuthFailure(e)) useNetworkStore.getState().reportOnlineFailure()
    throw e
  }
}

// Keeps the PIN-lock vault's cached token/profile fresh whenever a new
// AuthSession lands, so an enabled lock stays convenient after the token
// first expires (specs.md §12). Must never fail the auth flow it rides on: a
// no-op when no vault exists, and best-effort if the vault exists but isn't
// unlocked in this tab (a caching side effect, not the primary outcome of the
// call) — so the whole body is one try, including the hasVault() read itself
// (an IndexedDB call that can throw on its own: Safari private mode,
// storage-quota errors, a blocking extension). Failures are logged, not
// swallowed silently, so a genuine vault problem stays visible without
// breaking the auth flow.
const syncLockedSession = async (session: AuthSession, user: GoogleUser | null): Promise<void> => {
  try {
    if (!(await hasVault())) return
    await updateSession(session, user)
  } catch (e) {
    console.warn('lock: failed to sync the cached session', e)
  }
}

// specs.md §10.20 (CONFIRMED, traced): logout() used to clear only in-memory
// state, never the encrypted session cached inside the PIN-lock vault — a
// correct PIN afterwards ran unlockWithPin() → resume() → hydrate() with
// that same cached session and landed the user right back in the account
// they just left. The vault exists to cache *this account's* token
// (specs.md §10.2's "PIN reset = re-login with Google" precedent already
// accepts losing the PIN as the honest cost); with no account left to
// protect, resetVault() is the existing, already-tested operation that
// removes it — and, as a side effect, this device's login marker and Drive
// decision too, so a returning visit needs a real re-login rather than
// restore()'s silent path picking the same account back up. Fire-and-forget
// and self-catching, same posture as syncLockedSession above: logout()'s own
// state reset already happened synchronously by the time this is called, so
// a storage failure here must never trap the user inside the account they
// are trying to leave (specs.md §10.20's edge cases).
const invalidateVaultOnLogout = async (): Promise<void> => {
  try {
    await resetVault()
  } catch (e) {
    console.error('lock: failed to invalidate the vault on sign-out', e)
  }
}

// The one place `user.sub ?? user.email` is decided (specs.md §11,
// 2026-08-19's `sub`-over-`email` reasoning, spelled out on
// `syncProfileForAccount` below) — exported so `sync/syncSession.ts` and
// `profiles/switchProfile.ts` can compare "is the currently authenticated
// account this profile's owner" without each re-deriving the same fallback
// (specs.md §10.31 §4: sync must follow a switch only when the newly bound
// profile's account matches the one actually signed in).
export const accountKeyOf = (user: GoogleUser | null): string | undefined =>
  user ? (user.sub ?? user.email) : undefined

// specs.md §10.20: a `ProfileRecord` now records *whose* it is
// (`accountKey`), not only what kind it is. specs.md §10.31 §1 adds the
// explicit active-profile pointer on top: `setActiveProfileId` here is what
// makes signing back into a previously-used account land on it directly,
// rather than relying on `resolveGoogleProfile`'s own recency touch (still
// happening below, kept as the fallback for a device that predates the
// pointer or whose pointer write is lost) to happen to win. Guest sessions
// never call this (no accountKey to key on — the local/guest profile is
// untouched, see `continueAsGuest` below for its own pointer write).
// Self-catching and never awaited by the caller as a gate: a registry write
// failure must never fail the auth flow it rides on, same posture as
// syncLockedSession. Returns the resolved profile so `login()` can check
// whether it has local guest data to offer for adoption (specs.md §10.32).
//
// Keyed on `user.sub` — the OIDC subject identifier, stable and never
// reassigned — not `user.email` (specs.md §11, 2026-08-19). A Workspace
// admin can rename a primary address; keying on email would resolve a
// renamed account to a brand-new profile with none of its data, which
// reads to the user as total loss. `email` is a defensive fallback only,
// for a cached/legacy `GoogleUser` that predates this field — every live
// `fetchGoogleUser()` response carries `sub`.
const syncProfileForAccount = async (user: GoogleUser | null): Promise<ProfileRecord | null> => {
  if (!user) return null
  try {
    const record = await resolveGoogleProfile({
      accountKey: user.sub ?? user.email,
      label: user.name,
    })
    await setActiveProfileId(record.id)
    return record
  } catch (e) {
    console.warn('profiles: failed to resolve the profile for this account', e)
    return null
  }
}

// A device that already answered the Drive prompt — this session or a prior
// one — must not be asked again (specs.md §11, 2026-08-18 driveOptIn entry,
// superseded by the 2026-08-19 entry this track adds). Only consult storage
// when the current session doesn't already have an answer: a mid-session
// re-lock/unlock already knows it (driveOptIn is 'connected'/'dismissed' in
// memory by then), so re-reading IndexedDB on every hydrate() would be a
// redundant round trip, not a correctness fix — and it would also defeat the
// "hydrate never re-prompts Drive mid-session" guarantee if storage and
// memory were ever transiently out of sync. A storage read failure degrades
// to 'pending' (same posture as hasLoggedInBefore) — show the screen rather
// than silently assume an answer that isn't there.
const resolveDriveOptIn = async (current: DriveOptIn): Promise<DriveOptIn> => {
  if (current !== 'pending') return current
  return (await getDriveDecision()) ?? 'pending'
}

// The identity-only token authenticate() returns carries no Drive scope
// (specs.md §5: Drive scopes are requested separately, incremental
// authorization) — shared by connectDrive() (user-initiated, surfaces
// errors) and reacquireDrive() below (automatic, silent). bootstrap()'s
// find-before-create idempotency (specs.md §10.1) is what makes repeating
// this safe.
const requestDriveSession = async (): Promise<{ session: AuthSession; drive: DriveLayout }> => {
  const session = await requestAccessToken('', DRIVE_SCOPES)
  const drive = await bootstrap(session.accessToken)
  return { session, drive }
}

// 'drive' is never persisted (specs.md §4: derived/session state, only the
// *decision* is), so a persisted driveOptIn === 'connected' only records
// that Drive was reachable in a *past* session — a fresh session (drive
// still null in memory) needs it re-fetched, or driveOptIn === 'connected'
// becomes a memory of a past connection rather than an honest signal that
// Drive is actually usable right now (CONFIRMED gap, caught in review: a
// returning device would land authenticated with driveOptIn 'connected',
// drive null, and no Drive-scoped token at all, with no UI left to fix it
// once the DrivePermissionScreen stops reappearing). Best-effort, same
// posture as syncLockedSession above: must never fail or delay the auth
// flow it rides on, and must never surface through driveError — that
// surface is for a user-initiated connectDrive() call from a screen that
// owns it (docs/error-handling.md §7), not an automatic background retry.
// requestAccessToken('', ...) fails silently rather than re-prompting if the
// grant was revoked externally (specs.md §5) — correct: fail quietly, the
// user recovers through the profile sheet's identity row (specs.md §10.18).
const reacquireDrive = async (): Promise<{ session: AuthSession; drive: DriveLayout } | null> => {
  try {
    return await requestDriveSession()
  } catch (e) {
    console.warn('drive: could not silently re-acquire a previously connected Drive session', e)
    return null
  }
}

// Fire-and-forget (callers do `void reacquireDriveIfNeeded(...)`), never
// awaited by login/restore/hydrate — CONFIRMED in code review: awaiting it
// there meant lockStore.resume() (which awaits hydrate()'s full promise
// before leaving `phase: 'locked'`) blocked a correct-PIN unlock on a
// silent token request plus bootstrap()'s up to five sequential, un-timed-
// out Drive calls, with LockScreen showing no busy state at all. The auth
// flow's outcome never depended on this completing — status/driveOptIn are
// already settled and synced (syncLockedSession(session), the identity-only
// token) before this is even fired — so it must not be on that flow's
// critical path.
//
// Guarded on `drive === null`, not on driveOptIn alone: a mid-session
// re-lock/unlock already has `drive` populated from earlier this session
// (either connectDrive() or an earlier call to this same function), so it
// must not re-run bootstrap() on every unlock — only a genuinely fresh
// session (drive still null) needs this. Also guarded on `authGeneration`,
// same as connectDrive() below — now load-bearing rather than
// belt-and-suspenders, since going fire-and-forget widens (not narrows) the
// window in which a logout() can land while this is still in flight: a
// stale resolve must not resurrect a session/drive for an account the user
// already signed out of. On success it owns its own follow-up —
// syncLockedSession() with the upgraded Drive-scoped session — since the
// caller already synced the identity-only one and isn't waiting around for
// this to finish; two writes to the vault, later one wins, which is
// strictly better than the vault sync blocking on a network round trip that
// may never resolve.
const reacquireDriveIfNeeded = async (
  driveOptIn: DriveOptIn,
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState,
): Promise<void> => {
  if (driveOptIn !== 'connected' || get().drive !== null) return
  const generation = authGeneration
  const reacquired = await reacquireDrive()
  if (!reacquired || generation !== authGeneration) return
  set({ session: reacquired.session, drive: reacquired.drive })
  // Drive scope acquisition never touches the profile — cache whatever
  // user is already known rather than passing null and blowing away a
  // previously-cached one.
  await syncLockedSession(reacquired.session, get().user)
}

// hydrate()'s fire-and-forget counterpart to reacquireDriveIfNeeded above:
// fetchGoogleUser() is a refresh, never a gate (specs.md §10.11) — the vault
// decrypt already proved identity locally, so this only ever makes an
// already-authenticated `user` fresher, never blocks or undoes entry.
const refreshProfile = async (
  session: AuthSession,
  generation: number,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> => {
  try {
    const user = await fetchGoogleUser(session.accessToken)
    useNetworkStore.getState().reportOnlineSuccess()
    if (generation !== authGeneration) return
    set({ user })
    await syncLockedSession(session, user)
  } catch (e) {
    if (isNetworkShapedAuthFailure(e)) {
      useNetworkStore.getState().reportOnlineFailure()
      // Silent, same reasoning as restore()'s own catch (docs/error-
      // handling.md §2's documented exception): failing to refresh the
      // cached profile while offline is the routine, expected outcome for
      // every biometric/PIN unlock in airplane mode, not a symptom of
      // something broken. The cached profile from the vault decrypt is
      // already on screen; this only ever makes it fresher.
      return
    }
    console.warn('auth: could not refresh the cached profile', e)
  }
}

// logout() bumps this so a connectDrive()/reacquireDriveIfNeeded() request
// already in flight can tell, on resolve, that it should discard its result
// instead of resurrecting state.
let authGeneration = 0

const errorMessage = (e: unknown): string => {
  return e instanceof Error ? e.message : 'unknown error'
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  session: null,
  drive: null,
  error: null,
  driveOptIn: 'pending',
  driveConnecting: false,
  driveError: null,
  login: async () => {
    const generation = authGeneration
    set({ status: 'authenticating', error: null })
    try {
      const { session, user } = await authenticate('consent')
      const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
      if (generation !== authGeneration) return
      // Resolved *before* the status flip below, not after (specs.md
      // §10.28): the boot sequence reads the active-profile registry the
      // instant `status` becomes 'authenticated', so a fresh sign-in must
      // already be the most-recently-touched profile by that moment — never
      // a race against whichever profile recency last pointed at.
      await syncProfileForAccount(user)
      if (generation !== authGeneration) return
      set({ status: 'authenticated', session, user, driveOptIn })
      await syncLockedSession(session, user)
      void reacquireDriveIfNeeded(driveOptIn, set, get)
      // Explicit, user-initiated success only — the signal restore() below
      // gates on (specs.md §11, 2026-08-19). markLoggedIn() self-catches, so
      // this can never fail the login it rides on.
      await markLoggedIn()
      // specs.md §10.33 decision 2: signing in with Google is one of the two
      // ways a guest marker is cleared — a stale one outliving the choice
      // would send this now-signed-in user back into guest mode on the next
      // cold start. Unconditional (not "only if status was 'guest'"):
      // clearGuestUsed() self-catches and clearing an absent marker is a
      // no-op, so there's no case where guarding this saves anything.
      await clearGuestUsed()
    } catch (e) {
      if (generation !== authGeneration) return
      set({ status: 'error', session: null, user: null, drive: null, error: errorMessage(e) })
    }
  },
  // Silent re-auth for the no-lock boot path (specs.md §5): RequireAuth calls
  // this once on mount, only while status is still 'idle'. When a PIN lock is
  // enabled, lockStore.resume() already owns restoring the session on unlock —
  // it never leaves status at 'idle', so this guard also keeps the two restore
  // paths from racing each other.
  //
  // Also gated on hasLoggedInBefore(): prompt: '' is only silent when this
  // client already holds a grant — on a genuine first-ever visit it can
  // surface real Google UI before the user clicks anything, and after a
  // lockout (pinLock.resetVault() clears the marker) it must NOT silently
  // sign the same account back in, or the lockout's forced re-login is
  // undone within about a second (specs.md §11, 2026-08-19, findings 4/6).
  restore: async () => {
    if (get().status !== 'idle') return
    // Claim 'authenticating' before the async marker read, not after: two
    // concurrent restore() calls both reading status 'idle' and only *then*
    // awaiting the marker would otherwise both pass this guard and both fire
    // authenticate('') — the exact race this synchronous-check-then-set
    // pairing existed to prevent in the first place.
    set({ status: 'authenticating' })
    const generation = authGeneration
    if (!(await hasLoggedInBefore())) {
      // specs.md §10.33: the account marker wins when both exist (checked
      // above, so this branch only runs when it's absent) — a device with
      // no account history but a guest marker is a returning guest, not a
      // first-ever visit, and must land directly on 'guest', never
      // WelcomeScreen. Mirrors continueAsGuest()'s own reset shape (no
      // session/user/drive to restore — a guest never had any).
      if (await hasUsedGuestBefore()) {
        if (generation !== authGeneration) return
        set({
          status: 'guest',
          user: null,
          session: null,
          drive: null,
          error: null,
          driveOptIn: 'pending',
          driveConnecting: false,
          driveError: null,
        })
        return
      }
      if (generation !== authGeneration) return
      set({ status: 'idle' })
      return
    }
    // Consulted before attempting the network call at all
    // (docs/wave-3-audit-runtime.md finding 1's own recommendation), not
    // just wrapped in a try: navigator.onLine is a hint that lies in one
    // direction (true on a dead connection), so this only ever *skips* a
    // doomed attempt — it never blocks a genuine one when the hint happens
    // to be wrong (the residual gap: a captive portal that reports online
    // while every real request fails still reaches the catch below and
    // falls back to 'idle', same as before this fix).
    if (!useNetworkStore.getState().online) {
      // No vault exists on this path — restore() is the no-lock boot path,
      // lockStore.resume()/hydrate() owns the vaulted one — so there is
      // nothing locally encrypted to decrypt. The device's own "logged in
      // before" marker, already checked above, is the only evidence
      // available; session/user stay null (see the AuthState.session
      // comment). The local repo's own data is readable regardless of
      // session validity (specs.md §10.11's whole point) — a stale/absent
      // Google session blocks nothing here.
      const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
      if (generation !== authGeneration) return
      set({ status: 'authenticated', session: null, user: null, driveOptIn, error: null })
      return
    }
    try {
      const { session, user } = await authenticate('')
      const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
      if (generation !== authGeneration) return
      // Same reordering as login() above, and for the identical reason
      // (specs.md §10.28): resolved before the status flip, not after.
      await syncProfileForAccount(user)
      if (generation !== authGeneration) return
      set({ status: 'authenticated', session, user, driveOptIn })
      await syncLockedSession(session, user)
      void reacquireDriveIfNeeded(driveOptIn, set, get)
    } catch {
      // Deliberately silent, unlike syncLockedSession's console.warn
      // (docs/error-handling.md §2): a silent-auth attempt failing is the
      // routine, expected outcome for anyone without a live Google session
      // (most first visits), not a symptom of something broken — logging it
      // would be noise on every such visit, not a signal. It also isn't the
      // last word on whether login works: falling back to 'idle' shows
      // WelcomeScreen, and an explicit login() from there has its own
      // error-visible path (status: 'error', §7's error-copy mapping) if
      // the real problem persists.
      if (generation !== authGeneration) return
      set({ status: 'idle' })
    }
  },
  logout: () => {
    authGeneration += 1
    set({
      status: 'idle',
      user: null,
      session: null,
      drive: null,
      error: null,
      driveOptIn: 'pending',
      driveConnecting: false,
      driveError: null,
    })
    // A different Google account can sign in on this same device next —
    // the previous account's Drive decision must not carry over to it
    // (specs.md §11, 2026-08-19). Fire-and-forget: clearDriveDecision()
    // self-catches (docs/error-handling.md §7), and logout() itself is
    // synchronous — nothing here can fail the state reset above.
    void clearDriveDecision()
    // specs.md §10.20: sign-out invalidates the vault (see
    // invalidateVaultOnLogout's own comment for why). Fire-and-forget for
    // the same reason as clearDriveDecision above.
    void invalidateVaultOnLogout()
    // specs.md §10.28: the next boot may resolve a different profile than
    // this session's — a stale 'ready' left in useBootStore would let the
    // next BootGate mount render its children before that boot has
    // actually verified anything (invalidateBootForSignOut's own comment
    // has the full case). Synchronous, unlike the two calls above: nothing
    // async to wait on.
    invalidateBootForSignOut()
  },
  // No Google session exists to acquire Drive scopes for (specs.md §10.10),
  // so unlike login()/restore()/hydrate() this never touches driveOptIn's
  // persisted device signal — it just resets the in-memory field back to
  // its default so a stale 'connected'/'dismissed' from a *prior*
  // authenticated session on this same store instance can't leak into the
  // guest state (status === 'guest' already skips RequireAuth's driveOptIn
  // check entirely, but a value other than the default would still be a
  // lie about what this session's Drive state actually is). authGeneration
  // bumps for the same reason logout() bumps it: an in-flight
  // connectDrive()/reacquireDriveIfNeeded() from whatever session preceded
  // this guest entry must not resurrect session/drive once resolved.
  // Typed `() => void` on AuthState (WelcomeScreen calls it fire-and-forget
  // from an onClick), but the body below is async and awaits before its own
  // `set()` — TS's void-returning-function compatibility allows a caller to
  // ignore the returned Promise. This is not cosmetic: `status` flipping to
  // 'guest' is what makes RequireAuth render BootGate, whose effect reads
  // the profile registry (specs.md §10.28) practically immediately. A build
  // that fired the pointer write after `set()` (proven, when this used to
  // be a recency touch instead, by src/features/boot/guestBootRace.test.tsx,
  // which reproduced the loss on every run, not intermittently) let that
  // read win the race against the write nearly every time.
  continueAsGuest: async () => {
    authGeneration += 1
    const generation = authGeneration
    // specs.md §10.31 §1: the explicit active-profile pointer. Without this,
    // a device that signed out of a Google account and then chose to
    // continue as guest would resolve *that* account's profile on the next
    // boot — it was touched more recently than the untouched default local
    // one — and read/write a guest's data into the signed-out account's
    // local database. Replaces what used to be a `touchLastUsed
    // (DEFAULT_PROFILE_ID)` recency-race workaround (specs.md §11,
    // 2026-08-20): that patch existed only because the active profile was
    // inferred by recency alone: with an explicit pointer, `getActiveProfile
    // ()` consults it directly and no longer needs recency to happen to be
    // correct. `resolveActiveProfileBinding()`'s own `touchLastUsed` call
    // (repoProvider.ts) still bumps recency moments later, during the boot
    // this triggers — this function no longer needs to do it itself.
    // Self-catching (profiles/profileRegistry.ts), so a storage failure here
    // degrades to stale recency, never blocks entering guest mode. Awaited
    // *before* the status flip below for the identical reason login()/
    // restore() await syncProfileForAccount() first — see this function's
    // own doc comment above.
    await setActiveProfileId(DEFAULT_PROFILE_ID)
    // specs.md §10.33: the device-local signal restore() reads on a later
    // cold start to recognise a returning guest — awaited before the status
    // flip for the same reason the pointer write above is (this function's
    // own doc comment above): nothing downstream races on it this session,
    // but keeping every write that must land before `status: 'guest'`
    // becomes observable in one place is simpler than deciding, per write,
    // whether it happens to matter this time. markGuestUsed() self-catches,
    // so a storage failure here degrades to "not remembered next time",
    // never to failing this entry.
    await markGuestUsed()
    if (generation !== authGeneration) return
    set({
      status: 'guest',
      user: null,
      session: null,
      drive: null,
      error: null,
      driveOptIn: 'pending',
      driveConnecting: false,
      driveError: null,
    })
  },
  // Fires on a mid-session re-lock/unlock too (Page Visibility timeout,
  // §10.2), not only on cold start — resolveDriveOptIn() only consults
  // storage when driveOptIn is still 'pending', so a mid-session unlock
  // (already resolved earlier this session) never re-triggers the
  // Drive-permission screen. A PIN-lock cold start (vault already existed
  // when this tab opened) is the one path where this *is* the first
  // resolution this session, and must look the persisted decision up —
  // and, via reacquireDriveIfNeeded, must also re-fetch `drive` itself,
  // since 'drive' is never persisted alongside the decision. Deliberately
  // does not await reacquireDriveIfNeeded: lockStore.resume() awaits this
  // function's whole promise before leaving `phase: 'locked'`, so anything
  // awaited here directly delays a correct-PIN unlock (see
  // reacquireDriveIfNeeded's own comment) — syncLockedSession(session) still
  // is awaited, but that's a fast local IndexedDB write, not a network call.
  // The vault decrypt that produced `session`/`cachedUser` already proved
  // identity locally (specs.md §10.11) — this never gates on a network call
  // the way it used to (fetchGoogleUser was the network call that stranded
  // an offline correct-PIN unlock). Nothing left in the body below can
  // throw (resolveDriveOptIn/syncLockedSession both self-catch), so there
  // is deliberately no try/catch here anymore — see lockStore.resume()'s
  // own comment for why it still checks the outcome instead of assuming it.
  hydrate: async (session, cachedUser) => {
    const generation = authGeneration
    const driveOptIn = await resolveDriveOptIn(get().driveOptIn)
    if (generation !== authGeneration) return
    set({ status: 'authenticated', session, user: cachedUser, driveOptIn, error: null })
    await syncLockedSession(session, cachedUser)
    await syncProfileForAccount(cachedUser)
    void reacquireDriveIfNeeded(driveOptIn, set, get)
    // fetchGoogleUser() is a refresh, never a gate. Fire-and-forget, same
    // reasoning as reacquireDriveIfNeeded just above: lockStore.resume()
    // awaits this function's whole promise before leaving `phase: 'locked'`,
    // so a network call directly in this body would delay a correct-PIN
    // unlock with no busy state to explain it (LockScreen has none).
    void refreshProfile(session, generation, set)
  },
  connectDrive: async () => {
    const generation = authGeneration
    set({ driveConnecting: true, driveError: null })
    try {
      const { session, drive } = await requestDriveSession()
      // A logout() while this request was in flight must win — don't resurrect
      // a session/drive layout for an account the user already signed out of.
      if (generation !== authGeneration) return
      set({ session, drive, driveOptIn: 'connected', driveConnecting: false })
      // Drive scope acquisition never touches the profile — cache whatever
      // user is already known.
      await syncLockedSession(session, get().user)
      // Recorded on success only: if requestDriveSession() above throws
      // (network, 401/403, popup closed), driveOptIn is never set to
      // 'connected' and nothing is persisted either — the recorded state
      // must reflect what actually happened, not what was attempted (this
      // track's brief, edge cases). setDriveDecision self-catches, so a
      // storage write failure here can't undo the connection that already
      // succeeded.
      await setDriveDecision('connected')
    } catch (e) {
      if (generation !== authGeneration) return
      set({ driveConnecting: false, driveError: errorMessage(e) })
    }
  },
  dismissDrive: () => {
    set({ driveOptIn: 'dismissed' })
    // Fire-and-forget: setDriveDecision self-catches, and dismissDrive is
    // synchronous UI state — a storage write failure here just means the
    // device is asked again next time, not that "Ahora no" stops working.
    void setDriveDecision('dismissed')
  },
}))
