# Error handling — the standard

Ground truth is code; this doc explains the _why_ and settles arguments. If a
rule here and the code disagree, fix whichever one is wrong and update this
doc in the same change — same relationship this file has with `specs.md`
that `specs.md` has with the rest of the codebase.

**Origin.** Written after three independent code reviews on freshly-merged
code found that nearly every serious defect was an error-handling defect, not
a business-logic one — see the six cases below. Every rule here traces back
to one of them, or is marked as a judgment call with its own reasoning. A
rule that wouldn't have caught a real bug here doesn't get to hide behind
"best practice."

1. `authStore.syncLockedSession` had a bare `catch {}` — correct intent (a
   token-cache refresh must never break login), but it hid a genuinely broken
   PIN vault, which then silently bounced a correctly-authenticated user back
   to the login screen on the next unlock.
2. The same function's `try` didn't cover the whole operation: `hasVault()`
   (an IndexedDB read) ran _outside_ the `try`, so a Safari-private-browsing
   probe failure surfaced as "No se pudo iniciar sesión" even though Google
   auth had already succeeded.
3. `repo.local.list()` accepted a pagination cursor minted under a different
   `sortBy`/`sortDir` and returned `{ items: [] }` — indistinguishable from
   "no data." `limit: 0` had the same shape of bug: it silently dropped the
   "more data exists" signal.
4. `RepoErrorCode` shipped as `not_found | schema_mismatch | network |
unknown`, then needed `invalid_input` added under review because "you handed
   me bad data" and "something unexpected broke" were collapsing into one code
   callers couldn't branch on.
5. `repo.fake.ts` and `repo.local.ts` — two implementations of the same
   `Repo` port — disagreed on error behavior in eight places: missing
   validation, wrong or absent error codes, malformed input tolerated on one
   side and rejected on the other.
6. A Drive-connection failure could set the identity-level `status: 'error'`,
   booting an already-authenticated user back to Welcome — fixed by isolating
   Drive errors into their own `driveError`/`driveConnecting` fields.

Three fixer branches (`fix/a-repo`, `fix/b-auth`, `fix/d-fake`) landed fixes
for cases 1–5 concurrently with this document being written; §9 below reads
identically to what they shipped, which is the point — this doc names the
pattern so the next fix doesn't have to be rediscovered from scratch.

---

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
`BiometricUnavailableError` in `pinLock.ts` are the one place this repo
already does it the other way (three classes, no shared code); that's fine
there because each is checked with `instanceof` at exactly one call site
(`lockStore.resume`) and they'll never need a `switch`. If a second call site
ever needs to branch across them, collapse them into one `LockError` with a
`code` instead of adding a fourth class — don't let the pattern proliferate.

**Adding a new code** — the `invalid_input` story is the model to repeat:

1. Name the question a caller genuinely can't answer today. ("Bad input I
   handed you" vs. "something broke on your end" were both `unknown` before
   `invalid_input` existed — a caller couldn't tell a form-validation retry
   from a real outage.)
2. Append to the union. Never remove or repurpose an existing code — anything
   pattern-matching on it today keeps working.
3. Grep for existing consumers first (`rg "RepoErrorCode\|\.code ==="`). A
   `Record<RepoErrorCode, …>` lookup anywhere in the codebase (§ Coding
   rules) makes TypeScript refuse to compile until every consumer handles the
   new case — that exhaustiveness check is doing the work here, not manual
   auditing.
4. Record the change in `specs.md` §11 the same way the `invalid_input`
   addition was recorded, including who else could have been affected.

`AuthError` and `DriveError` are plain `Error` subclasses today with no
`code` — that's correct as long as every call site only asks "did it fail,"
which is true right now (`WelcomeScreen`/`DrivePermissionScreen` just render
the message). The day a caller needs to branch (e.g. "popup closed by user"
vs. "network down" vs. "origin not authorized"), give `AuthError` a `code`
union the same way, not a pile of `instanceof` checks.

## 2. Where to catch, and where not to

This was the single most-violated rule in the code reviewed. Two failure
modes, both real:

- **Catching too early, too broadly** (case 1): a `catch {}` at the wrong
  level turns a real bug into silence.
- **Catching too late, too narrowly** (case 2): a `try` that doesn't cover
  the whole logical operation lets an unrelated failure escape mislabeled.

