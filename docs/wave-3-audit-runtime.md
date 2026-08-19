# Wave 3 audit — runtime foundations

Read-only audit, 2026-08-19. Scope: offline behavior, service worker/PWA,
storage/data safety, the `repoProvider` stub, diagnostics, and auth/lock
loose ends not already in `specs.md` §12. Excludes theme, i18n coverage,
a11y, UI components, design tokens, Profile/Settings (a second agent's
scope). No code was changed.

Confidence key: **CONFIRMED** = traced directly in the code (file/line
cited). **PLAUSIBLE** = reasoned from confirmed code + well-known platform
behavior, not reproduced live.

---

## Ranked findings

### 1. There is no real offline entry path — CONFIRMED, highest priority

`specs.md` §3 commits to "offline-first" and "IndexedDB first, Drive
after." The boot path contradicts this in three independent ways, and the
one apparent escape hatch doesn't actually solve the problem:

- `authStore.restore()` (`src/lib/authStore.ts`) calls `authenticate('')`
  → `requestAccessToken('')` → `fetchGoogleUser()`, both network, on every
  cold boot with no lock enabled. Offline, this throws, is caught silently
  (deliberately, per the comment on the `catch` block), and falls back to
  `status: 'idle'` → `WelcomeScreen`. A returning user with `hasVault()`
  false and no connectivity lands on a login screen with no way in.
- `lockStore.resume()` → `authStore.hydrate()` calls `fetchGoogleUser()`
  (network) **after** `unlockWithPin`/`unlockWithBiometric` has already
  decrypted the vault locally. Offline, `hydrate()` catches the network
  failure and resolves to `status: 'error'`; `resume()` checks
  `status !== 'authenticated'` and sets
  `error: SESSION_RESTORE_ERROR` (`src/lib/lockStore.ts`). The PIN was
  correct — the app still refuses entry. The only thing `fetchGoogleUser`
  gets you here is a profile object (`GoogleUser`) that isn't even
  persisted (`user` lives only in the in-memory zustand store, never in
  the vault) — it's decoration, not authorization, exactly as flagged.
- `WelcomeScreen`'s "Continue as guest" (`continueAsGuest()`) is
  synchronous and network-free, so it technically works offline — but it
  is not a fix for the two bugs above. It creates a **different** session
  (`status: 'guest'`, §10.10), not "let this returning user back into
  their own data." A user who has been using the app online for months,
  loses connectivity, and gets bounced to `WelcomeScreen` has no
  indication that tapping the _guest_ button is even related to their
  situation — `errors.loginDefault` (`src/features/auth/errorCopy.ts`) is
  the only copy shown, a generic "couldn't sign in," not "you're offline."
  There is no dedicated offline-error key in `AUTH_ERROR_KEY` at all.
- **There is no `navigator.onLine`/`online`/`offline` reference anywhere
  in `src`** (grep confirms zero hits). Nothing in the codebase owns
  network-state knowledge; every network call just fails and is
  individually caught.

**Why foundational:** this is the exact gap between what the spec
promises and what the code does, on the single most-hit code path (every
cold boot). Retrofitting it later means touching `authStore`, `lockStore`,
`pinLock.ts`'s vault shape (to cache a usable identity/profile locally),
and the error-copy tables — all files other Wave 3 tracks will also be
touching (repo swap, diagnostics). Doing it isolated now is far cheaper
than doing it after three more tracks have grown dependencies on the
current (network-gated) `hydrate`/`restore` contracts.

**What a correct fix needs, and its security implications:**

- A small, explicit network-state owner (e.g. `navigator.onLine` +
  `online`/`offline` listeners behind a tiny store or hook), consulted
  _before_ `restore()`/`hydrate()` attempt a network call — not just
  wrapped in a `try`. `navigator.onLine` is unreliable (false positives on
  captive portals) but is strictly better than "always attempt the
  network call, silently swallow the failure."
- `hydrate()` must be able to resolve to a usable authenticated state from
  the **decrypted vault alone**, without `fetchGoogleUser`. That requires
  deciding what identity to show offline: either (a) persist a minimal
  cached profile snapshot (email/name) in the vault or a sibling table so
  the UI has something to render, refreshed opportunistically whenever a
  network call _does_ succeed, or (b) accept a profile-less "offline
  session" state and skip anything that needs `user`. Either is a real
  design decision, not a one-line change — this is why it's expensive to
  bolt on later.
