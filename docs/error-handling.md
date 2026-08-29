# Error handling — the standard

Ground truth is code; this doc explains the _why_ and settles arguments. If a
rule here and the code disagree, fix whichever one is wrong and update this
doc in the same change.

## 1. The error taxonomy

Two layers, two different needs:

- **Data/auth layer** (`repo.ts`, `auth.ts`, `pinLock.ts`, `drive.ts`) —
  async, fallible I/O. Callers sometimes need to _branch_ on why something
  failed (retry? show "wrong PIN"? re-auth?), so these get typed error
  classes.
- **UI layer** (components, event handlers) — callers there almost never
  branch on error identity; they render a message and stop. See §7.

**The pattern, already established by `RepoError`:**

```ts
export type RepoErrorCode =
  | 'not_found'
  | 'schema_mismatch'
  | 'invalid_input'
  | 'network'
  | 'unknown'

export class RepoError extends Error {
  readonly code: RepoErrorCode
  constructor(message: string, code: RepoErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoError'
    this.code = code
  }
}
```

One `Error` subclass per module/contract, with a `readonly code` union
whenever callers need to branch on more than "did it fail" — never one
subclass per failure case. `WrongPinError` / `LockedOutError` /
`BiometricUnavailableError` in `pinLock.ts` are the one place this repo does
it the other way (three classes, no shared code); that's fine there because
each is checked with `instanceof` at exactly one call site (`lockStore.resume`)
and they'll never need a `switch`. If a second call site ever needs to branch
across them, collapse them into one `LockError` with a `code` instead of
adding a fourth class — don't let the pattern proliferate.

**Adding a new code:**

1. Name the question a caller genuinely can't answer today (e.g. "bad input
   I handed you" vs. "something broke on your end" must not collapse into
   one code a caller can't branch on).
2. Append to the union. Never remove or repurpose an existing code — anything
   pattern-matching on it today keeps working.
3. Grep for existing consumers first (`rg "RepoErrorCode\|\.code ==="`). A
   `Record<RepoErrorCode, …>` lookup anywhere in the codebase (see the
   coding-rules lookup-table rule) makes TypeScript refuse to compile until
   every consumer handles the new case — let that exhaustiveness check do
   the work, not manual auditing.
4. Record the change as a rule in the relevant `specs.md` §10 entry.

`AuthError` and `DriveError` are plain `Error` subclasses today with no
`code` — that's correct as long as every call site only asks "did it fail,"
which is true right now (`WelcomeScreen`/`DrivePermissionScreen` just render
the message). The day a caller needs to branch (e.g. "popup closed by user"
vs. "network down" vs. "origin not authorized"), give `AuthError` a `code`
union the same way, not a pile of `instanceof` checks.

## 2. Where to catch, and where not to

Two failure modes, both real:

- **Catching too early, too broadly**: a `catch {}` at the wrong level turns
  a real bug into silence.
- **Catching too late, too narrowly**: a `try` that doesn't cover the whole
  logical operation lets an unrelated failure escape mislabeled.

**Catch where you can _do_ something about the failure** — set UI state,
decide whether to retry, translate to user-facing copy, roll back a partial
write. If a `catch` block's only content is re-throwing the same error
unchanged, delete it; let the error propagate to the boundary that can
actually act on it. `repo.local.ts`'s per-method
`catch (error) { wrapUnknown(error) }` is not this anti-pattern — it's
normalizing an arbitrary thrown value into the `RepoError` contract every
`Repo` consumer expects, which is doing something (see §6).

**Swallowing is legitimate only for a genuine best-effort side effect** —
something whose failure doesn't change whether the primary operation
succeeded, and which has its own path to eventual correctness.
`authStore.syncLockedSession` qualifies: an enabled lock staying convenient
is a nice-to-have layered on top of an auth flow that fully succeeds without
it.

A legitimate swallow must still:

1. **Say why it's safe to ignore**, in a comment at the swallow site, not
   just at the function's top.
2. **Never be silent.** `console.warn`/`console.error` (or an equivalent
   logging seam) at minimum — a swallow with no trace is indistinguishable
   from a bug nobody noticed yet. `catch {}` with an empty body is never
   acceptable; `catch (e) { console.warn('...', e) }` is the floor.

Never swallow:

