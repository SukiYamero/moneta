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
export function testRepoContract(makeRepo: () => Repo) {
  describe('Repo contract', () => {
    it('add() rejects a non-positive monto with invalid_input', async () => {
      const repo = makeRepo()
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
has to notice by reading both files side by side. This is the enforcement
mechanism recommended for phase 2 (§10) — not written yet, since
`fix/a-repo` and `fix/d-fake` are mid-flight on the very files it would
import from.

The same principle generalizes past `Repo`: any time a second implementation
of an existing interface appears, its error behavior is part of the contract,
not an implementation detail — write the shared test before extending the
interface further.

## 7. UI-layer rules

The data/auth layer's rules (typed errors, `cause`, never swallow) don't
transfer directly to components — a component's job is to render state and
handle events, not to carry a `RepoErrorCode` switch. Different rules for a
different job:

- **Error boundaries.** None exist yet in this codebase — a render-time
  throw anywhere currently white-screens the app. Two additive layers, no new
  dependency:
  - `createBrowserRouter`'s built-in `errorElement` per top-level route
    (`src/router.tsx`) — the idiomatic React Router (already a dependency)
    mechanism for "this route crashed, show a fallback," native to the
    framework already in use.
  - One minimal class-component `ErrorBoundary` (the only way to catch a
    render error in React — no hook does this) wrapping `AppLock` +
    `RouterProvider` in `main.tsx`, for failures outside the router's own
    tree (e.g. `AppLock`/`LockScreen` itself).
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
- **Never render `error.message`/`RepoError.code` raw as user copy.** Today
  every one of those four screens does exactly that
  (`` `No se pudo iniciar sesión: ${error}` `` where `error` is `e.message`) —
  this is flagged as a phase-2 fix, not held up as the pattern to copy. It
  currently leaks developer-facing English (`"auth: missing
VITE_GOOGLE_CLIENT_ID"`) into Spanish UI, and a future error message change
  becomes a user-facing copy change by accident. The fix is a small
  `Record<code, spanishCopy>` lookup (per the "value → value mappings use a
  `Record`" coding rule) with a generic fallback line for codes/messages that
  aren't mapped — never string-interpolate the raw error into the DOM.

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

// THIS — a lookup table maps the failure to real copy; role="alert" stays.
const AUTH_ERROR_COPY: Record<string, string> = {
  'missing VITE_GOOGLE_CLIENT_ID': 'Error de configuración. Intenta más tarde.',
}
<p role="alert">{AUTH_ERROR_COPY[error] ?? 'No se pudo iniciar sesión. Intenta de nuevo.'}</p>
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

Ranked by risk — how bad it is that a file violates the standard today, not
how much code would change to fix it. Files owned by the four in-flight
fixer branches are marked; several of them already ship the exact fix listed
here, since these branches and this document were written from the same
review findings independently. Re-verify against `main` once they merge
rather than re-doing the work.

1. **`src/lib/authStore.ts` — swallow scope + swallow visibility (cases
   1–2).** `fix/b-auth` already lands this fix (whole-operation `try`,
   `console.warn` instead of bare `catch {}`). Highest risk of the six
   because it directly caused a real "correctly authenticated user gets
   logged out" bug. Once merged: verify the merged version matches §3's
   worked example exactly, and check `hydrate()`/`login()`/`restore()`
   for the same "does the try cover the real full operation" question —
   this review only found the bug in `syncLockedSession`, not because the
   others were checked and passed.
2. **`src/lib/repo.local.ts` — cursor/limit success-shaped failures (case 3) + taxonomy gap (case 4).** `fix/a-repo` lands the cursor
   `sortBy`/`sortDir` binding and `validateLimit`. Second-highest risk:
   silently wrong query results are worse than a crash because nothing
   signals that anything went wrong. Once merged: this is also where the
   §6 contract suite should be built first, since `repo.local.ts` and
   `repo.fake.ts` are the two existing implementations to extract it from.
3. **`src/lib/repo.fake.ts` — contract parity (case 5).** `fix/d-fake`
   lands validation/error-code parity with `repo.local.ts`. Medium risk on
   its own (it's a dev/test fixture, not production data), but every Wave 2
   screen is being built and tested against this fake first — a divergence
   here silently teaches new UI code the wrong error contract, which then
   has to be re-learned against the real repo later. This is the strongest
   case for building the §6 contract suite now rather than deferring it:
   without it, this exact divergence can recur on the very next fake/real
   split.
4. **No React error boundary anywhere (`src/main.tsx`, `src/router.tsx`).**
   Not owned by any in-flight fixer branch — net-new, low risk to add
   (additive, no behavior change to the happy path), but currently a real
   gap: any render-time throw white-screens the app with no recovery UI.
   Straightforward phase-2 addition per §7.
5. **`src/features/auth/*.tsx`, `src/features/lock/*.tsx` — raw error
   messages in user-facing copy.** Not a regression (it's how these screens
   were built), not caused by any of the six reviewed bugs, but a real,
   visible violation of §7's "never render `.message` raw" rule today, in
   four screens. Lower risk than 1–3 (nothing breaks, it's a
   correctness-of-intent issue, not a functional bug) but user-visible in
   Spanish-language production. Fix is mechanical: one `Record<string,
string>` copy lookup per screen/error domain.
6. **`src/lib/pinLock.ts`, `src/lib/drive.ts`, `src/lib/auth.ts` — no `code`
   union yet.** Lowest risk — correct as-is per §1's "only add `code` when a
   caller needs to branch on more than pass/fail," and no caller does yet.
   Listed here only so a future PR doesn't reach for a new `AuthError`
   subclass instead of adding a `code` when that day comes.

**Decisions for the operator before phase 2 touches code:**

- **Behavior change, needs explicit sign-off:** mapping `RepoError`/`AuthError`
  messages to Spanish copy (item 5) changes what users literally see on
  screen today (currently raw English fragments like `"missing
VITE_GOOGLE_CLIENT_ID"`) — worth a quick look at the proposed copy before
  it ships, not just the mechanism.
- **API-surface question, not yet answered:** should the §6 contract test
  suite live as `src/lib/repo.contract.test.ts` (a real Vitest file with an
  exported `testRepoContract()` helper, imported by both implementation test
  files) or as a non-test shared fixture module? The former is more
  idiomatic Vitest; the latter avoids a test file with no `describe` block
  of its own. No public API changes either way — internal to `src/lib/`.
- **Sequencing:** items 1–3 should not be touched until `fix/a-repo`,
  `fix/b-auth`, and `fix/d-fake` merge — reimplementing them now would
  conflict with in-flight work on the same files. `fix/d-ui` currently has no
  diff against `main` (checked at research time) — confirm its actual scope
  before phase 2 assumes it's a no-op.