- **Security implication — session lifetime while offline.** The PIN
  lock's whole model is "decrypt a cached token, then let Google's own
  token validity/session gate everything else" (§5: "access token only,
  no refresh token, silent re-auth while the Google session is alive").
  An offline session that trusts the decrypted vault has no way to learn
  the Google session was revoked, the account was deleted, or the cached
  access token's `expiresAt` has long passed — `AuthSession.expiresAt`
  already exists (`src/lib/auth.ts`) but nothing currently checks it on
  the offline path. A correct design needs an explicit **maximum offline
  session age** (e.g., derived from `lastActiveAt`/`expiresAt`, already
  present in the vault) after which offline unlock still succeeds
  cryptographically but the app either shows a "reconnect to verify"
  banner or degrades to read-only, rather than silently granting
  indefinite offline access on a PIN alone. This is a genuine
  security/UX tradeoff to record in `specs.md` §11, not an implementation
  detail.

### 2. No export/backup path for local data — CONFIRMED, not on the §12 backlog

Searched `specs.md` end to end: the only "export" mentioned is a
_possible future_ Google Sheets export of the Drive-side JSON files (§4,
"not v1"), which presupposes Drive is connected. There is no path —
planned or built — for a user to get their data **out of IndexedDB**
(download a JSON/CSV file, or otherwise back it up) independent of Drive.