**Catch where you can _do_ something about the failure** — set UI state,
decide whether to retry, translate to user-facing copy, roll back a partial
write. If a `catch` block's only content is re-throwing the same error
unchanged, delete it; let the error propagate to the boundary that can
actually act on it. `repo.local.ts`'s per-method `catch (error) { wrapUnknown(error) }`
is not this anti-pattern — it's normalizing an arbitrary thrown value into
the `RepoError` contract every `Repo` consumer expects, which is doing
something (see §6).

**Swallowing is legitimate only for a genuine best-effort side effect** —
something whose failure doesn't change whether the primary operation
succeeded, and which has its own path to eventual correctness. `syncLockedSession`
qualifies: an enabled lock staying convenient is a nice-to-have layered on
top of an auth flow that fully succeeds without it.

A legitimate swallow must still:

1. **Say why it's safe to ignore**, in a comment at the swallow site, not just
   at the function's top.
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
path.** `authStore.restore()` is the case that surfaced this during phase 2:
it attempts a _silent_ Google re-auth on cold boot and falls back to
`status: 'idle'` (→ `WelcomeScreen`) with a bare `catch {}`, no `console.warn`.
This is not the same shape of bug as `syncLockedSession`. Silent auth failing
is the routine outcome for anyone without a live Google session — most first
visits — so a `console.warn` on every one of them would be noise, not
signal, and would train whoever reads the console to ignore warnings from
this function. Crucially, it's also not the last word: falling back to
`WelcomeScreen` isn't a dead end where the failure disappears — an explicit
`login()` from there has its own error-visible path (`status: 'error'`, §7's
error-copy mapping) if the real problem persists. Compare `syncLockedSession`:
its failure has no other path that will ever surface it — a broken vault
stays broken and silently stale until this exact code logs it. The test
before staying silent: **would a legitimate, frequent, non-buggy caller hit
this branch, and does the user (or a developer) have another route to find
out if it's actually broken?** If yes to both, silence is fine, but say so in
a comment at the swallow site — the "why", not just "we chose to skip
logging" — the same documentation duty as any other legitimate swallow. If
either answer is no, log it.

**When recovery must pick a default: fail open or fail closed?** Added
2026-08-19 (`fix/lock-hardening`), which hit both directions in the same
file and needed to say why they don't contradict each other.
`lockStore.init()`'s `hasVault()` read fails **open**: if IndexedDB is
unreadable at boot, land on `phase: 'unlocked', enabled: false` rather than
leaving the app stuck on `phase: 'unknown'` forever (no error boundary
catches a rejected promise in a `useEffect`). `lockStore.onVisible()`'s
`isBackgroundExpired()` read fails **closed**: if it can't be read, treat
the background timeout as elapsed and re-lock, rather than silently leaving
an already-unlocked app open. The question that picks the direction: **does
refusing to proceed here protect anything the feature actually promises, or
does it just break something for no security benefit?** Booting into
`'unknown'` protects nothing — the PIN lock is a convenience layer on top of
Google auth, not the app's real security boundary (specs.md §5) — so
failing open there costs nothing and avoids a white screen. Silently staying
unlocked past a background timeout, by contrast, defeats the one thing the
lock promises to do, so the ambiguous case must resolve to the safer
outcome. Same reasoning as `pinLock.isBiometricAvailable()`'s legitimate
swallow above, applied to picking a fallback _value_ instead of just
deciding whether to log: ask what the caller actually needs protected, not
what's easiest to fall back to.

## 3. Scope of a `try`

A `try` block's boundary is a claim: "every failure in here means the same
thing to my `catch`." Widen it or narrow it until that claim is actually
true — don't let it default to "wherever the diff happened to put it."

**The worked example** (`authStore.syncLockedSession`, before → after):

```ts
// Before — hasVault() outside the try. On Safari private browsing, an
// IndexedDB probe throws here and the catch never sees it: it propagates
// out of syncLockedSession and fails the whole login, mislabeled as an
// auth failure even though Google auth had already succeeded.
async function syncLockedSession(session: AuthSession): Promise<void> {
  if (!(await hasVault())) return
  try {
    await updateSession(session)
  } catch {
    // Best-effort cache refresh only.
  }
}

// After — the whole operation (including the read that decides whether to
// even attempt it) is inside one try, because "IndexedDB is unavailable in
// this tab" and "the vault write failed" mean the same thing to the caller:
// this is a caching side effect, not the primary outcome, so both must be
// best-effort, not just one of them.
async function syncLockedSession(session: AuthSession): Promise<void> {
  try {
    if (!(await hasVault())) return
    await updateSession(session)
  } catch (e) {
    console.warn('lock: failed to sync the cached session', e)
  }
}
```

