# Open items that need the user, not an agent

Things only Diego can do — design work in the Claude Design canvas, decisions
nobody else can make, and verification that needs a human in a browser.

**How this file works, and it is binding on every agent:**

1. **At the start of a session, read this file and ask about every open item.**
   Ask concretely — "did you get to the PIN unlock screen?" — not "any updates?"
2. **Never mark an item done on your own.** An item is closed only when the
   user says so. If they don't answer, it stays open and gets asked again next
   session. Silence is not confirmation.
3. When an item closes, move it to **Closed** at the bottom with the date, so
   the record survives and nobody re-raises it.
4. Add an item here the moment something turns out to need the user — do not
   let it live only in a conversation that ends.

---

## Open

### 1. Design the PIN screens in the canvas — `owner: user`

**Nothing about the PIN lock has ever been designed.** Verified against
`Moneta.dc.html` on 2026-08-19: there is no lock artboard anywhere. `LockScreen`
and `LockSettings` were built in Wave 1 without a design and still look it.

It is now the highest-value screen missing, because after Wave 3 it is the
**first thing a returning user sees** when the lock is enabled, and Track Y made
it reachable in a production build for the first time.

Two states to cover: entering the PIN to unlock (including the wrong-PIN and
locked-out states), and configuring it (set / disable / lock now).

### 2. Design the returning-user screen in the canvas — `owner: user`

Spec is written: `specs.md` §10.21. A person who has used the app for months and
reopens it must never see the first-run pitch — it reads as "everything reset".

Note the canvas's existing **"AUTH: ACCOUNT CHOOSER"** is _not_ this: it is a
mock of Google's own popup, which we never render ourselves.

### 3. Four canvas-vs-code questions still unanswered — `owner: user`

Asked 2026-08-19, still open. Each one is a "which side is authoritative"
question that `AGENTS.md` says must not be resolved by assumption:

- **Drive status row.** The canvas has it in the profile sheet; the code does
  not. `specs.md` §12 has carried it since Wave 2 — here the canvas is ahead
  and the code should catch up. Confirm and it becomes a build task.
- **"Notificaciones" preference.** No notification system exists, and with no
  backend there can be no push (§6). Remove from the canvas, or keep it as
  aspirational knowing it needs an explicit §6 exception?
- **"Escaneo de factura" screen.** Receipt scanning is deferred _indefinitely_
  (§11, 2026-08-18). Keep the artboard as a memory of the idea, or remove it so
  nobody implements it by mistake?
- **"AUTH: ACCOUNT CHOOSER".** A mock of Google's own popup — never
  implementable by us. Keep for flow storytelling, or remove?

### 4. Verify `connectDrive` against a real Drive — `owner: user`

Open in `specs.md` §12 since Wave 1 and **no agent can close it**: it needs a
human in the OAuth popup.

The check: first run creates the `KuroBello` folder plus its files; a second run
**reuses them without duplicating** (find-before-create). Confirm and §12's item
closes.

### 5. Who designs the first-run download view? — `owner: undecided`

`specs.md` §10.19 specifies it: when a profile has never completed a pull, a
dedicated full-screen view with real progress and an honest failure state,
because rendering a dashboard of zeros reads as data loss.

It was left out of the 2026-08-19 split — the user took two screens, the
operator pushed five — so it currently has no owner. Decide: user designs it, or
the operator pushes a mock like the others.

---

## Closed

_Nothing yet._