- Anything that leaves persisted state (IndexedDB, the Drive JSON files)
  inconsistent with what the UI believes.
- Anything security- or lock-relevant (`pinLock.ts`, `authStore.ts`'s session
  handling).
- Anything the user needs to act on (wrong PIN, network down, Drive
  permission denied).

**One narrow exception to "never be silent": an expected negative outcome
used as control flow, whose failure has its own separate, error-visible
path.** `authStore.restore()` attempts a _silent_ Google re-auth on cold boot
and falls back to `status: 'idle'` (→ `WelcomeScreen`) with a bare `catch {}`,
no `console.warn`. Silent auth failing is the routine outcome for anyone
without a live Google session, so a `console.warn` on every one of them would
be noise, not signal. It's also not the last word: an explicit `login()` from
`WelcomeScreen` has its own error-visible path (`status: 'error'`, §7's
error-copy mapping) if the real problem persists. The test before staying
silent: **would a legitimate, frequent, non-buggy caller hit this branch, and
does the user (or a developer) have another route to find out if it's
actually broken?** If yes to both, silence is fine, but say so in a comment
at the swallow site — the "why", not just "we chose to skip logging". If
either answer is no, log it.

**A swallow is justified by its caller, never by its neighbours.** Before you
catch, name the consumer and the worst decision it can make on the value you
are about to return. "Every other read in this module does it the same way"
is never sufficient justification on its own — check what _this_ caller does
with the degraded value. `readOwnerMarker()` must propagate a storage failure
rather than resolving it to `undefined`, since `undefined` there drives an
irreversible registry deletion; `ensureOwnerMarker`'s write-side swallow is
fine, because its caller never treats the degraded value as a decision input
and a future write idempotently retries. Same shape of read, opposite
verdict, because the callers differ.

**When recovery must pick a default: fail open or fail closed?** The
question that picks the direction: **does refusing to proceed here protect
anything the feature actually promises, or does it just break something for
no security benefit?** `lockStore.init()`'s `hasVault()` read fails **open**:
if IndexedDB is unreadable at boot, land on `phase: 'unlocked', enabled:
false` rather than leaving the app stuck on `phase: 'unknown'` forever (no
error boundary catches a rejected promise in a `useEffect`) — the PIN lock is
a convenience layer on top of Google auth, not the app's real security
boundary (`specs.md` §5), so failing open there costs nothing.
`lockStore.onVisible()`'s `isBackgroundExpired()` read fails **closed**: if
it can't be read, treat the background timeout as elapsed and re-lock, rather
than silently leaving an already-unlocked app open — staying unlocked past a
background timeout defeats the one thing the lock promises to do, so the
ambiguous case must resolve to the safer outcome.

## 3. Scope of a `try`

A `try` block's boundary is a claim: "every failure in here means the same
thing to my `catch`." Widen it or narrow it until that claim is actually
true.

```ts
// NOT THIS — hasVault() sits outside the try. On Safari private browsing, an
// IndexedDB probe throws here and the catch never sees it: it propagates out
// of syncLockedSession and fails the whole login, mislabeled as an auth
// failure even though Google auth had already succeeded.
async function syncLockedSession(session: AuthSession): Promise<void> {
  if (!(await hasVault())) return
  try {
    await updateSession(session)
  } catch {
    // Best-effort cache refresh only.
  }
}

// THIS — the whole operation, including the read that decides whether to
// even attempt it, is inside one try: both are best-effort, not just one.
async function syncLockedSession(session: AuthSession): Promise<void> {
  try {
    if (!(await hasVault())) return
    await updateSession(session)
  } catch (e) {
    console.warn('lock: failed to sync the cached session', e)
  }
}
```

**Before writing a `try`, name the operation it protects in one sentence,
then make sure every statement that's part of that operation — including
reads that gate whether you proceed — is inside it.** If two different
failures inside one `try` need different handling, the `try` is too wide —
split it, don't add an `if (e instanceof X)` ladder inside the `catch`.

## 4. Never return a success-shaped value for a failure

`undefined`, `null`, and an empty array/result are load-bearing — they mean
"there is genuinely nothing here," never "something went wrong and I gave up
quietly." `CrudRepo.get()` returning `T | undefined` for a missing id is
correct: "not found" is a legitimate, documented outcome of a `get`, not an
error. The rule is for the opposite case: an error disguised as a legitimate
empty result.