The rule this generalizes to: **before writing a `try`, name the operation
it protects in one sentence, then make sure every statement that's part of
that operation — including reads that gate whether you proceed — is inside
it.** If two different failures inside one `try` need different handling,
that's a sign the `try` is too wide, not that you need an `if
(e instanceof X)` ladder inside the `catch`.

## 4. Never return a success-shaped value for a failure

`undefined`, `null`, and an empty array/result are load-bearing — they mean
"there is genuinely nothing here," never "something went wrong and I gave up
quietly." `CrudRepo.get()` returning `T | undefined` for a missing id is
correct: "not found" is a legitimate, documented outcome of a `get`, not an
error. The two worked examples below are the opposite case: an error
disguised as a legitimate empty result.

**Cursor bound to the wrong query** (`repo.local.ts`): `list()` accepted a
`nextCursor` minted under one `sortBy`/`sortDir` and replayed under another.
The cursor's encoded `sortValue`/`tiebreakValue` got reinterpreted against
the wrong field/order, and the mismatch silently filtered out every row —
`{ items: [] }`, indistinguishable from "you've reached the end." Fixed by
encoding `sortBy`/`sortDir` into the cursor payload itself and rejecting a
replay under different ones as `RepoError('invalid_input')` instead of
guessing:

```ts
if (parsed.sortBy !== sortBy || parsed.sortDir !== sortDir) {
  throw new RepoError(
    `cursor was minted for sortBy="${parsed.sortBy}"/sortDir="${parsed.sortDir}", ` +
      `not the current sortBy="${sortBy}"/sortDir="${sortDir}"`,
    'invalid_input',
  )
}
```

**`limit: 0`**: with no lower bound on `limit`, a caller passing `0` got
`page = []` and — because `hasMore` is computed from `page.length` — no
`nextCursor` either. The "more data exists" signal vanished along with the
page. Fixed by rejecting the input instead of silently answering a
nonsensical request:

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

Use the native `ErrorOptions`/`{ cause }` (ES2022, already the pattern in
`repo.local.ts` — no library needed, matches the "prefer native platform
APIs" rule):

```ts
} catch (cause) {
  throw new RepoError('invalid pagination cursor', 'invalid_input', { cause })
}
```

Chain `cause` whenever you re-throw a lower-level failure as a higher-level
one — it keeps the original stack/value reachable in dev tools and test
failures without stuffing it into the message string. `pinLock.unlockWithPin`'s
`catch { throw new WrongPinError() }` currently drops the underlying
`decrypt` failure; that's acceptable there specifically because a wrong PIN
_always_ manifests as an AES-GCM auth-tag failure — there's no diagnostic
information being lost. If a second, distinguishable failure mode is ever
routed through the same `catch`, add `{ cause }` at that point rather than
guessing which one happened.

**What belongs in a message:** identifiers, field names, codes, counts —
enough for a developer reading a log to know what happened without
re-deriving it (`` `no ${entityLabel} with id "${id}"` `` from
`repo.local.ts`, not just `"not found"`). Domain error messages in this
codebase are developer-facing English by convention (`RepoError`, `AuthError`,
`DriveError` messages all read that way today) — see §7 for why they must
never reach the DOM verbatim.

**The hard rule, no exceptions:** the Drive access token, the PIN, and the
derived DEK never enter an error message, a `console.*` call, or the DOM.
`authStore`/`pinLock`/`drive.ts` never do this today — keep it that way
deliberately, not by accident:

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
a stack trace, a Sentry-style log pipeline (if one is ever added), or a
`role="alert"` node are all exfiltration surfaces exactly like `localStorage`
would be.

## 6. Multiple implementations of one contract must agree

`Repo` has two implementations today (`repo.local.ts`, `repo.fake.ts`), with
a third (Drive-backed) planned. A review diffing them by hand found eight
divergences — several purely about error behavior: one side validated
`fecha`/`moneda`, the other didn't; error codes differed for the same bad
input; a malformed cursor crashed one implementation and was rejected
cleanly by the other. Hand-diffing doesn't scale past two implementations
and won't get re-run on every future change.

**Enforcement: one shared contract test suite, run against every
implementation.** A single `repo.contract.test.ts` exporting a function like

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
`repo.fake.test.ts` (and later, the Drive-backed repo's test file). Each
implementation's own test file still covers what's genuinely
implementation-specific (dexie transaction semantics, keyset-pagination fast
path). The contract suite is what makes divergence a compiler-visible test
failure in whichever implementation lags, instead of something a reviewer
has to notice by reading both files side by side.

**Implemented phase 2, 2026-08-18** — `src/lib/repo.contract.ts` (a plain
module, not `*.test.ts`, per the operator's decision: a bare-helper
`*.test.ts` file gets collected by vitest as a standalone test file with no
top-level test of its own). It found two real divergences on first run
against the merged `fix/a-repo`/`fix/d-fake` code, both fixed the same
session:

1. `repo.fake.ts`'s `list()` had no `limit` validation at all — `limit: 0`
   returned `{ items: [], nextCursor: '-1' }`, the exact ambiguous-empty-page
   shape §4 warns about, where `repo.local.ts` correctly threw
   `invalid_input`. Fixed by porting `repo.local.ts`'s `validateLimit`.
2. `repo.fake.ts`'s `getConfig()`/`updateConfig()` returned `{ ...config }` —
   a shallow copy whose nested `secciones`/`categorias`/`preferencias` were
   still the _same array/object references_ as the live in-memory store, so
   a caller mutating the returned config silently corrupted the fake's own
   state. Invisible in `repo.local.ts` only because IndexedDB's own
   structured-clone boundary happens to protect every read there — not a
   guarantee `repo.fake.ts`'s plain in-memory variable gets for free. Fixed
   with `structuredClone(config)`, the native platform API for exactly this
   (no library, matches the "prefer native APIs" rule).

Both are exactly the class of bug the suite exists to catch structurally
instead of by manual review.

The same principle generalizes past `Repo`: any time a second implementation
of an existing interface appears, its error behavior is part of the contract,
not an implementation detail — write the shared test before extending the
interface further.

## 7. UI-layer rules

The data/auth layer's rules (typed errors, `cause`, never swallow) don't
transfer directly to components — a component's job is to render state and
handle events, not to carry a `RepoErrorCode` switch. Different rules for a
different job:

- **Error boundaries.** Two additive layers, no new dependency (implemented
  phase 2, 2026-08-18):
  - `createBrowserRouter`'s built-in `errorElement` per top-level route
    (`src/router.tsx`, rendering `src/RouteErrorFallback.tsx`) — the
    idiomatic React Router (already a dependency) mechanism for "this route
    crashed, show a fallback," native to the framework already in use.
  - One minimal class-component `src/AppErrorBoundary.tsx` (the only way to
    catch a render error in React — no hook does this) wrapping `AppLock` +
    `RouterProvider` in `main.tsx`, for failures outside the router's own
    tree (e.g. `AppLock`/`LockScreen` itself). Both log via `console.error`
    and render a fixed Spanish fallback line — never the caught error's
    message.
- **A rejected promise in an event handler never floats unhandled.** The
  `void store.action()` pattern used throughout (`WelcomeScreen`,
  `DrivePermissionScreen`, `LockScreen`) is only safe because every store
  action wraps its own body in `try/catch` and lands the failure in state
  (`error`, `driveError`, …) — the component never has to catch. If a new
  store action is added that _doesn't_ catch internally, every `void
