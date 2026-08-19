# Review — Track E4 (History)

Completed by the operator after the review agent's run was cut short by an
infrastructure failure (the machine sleeping mid-response). The analysis and
code are the agent's, verified and committed by the operator; the agent never
got to write this file itself.

## Findings

### 1. CONFIRMED — selecting a year from a Feb 29 anchor jumped to March 1

`useHistoryPeriod.selectYear` used date-fns' `setYear`, which writes the
year component directly and does **not** clamp day-of-month overflow.
Reproduced against the real library:

```
setYear(parseISO('2024-02-29'), 2025)  -> 2025-03-01
addYears(d, 2025 - getYear(d))         -> 2025-02-28
```

So a user viewing 29 February 2024 and picking 2025 from the year menu
landed in March — a different month than the one they asked for, silently.
Fixed by expressing the jump as `addYears` by the year delta, which clamps
the same way `step()` in the same file already relies on. Note the defect
shape: two sibling operations in one hook, one clamping and one not.

### 2. Assigned finding — the error state was the odd one out, now fixed

`HistoryScreen` announced a load failure inside `role="status"` (polite) with
no way to retry, while Home and Search both use `role="alert"` with a retry
button. `docs/error-handling.md` §7 requires errors to reach the user through
a `role="alert"` node. Three screens were built in parallel from the same
standard and this one drifted. Now matches: `role="alert"`, a retry calling
`dataStore.load()` (which retries from `'error'`, unlike from `'ready'`), and
loading keeps `role="status"`, which is correct for it.

### 3. The `sr-only` heading is justified here, unlike on Home

`HistoryScreen` renders an `sr-only` `<h1>`. On Home the same pattern was a
distortion — a real visible heading existed (the greeting) and was being
duplicated invisibly to satisfy a placeholder-era test. Here the design
genuinely has no visible title on this screen (its header is a year button
and a hide-amounts toggle), so an `sr-only` heading is the honest way to give
the route an accessible name. Verified against the design source. No change.