**A cursor minted under one query must not be replayed under another.**
`list()`'s `nextCursor` encodes `sortBy`/`sortDir`; replaying it under a
different one must reject as `RepoError('invalid_input')`, never silently
filter every row down to `{ items: [] }` — that reads as "you've reached the
end" when it actually means the cursor doesn't apply here:

```ts
if (parsed.sortBy !== sortBy || parsed.sortDir !== sortDir) {
  throw new RepoError(
    `cursor was minted for sortBy="${parsed.sortBy}"/sortDir="${parsed.sortDir}", ` +
      `not the current sortBy="${sortBy}"/sortDir="${sortDir}"`,
    'invalid_input',
  )
}
```

**`limit` has a lower bound.** `limit: 0` must be rejected, not answered with
`page = []` and no `nextCursor` — an empty page with no continuation token is
indistinguishable from "no more data":

```ts
function validateLimit(limit: number | undefined): void {
  if (limit === undefined) return
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RepoError(`limit must be a positive integer (got ${limit})`, 'invalid_input')
  }
}
```

**The generalization:** before a function returns `[]`/`undefined`/`null`,
ask "is this actually the caller's requested case, or did I just fail to
answer the question and pick the shape that compiles?" If it's the latter,
throw.

## 5. `cause` chaining, messages, and secrets

Use the native `ErrorOptions`/`{ cause }` (ES2022) — no library needed:

```ts
} catch (cause) {
  throw new RepoError('invalid pagination cursor', 'invalid_input', { cause })
}
```

Chain `cause` whenever you re-throw a lower-level failure as a higher-level
one — it keeps the original stack/value reachable in dev tools and test
failures without stuffing it into the message string. `pinLock.unlockWithPin`'s
`catch { throw new WrongPinError() }` drops the underlying `decrypt` failure
deliberately: a wrong PIN always manifests as an AES-GCM auth-tag failure, so
no diagnostic information is lost. If a second, distinguishable failure mode
is ever routed through the same `catch`, add `{ cause }` at that point rather
than guessing which one happened.

**What belongs in a message:** identifiers, field names, codes, counts —
enough for a developer reading a log to know what happened without
re-deriving it (`` `no ${entityLabel} with id "${id}"` ``, not just `"not
found"`). Domain error messages in this codebase are developer-facing English
by convention (`RepoError`, `AuthError`, `DriveError`) — see §7 for why they
must never reach the DOM verbatim.

**The hard rule, no exceptions:** the Drive access token, the PIN, and the
derived DEK never enter an error message, a `console.*` call, or the DOM.

```ts
// NEVER — even in a dev-only log, even truncated. If this pattern appears
// anywhere, it's a security bug, not a style nit.
console.warn('token refresh failed', session.accessToken)
throw new DriveError(`upload failed for token ${token}`)

// Fine — identifies the failure without the secret.
console.warn('lock: failed to sync the cached session', e)
throw new DriveError(`write ${res.status}`)
```

This is `specs.md` §7's guardrail restated for error handling specifically:
a stack trace, a log pipeline, or a `role="alert"` node are all exfiltration
surfaces exactly like `localStorage` would be.

## 6. Multiple implementations of one contract must agree

`Repo` has two implementations today (`repo.local.ts`, `repo.fake.ts`), with
a third (Drive-backed) planned. Hand-diffing implementations for parity
doesn't scale and won't get re-run on every future change.

**Enforcement: one shared contract test suite, run against every
implementation.** A single `repo.contract.ts` exporting a function like

```ts
export function testRepoContract(makeRepo: () => Promise<Repo> | Repo): void {
  describe('Repo contract', () => {
    it('add() rejects a non-positive monto with invalid_input', async () => {
      const repo = await makeRepo()
      await expect(repo.movimientos.add(movimiento({ monto: 0 }))).rejects.toMatchObject({
        code: 'invalid_input',
      })
    })
    // ...every behavior the port promises, including error codes
  })
}
```