For an app whose premise (§2) is "Data = in the user's own Drive... the
developer hosts and stores no one's data," a guest-mode user's data (and,
today, _every_ user's data, since `repoProvider` is stubbed to
`repo.fake` — see #3) lives **only** in one browser's IndexedDB. That
store is disposable by design (§3: "disposable; re-downloaded from Drive
if cleared") — but that assumption only holds once a Drive-backed `Repo`
exists and Drive sync is actually enabled. Until then (and permanently,
for guest mode, whose data explicitly stays local per §10.10), an
IndexedDB eviction, a Safari private-mode session ending, a user manually
clearing site data, or losing/resetting the device is unrecoverable data
loss with no warning and no recourse.

**Why foundational:** this is a data-loss risk, not a feature gap, and it
compounds every day a user runs on local-only storage before Drive
connects (or forever, for a guest). It's cheap to build now (a "export
all my data as JSON" button reading `Repo.list()`/`getConfig()` and
triggering a download) and expensive to retrofit as an emergency once
someone loses real data and asks "wait, there was no backup?" — at that
point it's also a trust/reputation cost, not just an engineering one.

**Minimum viable version:** one function that reads all three stores
through the `Repo` port (already shaped for this — `list()`,
`getConfig()`) and serializes to a single JSON file download, triggered
from a UI affordance (Settings, once it exists, or `/kit` in the
meantime). No import/restore path is required for v1 — export-only
already converts "total loss" into "recoverable with effort." This
should be scoped as its own `specs.md` §10 entry before building it (per
`AGENTS.md`), not improvised.

### 3. `repoProvider` stub swap is worth doing now, but surfaces an undecided data-scoping question

`src/lib/repoProvider.ts` returns `fakeRepo` unconditionally
(`// STUB(wave3)`). `repo.local.ts` is fully built, tested (119 tests per
§10.3.1), and completely unreachable from the running app. Swapping the
one line is real leverage: it makes the region-derived currency visible
(already noted in §12), makes every Wave 2 screen operate on real,
persisted data instead of a fixed fake dataset, and is a prerequisite for
export (#2) to mean anything (exporting `repo.fake`'s static sample data
is pointless).

What it needs decided first, beyond swapping the line:

- **Seed data**: `repo.local.ts`'s fresh-store path already seeds
  `buildSeedConfig()` correctly (region-aware, tested) — confirmed sound.
  No change needed there.
- **Demo/sample movements**: `repo.fake` ships deterministic Spanish
  sample data (§10.5) that every current screenshot/test/manual QA
  implicitly relies on. Swapping to `repo.local` means a fresh install has
  **zero** movements, not the current sample set — fine functionally, but
  worth a deliberate decision on whether `/kit`'s dev harness still wants
  a "seed sample data" affordance for manual testing (it currently gets
  that for free from `repo.fake`).
- **Guest persistence and multi-account scoping — the real open
  question.** `db.ts`'s `movimientos`/`activos`/`config` tables are
  **global to the browser profile**, not scoped by user/account.
  `specs.md` §10.10 itself flags this as deferred ("Leaving guest...
  explicitly deferred to Wave 3... when a Drive-backed Repo makes the
  question real") — but the question is actually real the moment
  `repo.local` is live, Drive or not: a guest session and an authenticated
  Google session on the same device/browser would read and write the
  **same** dexie tables today, with nothing distinguishing them. Two
  Google accounts used on the same device (shared family computer,
  browser profile) would do the same. This needs a decision — scope by
  user id (a schema change, `SCHEMA_VERSION` bump territory per
  `AGENTS.md`) or explicitly document "one browser profile = one
  account's local cache, switching accounts is unsupported until Drive
  sync exists" — **before** swapping the stub, since real user data
  starting to accumulate under the wrong scoping assumption is exactly
  the kind of thing that's cheap to fix on day one and expensive once
  people have weeks of local-only movements riding on it.

**Recommendation:** do the swap in Wave 3, but make the guest/multi-account
scoping decision (even if the decision is "explicitly unsupported for
now, document it") a precondition, not a follow-up.

### 4. Service worker: no update UX, silent `skipWaiting`/`clientsClaim` — PLAUSIBLE, not reproduced live

`vite.config.ts` sets `registerType: 'autoUpdate'` with no `injectRegister`
override (defaults to auto-injecting a bare registration script) and no
use of `virtual:pwa-register`/`registerSW`/`useRegisterSW` anywhere in
`src` (confirmed by grep — zero hits). `registerType: 'autoUpdate'`
configures the **generated** service worker for `skipWaiting: true` +
`clientsClaim: true`, meaning a new SW build activates and takes over
all open tabs' network requests as soon as it installs, with no user
notice and no code path listening for "a new version is available."

Consequence (well-known Workbox/Vite-PWA failure mode, not verified
against a live deploy in this audit): a user with the app open across a
deploy can have in-flight lazy-loaded chunk requests served against a
precache manifest that no longer contains the old build's hashed
filenames, producing a fetch/import failure mid-session with no recovery
UX beyond a manual hard reload the user isn't told to do. There is also
no "offline ready" / "update available, tap to refresh" affordance at
all — for a PWA whose whole pitch is native-app feel, silently breaking
mid-session on deploy day is the opposite of that.

**Why foundational:** the _caching strategy itself_ (globPatterns limited
to `js/css/html/svg/woff2`, `navigateFallback: '/index.html'`) is
reasonable for a pure-SPA-shell app with no runtime API caching needed —
I would not change that. What's missing is purely the **update
lifecycle**: intercepting `onNeedRefresh`/`onOfflineReady` via
`virtual:pwa-register` and either prompting the user or doing a
controlled reload at a safe point (not mid-edit). This is cheap to add
(a few lines wiring `registerSW()`, one toast/banner) and gets more
awkward to retrofit the longer the app ships without it, since by then
real users will have hit the silent-breakage mode at least once with no
diagnostic trail (see #5) to even confirm it happened.

### 5. Diagnostics: worth building, real recommendation is yes

No backend (§6) means every `console.error`/`console.warn` in the app
(7 files today: `AppErrorBoundary`, `RouteErrorFallback`, `SearchScreen`,
`lockStore`, `deviceStore`, `pinLock`, `authStore`) is invisible the
moment devtools aren't open — which is always, for a real user. The
codebase already has an unusually disciplined error taxonomy
(`docs/error-handling.md`, `RepoError` codes, "never render `.message`
raw," `cause` chaining) — all of that discipline currently dead-ends at
`console.*` with no persistence.

**Recommendation: build it, it is not over-engineering.** The minimum
viable version is small and reuses infrastructure that already exists:

- A capped ring-buffer table in `db.ts` (e.g. last ~200 entries,
  timestamp + level + message + optional `cause`/stack, no PII/secrets —
  same "never put a secret in an error" rule from
  `docs/error-handling.md` §5 applies here).
- One `logError()`/`logWarn()` helper that writes to it, called alongside
  (not instead of) the existing `console.error`/`console.warn` call
  sites — a mechanical sweep of the 7 files above.
- A viewer, gated behind `/kit` (dev) today and a real Settings entry
  later (Track G), that lists and can export the log as JSON — the same
  "download a file" mechanism #2's export needs, so building them
  together is efficient.

This directly serves the same "your data is yours, and so is knowing
what went wrong" ethos as #2, and unlike a hosted error-reporting service
it needs no backend and adds no third party — consistent with §6/§7.
Rank it below #1/#2/#3 because it's a debugging aid, not a correctness or
data-loss issue, but it is cheap and the payoff compounds with every bug
report an operator can otherwise never diagnose.

### 6. Storage/migration story: real but untested end-to-end; quota/corruption errors are generically swallowed

`repo.local.ts`'s `ready()` migration gate (`migrateSchema`, `MIGRATIONS`
registry, `schemaVersion` compare) is well-designed and unit-tested in
isolation (`migrateSchema` is exported specifically so the _dispatch
logic_ is tested independent of the registry, which is empty at v1) —
this part is sound, not nominal-only, and I would not flag it as missing
scaffolding. What I'd flag instead:

- **Dexie errors (QuotaExceededError, a blocked/corrupted database open,
  Safari private-mode `InvalidStateError`) all fold into the generic
  `RepoError('unknown', ...)` catch-all** (`src/lib/repo.local.ts`
  around the shared error-wrapping helper) — same treatment as any other
  unexpected throw. Nothing distinguishes "the disk is full" from "a bug
  in my code" for the UI to act on differently (e.g., a quota error is
  actionable — "free up space" / "export your data" — a generic unknown
  error isn't). `lockStore.init()` and `authStore`'s `syncLockedSession`
  already show the right instinct (catch broadly, degrade gracefully,
  comment on _why_ it can fail this way) — `repo.local.ts`'s bulk/CRUD
  paths don't extend that same instinct to a distinguishable
  quota/storage-unavailable code.
- This is low urgency **today** because nothing calls `repo.local`
  in the running app (#3) — but the moment the stub swaps, every write
  path (`add`, `update`, `addMany`) can hit this in production, and a
  full-quota user with no export path (#2) and no distinguishable error
  (#5 would at least log it) has genuinely no way forward. This is why
  #2/#3/#6 cluster together — they're the same underlying risk (local
  data with no escape hatch) seen from three angles.

**I would not** add a new migration mechanism or change the registry
pattern — it's the right shape already. I would add one `RepoError` code
(`'storage_unavailable'` or similar) for quota/private-mode/corruption
cases, mapped from Dexie's own error names, so the UI layer built for #2
can show something better than "unknown error" when a write fails
because the browser's storage is the problem.

### Auth/lock loose ends — checked against §12, nothing new to add

`authGeneration` inconsistency, `logout()` not calling `lockStore.lock()`,
the lock's missing i18n, and the Drive-backed `Repo`/sync story are all
already logged in §12 with accurate framing — I traced each one against
current code and they match; none is worse than recorded. No new
loose end found beyond what's folded into #1 above (the vault's
`expiresAt`/`lastActiveAt` fields already exist and are exactly what an
offline-session-lifetime policy would key off — nothing new to build
there, just a policy decision).

---

## What I would not do

- **PWA install-prompt UX (`beforeinstallprompt`).** Confirmed absent
  (zero references in `src`), but this is cheap to add at any time and
  purely additive — it doesn't get more expensive by waiting, unlike the
  items above. Not a Wave 3 foundations item.
- **Changing the service worker's precaching strategy itself.** The
  `globPatterns`/`navigateFallback` shape is correct for this app's needs
  (no API responses to cache, no runtime-caching entries needed while
  there's no backend). Only the update lifecycle (#4) needs work.
- **A general-purpose remote error-reporting/telemetry service.** Explicitly
  out of bounds per §6/§7 (no backend, no third party watching requests) —
  the local, exportable log in #5 is the right-sized version of this for
  this app, not a stepping stone toward Sentry-style telemetry.
- **Rebuilding the schema-migration mechanism.** It's sound; see #6.

## Highest-value recommendation

Fix **#1 (offline entry path)** first. It is the one item that directly
falsifies a claim already load-bearing in `specs.md` §3 ("offline-first"),
it sits on the single hottest code path (every cold boot and every
PIN/biometric unlock), and every other track this wave touches
(`repoProvider` swap, diagnostics, export) either depends on `authStore`/
`lockStore` staying stable or makes the offline gap _more_ visible once
real local data exists to be locked out of. Bundle the guest/multi-account
scoping decision from #3 into the same track's design pass, since both
require deciding what "whose data is this, offline" means.

## Where I think the operator's framing is incomplete

The brief's five items are the right shape, but #2 (export/backup) should
be promoted to the same tier as #1 rather than folded under "storage and
data safety" as one sub-question among several — it's not a migration
edge case, it's the single largest gap between what §2's "your data is
yours" promises and what the code currently guarantees for any user not
yet connected to Drive (which, per #3, is currently _every_ user, since
the stub blocks even the local repo from being live). I'd treat #1 and #2
as the two must-do items, #3 as necessary groundwork that surfaces a real
decision (not just a stub flip), and #4/#5/#6 as real but lower-urgency —
worth a Wave 3 slot each, not blocking anything else.