action()` call site becomes an unhandled-rejection bug. Keep the rule
  symmetric: an async store/hook method fully owns its own error handling: a
  component's event handler calling it never needs its own `try/catch`
  layered on top.
- **Errors reach the user via a single `role="alert"` node fed by store
  state**, matching the pattern already in `LockScreen`, `LockSettings`,
  `DrivePermissionScreen`, `WelcomeScreen`. `role="alert"` is what makes a
  screen-reader announce the error without the user needing focus on it —
  don't drop it when adding a new error surface.
- **Never render `error.message`/`RepoError.code` raw as user copy.** Before
  phase 2, all four auth/lock screens did exactly that
  (`` `No se pudo iniciar sesión: ${error}` `` where `error` is `e.message`),
  leaking developer-facing English (`"auth: missing VITE_GOOGLE_CLIENT_ID"`)
  into Spanish UI. Fixed via `src/features/auth/errorCopy.ts` and
  `src/features/lock/errorCopy.ts`: a `Record<message, spanishCopy>` lookup
  (per the "value → value mappings use a `Record`" coding rule) with a
  generic fallback line for anything unmapped — never string-interpolate the
  raw error into the DOM. Keyed by the error's exact message rather than a
  formal `code`: neither `AuthError`/`DriveError` (auth/Drive) nor
  `WrongPinError`/`LockedOutError`/`BiometricUnavailableError` (lock) carry
  one — see §1's note on when a class earns a `code` union, and the phase-2
  operator decision not to add one speculatively. The lookup only needs
  keys for the few messages worth a distinct, actionable line; everything
  else — a dynamic `DriveError` HTTP-status message, an unrecognized OAuth
  reason — falls through to the fallback, same mechanism a `code`-keyed
  table would use.

  **Message-keying's drift risk, and how the tests guard it.** A
  `Record<message, copy>` keyed on a hand-typed literal is only as safe as
  the guarantee that the literal still matches what the real error
  constructs — and a naive test that also just retypes the same literal
  (`expect(loginErrorCopy('auth: access_denied')).toBe(...)`) verifies
  nothing about that guarantee: if `AuthError`'s `` `auth: ${reason}` ``
  template ever changes (prefix dropped, renamed, additional context
  added), every key in the table silently stops matching, every user
  silently gets the generic fallback instead of the actionable line, and a
  test built the same way keeps passing regardless — exactly the invisible
  regression this whole document exists to prevent, just relocated into the
  UI's own copy layer. Fixed by deriving each test's key from the real
  construction instead of restating it:
  `loginErrorCopy(new AuthError('access_denied').message)`, not
  `loginErrorCopy('auth: access_denied')`. A template change in `auth.ts`/
  `drive.ts`/`pinLock.ts` now fails the build.

  This only guards the _template_ — the specific reason string passed into
  a constructor (`'access_denied'`, `'missing VITE_GOOGLE_CLIENT_ID'`) is
  still a literal chosen independently in two unowned files
  (`src/lib/auth.ts`, `src/lib/lockStore.ts`) and in the copy table, and
  nothing forces them to agree if a reason string itself gets renamed. Two
  of the auth reasons are protected by a different mechanism: `err.type` on
  the GIS `error_callback` is a typed union
  (`"unknown" | "popup_closed" | "popup_failed_to_open"` in
  `@types/google.accounts`), so renaming what `auth.ts` passes to
  `AuthError` there is a TypeScript compile error, not a silent drift. The
  `lockStore.ts`'s two hand-thrown messages are now closed the same way, by
  single-sourcing rather than by a test: `LOCKED_OUT_ERROR` and
  `NO_SESSION_ERROR` are exported from `src/lib/lockStore.ts` and used as
  the computed keys of the copy table, so the string is defined once and
  the two sides cannot drift apart at all. (Note the two `lockStore` test
  files mock that module and therefore restate those literals in the mock;
  that is a test double, not a second source of truth — the production path
  has exactly one.)

  What remains unguarded is narrow: the two purely-internal auth reasons
  (`'missing VITE_GOOGLE_CLIENT_ID'`, `'GIS failed to load'`), where a
  rename in `auth.ts` degrades silently to the generic fallback — still a
  reasonable, non-broken message, just less specific. Accepted as a
  residual, lower-severity gap; close it the same way if `auth.ts` is ever
  opened for related work.

### Where an error is allowed to land

Every error a user can cause must reach them somewhere. There are exactly two
surfaces, and the choice between them is not a matter of taste:

- **Inline, next to the thing that failed** — when a screen or form owns the
  failed action and has a place to put the message. Login, Drive consent,
  PIN unlock, enabling the lock: each is a screen whose whole purpose is that
  one action, so the message belongs there, as a `role="alert"` beside the
  control. Prefer this whenever it is available: an error shown where the
  user is looking beats one shown in a corner.
- **The global toast** — when the action's own surface is gone or was never
  the point: a bottom sheet that closed on save, a swipe-to-delete, a
  background write, anything raised from a store rather than a form. Without
  this, a failed `repo.movimientos.add(...)` from a sheet that already
  dismissed leaves the user believing the movement saved.

**Never let an error land nowhere.** If neither surface fits, that is a
design gap to raise, not a reason to swallow it — see §2.

**Do not invent a third surface.** Every screen using the shared toast is
what makes "the write failed" look the same everywhere; a per-feature
modal/banner/inline-red-text of its own is how four parallel tracks end up
with four error languages.

Technical detail (`.code`, `.message`, `cause`) stays in `console`; the user
sees Spanish copy chosen from the error, per the copy tables above. The toast
is a **notification**, not a dialog: it never blocks, never traps focus, and
never asks a question — anything requiring a decision is a `CenterModal`.

## 8. How errors get tested

`AGENTS.md`'s TDD rule already names `auth.ts`, `repo.ts`, `pinLock.ts`, and
money math — write the failing test first. The established assertion style,
already consistent across the test suite:

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
reading a log, not a stable test contract; a message wording change
shouldn't break a test that only cares "did this fail as a wrong-PIN error."

Every new `RepoErrorCode`, every new thrown class, and every swallow needs at
least one test proving the failure path — not just the happy path. The
contract-suite recommendation in §6 is this rule applied across
implementations: a shared test file means a new implementation can't ship
without its error behavior being exercised.

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

## Options considered, and why the status quo (mostly) wins

**Typed error classes with a discriminated `code`** (current `RepoError`
pattern) — kept, extended where a module's callers need to branch (§1). Zero
new dependencies, already idiomatic TypeScript, and it's the one pattern that
directly explains 3 of the 6 real bugs (cases 3, 4, and the general shape of
5): a `code` is exactly what let `invalid_input` get named as a distinct
thing, and what makes the §6 contract suite able to assert `{ code: 'invalid_input' }`
instead of a fragile message string.

**A `Result`/`Either` return type, hand-rolled or via a library (`neverthrow`
considered explicitly)** — rejected as a blanket policy, seriously considered
as a narrow seam. Checked against all six cases: a `Result` type doesn't stop
a swallow (an ignored `Err` is exactly as invisible as an empty `catch {}` —
the discipline problem in case 1 is orthogonal to the return-type mechanism),
doesn't change `try` scoping (case 2 — that's about which statements are
inside a block, not what the block returns), and doesn't structurally forbid
a success-shaped failure (cases 3/4 — `Ok({ items: [] })` is exactly as able
to lie as a thrown value; `RepoError('invalid_input')` already makes the
honest answer the only one that type-checks). What it would cost: a new
runtime dependency shipped to every user forever (violates "no CDN, mind
bundle size" and "prefer native APIs over extra deps"), and a rewrite of
every `Repo`/`auth.ts`/`pinLock.ts`/`drive.ts` signature plus every call site
across `src/features/**` — for a project whose async I/O boundary is already
`async`/`await` + typed thrown errors end to end, that's ceremony without a
matching payoff. The one place `Result` earns its keep: **pure, sync,
expected-to-fail-often parsing at the UI edge** (a future `monto` input
parser, the planned voice-command regex parser in Track F) — those are
exactly the "deliberate over-engineering at a seam" the project's growth
trajectory justifies, hand-rolled as a plain `{ ok: true, value } | { ok:
false, reason }` union with no library, not exceptions, because the caller
wants to render a validation message inline without a `try/catch` around
every keystroke. Not needed yet — no such parser exists today — but this is
the recommended shape when Track F picks it up.

**React error boundaries** — adopted (§7), previously absent entirely. Not
directly implicated in any of the six cases (all six were data/auth-layer,
not render-layer), but the codebase currently has zero protection against a
render-time throw taking down the whole app, which is a gap independent of
this review's specific findings and cheap to close with tools already in the
dependency tree (`react-router`'s `errorElement`, React's own class-component
mechanism).

**Centralized normalization at module edges** (`wrapUnknown` in
`repo.local.ts`) — kept, already the right shape: every `CrudRepo` method
funnels an arbitrary thrown value through one function that guarantees a
`RepoError` comes out, so consumers only ever need `instanceof RepoError` /
`.code`, never a raw `unknown`. Worth naming explicitly as the pattern to
replicate the day a second I/O-heavy module (`drive.ts`'s planned real
Drive-backed `Repo`) needs the same guarantee.

## Migration plan

Ranked by risk at the time this was written (phase 1) — how bad it is that a
file violates the standard, not how much code would change to fix it. Status
column added at the end of phase 2 (2026-08-18, branch `fix/errors`), once
`fix/a-repo`/`fix/b-auth`/`fix/d-fake` had merged to `main`.

1. **`src/lib/authStore.ts` — swallow scope + swallow visibility (cases
   1–2).** ✅ Done — `fix/b-auth` already carried the exact fix (whole-
   operation `try`, `console.warn` instead of bare `catch {}`) by the time
   phase 2 started; verified it matches §3's worked example exactly.
   `restore()`'s own bare `catch {}` (not part of the original six cases)
   turned out to be a _legitimate_ silent swallow, not a gap — see §2's
   "one narrow exception," added because of this exact function; it now
   carries a comment explaining why.
2. **`src/lib/repo.local.ts` — cursor/limit success-shaped failures (case 3) + taxonomy gap (case 4).** ✅ Done — `fix/a-repo` carried the cursor
   `sortBy`/`sortDir` binding and `validateLimit` fixes. One small
   leftover inconsistency fixed directly: `removeMany()`'s `not_found`
   message named the raw entity generically (`"no entity with id..."`)
   instead of `entityLabel`, unlike `update()`/`remove()` — cosmetic
   (message text isn't part of the contract, §8), fixed for consistency
   with a regression test.
3. **`src/lib/repo.fake.ts` — contract parity (case 5).** ✅ Done —
   `fix/d-fake` carried validation/error-code parity, but the §6 contract
   suite (built this same session) found **two divergences it missed**:
   no `limit` validation at all, and `getConfig()` leaking live references
   to `secciones`/`categorias`/`preferencias`. Both fixed; see §6 for the
   detail. This is the item that most concretely proves the contract
   suite's value — manual parity review, even careful review across
   multiple passes, missed what the suite caught on its first run.
4. **No React error boundary anywhere (`src/main.tsx`, `src/router.tsx`).**
   ✅ Done — `src/RouteErrorFallback.tsx` (via `errorElement` on every route)
   - `src/AppErrorBoundary.tsx` (wrapping `AppLock`/`RouterProvider`), both
     tested.
5. **`src/features/auth/*.tsx`, `src/features/lock/*.tsx` — raw error
   messages in user-facing copy.** ✅ Done — `src/features/auth/errorCopy.ts`
   and `src/features/lock/errorCopy.ts`; exact copy strings reported to the
   operator for review per their instruction. Also caught two pre-existing
   tests (`WelcomeScreen`/`RequireAuth`/`DrivePermissionScreen`) that were
   asserting the _raw_ English message appeared in the DOM — i.e. tests that
   enforced the very bug this item fixes. Updated to assert the Spanish
   copy and the absence of the raw string instead.
6. **`src/lib/pinLock.ts`, `src/lib/drive.ts`, `src/lib/auth.ts` — no `code`
   union yet.** Deliberately not done — operator's explicit instruction:
   correct as-is per §1's "only add `code` when a caller needs to branch on
   more than pass/fail," no caller does yet, and speculative surface area
   isn't wanted. Still the right call after implementing 1–5: nothing in
   this pass needed it — the auth/lock copy lookups (item 5) key on the
   error's message, not a `code`, and work fine that way (§7).

**What changed from the phase-1 plan, and why (per the standing instruction
to fix the document, not just the code, when a rule turns out wrong):**

- **§2 gained a documented exception** to "a legitimate swallow must never be
  silent" — `authStore.restore()`'s silent-auth-attempt catch is a real,
  defensible case that rule didn't originally account for. See §2 for the
  test ("would a legitimate, frequent, non-buggy caller hit this branch, and
  is there another route to find out if it's actually broken?").
- **§7's copy lookup is keyed by exact error message, not a formal `code`**,
  because item 6 was correctly left undone — the document's original
  `Record<code, spanishCopy>` phrasing assumed a `code` that doesn't exist
  for `AuthError`/`DriveError`/the lock error classes. The mechanism (a
  `Record` with a generic fallback) is unchanged; only what it's keyed on
  differs from the original sketch.
- Everything else in phase 1's plan held up as written once implemented —
  no other rule needed correcting.