— imported and invoked once from `repo.local.test.ts` and once from
`repo.fake.test.ts` (and from any future implementation's own test file).
Each implementation's own test file still covers what's genuinely
implementation-specific (dexie transaction semantics, keyset-pagination fast
path). The contract suite is what makes divergence a compiler-visible test
failure in whichever implementation lags, instead of something a reviewer
has to notice by reading both files side by side.

Two divergence shapes worth naming because they're easy to miss by eye:
missing `limit` validation on one implementation but not the other (§4), and
a config/object getter that returns a shallow copy whose nested fields still
alias the live in-memory store — mutate the returned value and the store
itself corrupts. Fix the latter with `structuredClone`, the native platform
API for exactly this.

The same principle generalizes past `Repo`: any time a second implementation
of an existing interface appears, its error behavior is part of the
contract, not an implementation detail — write the shared test before
extending the interface further.

## 7. UI-layer rules

The data/auth layer's rules (typed errors, `cause`, never swallow) don't
transfer directly to components — a component's job is to render state and
handle events, not to carry a `RepoErrorCode` switch. Different rules for a
different job:

- **Error boundaries.** Two additive layers:
  - `createBrowserRouter`'s built-in `errorElement` per top-level route
    (`src/router.tsx`, rendering `src/RouteErrorFallback.tsx`) — the
    idiomatic React Router mechanism for "this route crashed, show a
    fallback."
  - One minimal class-component `src/AppErrorBoundary.tsx` (the only way to
    catch a render error in React — no hook does this) wrapping `AppLock` +
    `RouterProvider` in `main.tsx`, for failures outside the router's own
    tree. Both log via `console.error` and render a fixed Spanish fallback
    line — never the caught error's message.
- **A rejected promise in an event handler never floats unhandled.** The
  `void store.action()` pattern used throughout (`WelcomeScreen`,
  `DrivePermissionScreen`, `LockScreen`) is only safe because every store
  action wraps its own body in `try/catch` and lands the failure in state
  (`error`, `driveError`, …) — the component never has to catch. Keep the
  rule symmetric: an async store/hook method fully owns its own error
  handling; a component's event handler calling it never needs its own
  `try/catch` layered on top.
- **Errors reach the user via a single `role="alert"` node fed by store
  state**, matching the pattern already in `LockScreen`, `LockSettings`,
  `DrivePermissionScreen`, `WelcomeScreen`. `role="alert"` is what makes a
  screen-reader announce the error without the user needing focus on it —
  don't drop it when adding a new error surface.
- **Never render `error.message`/`RepoError.code` raw as user copy.** Route
  every auth/lock error through `src/features/auth/errorCopy.ts` /
  `src/features/lock/errorCopy.ts`: a `Record<message, spanishCopy>` lookup
  with a generic fallback line for anything unmapped — never
  string-interpolate the raw error into the DOM. Keyed by the error's exact
  message rather than a formal `code`, since neither `AuthError`/`DriveError`
  nor the three lock error classes carry one (see §1's note on when a class
  earns a `code` union). The lookup only needs keys for the few messages
  worth a distinct, actionable line; everything else falls through to the
  fallback.

  **Message-keying's drift risk, and how the tests guard it.** A
  `Record<message, copy>` keyed on a hand-typed literal is only as safe as
  the guarantee that the literal still matches what the real error
  constructs. Derive each test's key from the real construction instead of
  restating it: `loginErrorCopy(new AuthError('access_denied').message)`,
  not `loginErrorCopy('auth: access_denied')` — a template change in
  `auth.ts`/`drive.ts`/`pinLock.ts` then fails the build instead of every
  key silently stopping matching while a test built the same way keeps
  passing.

  This only guards the _template_ — the specific reason string passed into a
  constructor (`'access_denied'`, `'missing VITE_GOOGLE_CLIENT_ID'`) is still
  a literal chosen independently in the file that throws and in the copy
  table, and nothing forces them to agree if a reason string itself gets
  renamed. Two of the auth reasons are protected by a different mechanism:
  `err.type` on the GIS `error_callback` is a typed union (`"unknown" |
"popup_closed" | "popup_failed_to_open"` in `@types/google.accounts`), so
  renaming what `auth.ts` passes to `AuthError` there is a compile error, not
  a silent drift. `lockStore.ts`'s two hand-thrown messages are closed the
  same way: `LOCKED_OUT_ERROR` and `NO_SESSION_ERROR` are exported from
  `src/lib/lockStore.ts` and used as the computed keys of the copy table, so
  the string is defined once. (The `lockStore` test files mock that module
  and therefore restate those literals in the mock; that is a test double,
  not a second source of truth — the production path has exactly one.)

  What remains unguarded is narrow: the two purely-internal auth reasons
  (`'missing VITE_GOOGLE_CLIENT_ID'`, `'GIS failed to load'`), where a rename
  in `auth.ts` degrades silently to the generic fallback — still a
  reasonable, non-broken message, just less specific.

### Where an error is allowed to land

Every error a user can cause must reach them somewhere. There are exactly two
surfaces, and the choice between them is not a matter of taste:

- **Inline, next to the thing that failed** — when a screen or form owns the
  failed action and has a place to put the message. Login, Drive consent,
  PIN unlock, enabling the lock: each is a screen whose whole purpose is that
  one action, so the message belongs there, as a `role="alert"` beside the
  control. Prefer this whenever it is available.
- **The global toast** — when the action's own surface is gone or was never
  the point: a bottom sheet that closed on save, a swipe-to-delete, a
  background write, anything raised from a store rather than a form. Without
  this, a failed `repo.movimientos.add(...)` from a sheet that already
  dismissed leaves the user believing the movement saved.

**Never let an error land nowhere.** If neither surface fits, that is a
design gap to raise, not a reason to swallow it — see §2.

**Do not invent a third surface.** Every screen using the shared toast is
what makes "the write failed" look the same everywhere; a per-feature
modal/banner/inline-red-text of its own fragments that.

Technical detail (`.code`, `.message`, `cause`) stays in `console`; the user
sees Spanish copy chosen from the error, per the copy tables above. The toast
is a **notification**, not a dialog: it never blocks, never traps focus, and
never asks a question — anything requiring a decision is a `CenterModal`.

## 8. How errors get tested

`AGENTS.md`'s TDD rule already names `auth.ts`, `repo.ts`, `pinLock.ts`, and
money math — write the failing test first. The established assertion style:

```ts
await expect(repo.movimientos.add(movimiento({ monto: 0 }))).rejects.toMatchObject({
  code: 'invalid_input',
})

await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
```

Use `.rejects.toMatchObject({ code })` when the test cares about the error
_category_ (most `RepoError` cases), `.rejects.toBeInstanceOf(SomeError)`
when the class itself is the meaningful signal (`pinLock.ts`'s three
classes). Don't assert on exact message text — messages are for developers
reading a log, not a stable test contract; a wording change shouldn't break
a test that only cares "did this fail as a wrong-PIN error."

Every new `RepoErrorCode`, every new thrown class, and every swallow needs at
least one test proving the failure path — not just the happy path. The
contract suite in §6 is this rule applied across implementations: a shared
test file means a new implementation can't ship without its error behavior
being exercised.

## 9. Do this / not that

**Swallowing a best-effort side effect**

```ts
// NOT THIS — silent, and the try doesn't cover the whole operation.
async function syncLockedSession(session: AuthSession): Promise<void> {
  if (!(await hasVault())) return
  try {
    await updateSession(session)
  } catch {}
}

// THIS — whole operation in one try, failure is visible.
async function syncLockedSession(session: AuthSession): Promise<void> {
  try {
    if (!(await hasVault())) return
    await updateSession(session)
  } catch (e) {
    console.warn('lock: failed to sync the cached session', e)
  }
}
```

**Answering a request the code can't safely answer**

```ts
// NOT THIS — a mismatched cursor silently looks like "no more data."
const cursorItem = buildCursorItem<T>(decodeCursor(cursor), sortBy, tiebreakField)

// THIS — decodeCursor knows which query minted the cursor and rejects a mismatch.
const decoded = decodeCursor(cursor, String(sortBy), sortDir)
const cursorItem = buildCursorItem<T>(decoded, sortBy, tiebreakField)
```

**Adding a new failure mode to an existing taxonomy**

```ts
// NOT THIS — a new ad hoc Error subclass callers have to learn to instanceof-check.
throw new Error('monto must be positive')

// THIS — extend the existing discriminated code; callers already branch on RepoErrorCode.
throw new RepoError(`monto must be a finite, positive number (got ${item.monto})`, 'invalid_input')
```

**Surfacing an error to the user**

```tsx
// NOT THIS — raw developer-facing message straight into Spanish UI.
<p role="alert">No se pudo iniciar sesión: {error}</p>

// THIS — a lookup table (src/features/auth/errorCopy.ts) maps the failure to
// real copy, with a generic fallback for anything unmapped; role="alert" stays.
<p role="alert">{loginErrorCopy(error)}</p>
```

## 10. Bugs this project shipped

Every rule above traces back to a real defect. Kept here, separate from the
rules themselves, so the rules stay dry and this stays the record.

**A silent swallow hid a broken PIN vault.** `authStore.syncLockedSession`'s
bare `catch {}` around a best-effort token-cache refresh also hid a genuinely
broken vault, which then silently bounced a correctly-authenticated user back
to the login screen on the next unlock. Rule: a legitimate swallow must never
be silent (§2).

**A `try` that didn't cover the whole operation mislabeled the failure.** The
same function's `hasVault()` read ran outside its `try`; a Safari
private-browsing probe failure propagated out uncaught and surfaced as a
failed login, even though Google auth had already succeeded. Rule: a `try`'s
scope must cover the whole logical operation, including the reads that gate
it (§3).

**A stale pagination cursor and `limit: 0` both returned an empty page
indistinguishable from "no more data."** `repo.local.list()` accepted a
cursor minted under a different `sortBy`/`sortDir` and silently filtered
every row out; `limit: 0` had the identical shape. Rule: never return a
success-shaped empty result for a failure (§4).

**Two different failure meanings shared one `unknown` code.** `RepoErrorCode`
had no way to distinguish "you handed me bad data" from "something broke on
my end," so callers couldn't branch on a validation failure versus a real
outage. Rule: add a `code` the moment a caller needs to branch on more than
pass/fail (§1).

**`repo.fake.ts` and `repo.local.ts` silently disagreed on error behavior.**
A shared contract test suite (§6) found `repo.fake.ts`'s `list()` had no
`limit` validation at all, and its `getConfig()`/`updateConfig()` returned a
shallow copy whose nested fields still aliased the live in-memory store, so a
caller mutating the result corrupted the fake's own state. Rule: run one
shared contract suite against every implementation of a port; fix aliasing
with `structuredClone`.

**A Drive-connection failure booted an already-authenticated user back to
Welcome.** The failure was written to the same identity-level `status`/
`error` fields the login flow used, so a Drive hiccup looked like an auth
failure. Rule: isolate an unrelated failure domain into its own state field
(`driveError`, never `status`/`error`).

**Profile-registry reads degraded a failure into a success-shaped default.**
`switchToProfile` reported a success it hadn't earned; `countGuestMovements`
hid a storage failure as a count of zero; `readOwnerMarker()` returned the
same `undefined` for "the read failed" as for "no marker exists," which drove
an irreversible profile-deletion dialog against a database that was still
intact. Rule: a swallow is justified by its caller, never by "the rest of
this file already does it this way" (§2).

**Raw developer-facing error text leaked into Spanish UI.** Four auth/lock
screens rendered `` `No se pudo iniciar sesión: ${error}` `` where `error`
was the thrown `Error`'s own English `.message`. Rule: never render
`error.message`/`RepoError.code` raw as user copy — route through the
message-keyed copy table (§7).

**Fighting a browser's own scroll made the sheet jump on iOS.** A hook chased
`visualViewport` and wrote its `offsetTop`/`height` onto the overlay's fixed
layer, while a field and a `ResizeObserver` each also called `scrollIntoView`.
iOS delivers that pan as drifting samples that keep arriving after the keyboard
has settled, so the panel flew up and landed back, exposing the page behind it —
Android, which never pans, was fine. Rule: when the platform already handles a
gesture, adding a JS correction on top of it is the defect; delete the
correction rather than tuning it.

**A new movement defaulted to tomorrow's date every evening, west of UTC.**
`useMovimientoForm`'s `todayIso()` computed `new Date().toISOString().slice(0,
10)` — the UTC calendar day, not the device's. Past ~7pm in UTC-5 (worse the
further west), that's already the next day, and nothing caught it: the value
was a syntactically valid ISO date, so it saved silently. Rule: a calendar-only
date derived from "now" must go through a local-time formatter
(`movimientoStats.ts`'s `toIsoDate`, backed by date-fns `format`), never
`Date.prototype.toISOString`, which is UTC by definition.
