# Wave 3.1

**Goal.** Make sign-out actually invalidate the session, and give a profile a record of whose it is.

**Why.** Track Y's review traced a confirmed defect: with a PIN set, "Sign out" returned the user to the account they had just left, because `logout()` cleared in-memory state but never touched the PIN-lock vault.

- **Track AA** (§10.20) — invalidates the vault on logout so a correct PIN can't resurrect the previous account; adds an account key to `ProfileRecord` so the registry records whose data a profile holds, not just what kind it is; adds an unsynced-and-unlinked confirm step and an inert delete control ahead of real profile deletion.
