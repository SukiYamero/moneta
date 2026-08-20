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
  **Now urgent, 2026-08-20:** §10.26 (Track AB) needs somewhere to render sync
  state, and this row is the place the design already put it. The operator's
  reading is that the canvas is authoritative here — the code simply never
  caught up — and Track AB proceeds on that reading. Say so if it is wrong:
  it is a row in the profile sheet, cheap to move, expensive to build twice.
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
operator pushed five — so it currently had no owner.

**Answered 2026-08-20 (user): the operator builds it now.** It had become a
blocker on §10.26 (sync going live), which is a bad reason for a screen to stay
unbuilt. Built from primitives that already exist — `ScreenLoading`, the shared
error taxonomy, the design tokens — so a later canvas design **replaces** it
rather than argues with it.

**This item stays open** until the user has seen the built view and says it is
good enough to keep, or replaces it. The ownership question is answered; the
screen is not signed off.

### 6. The guest cliff — must be answered before launch, not before the flip — `owner: user`

`specs.md` §10.25 and §12. Someone who used the app as a guest for a month
signs in with Google and lands in a **fresh, empty profile** — their month is
still on the device, in a profile the UI cannot switch to, because the profile
switcher is Wave 5+.

This is not a bug to fix later: it is the moment a person concludes the app
lost their data. §12 names two acceptable answers and one that is not:

- **Bring the profile switcher forward into Wave 4.** Solves it properly. Costs
  a screen nobody has designed.
- **The account screen says plainly where the guest data went.** Cheap and
  honest, but does not actually get them back to it.
- **Ship the flip and say nothing** — ruled out.

**Updated 2026-08-20 (user): this no longer gates the `repoProvider` flip.**
Nothing is in production and nothing will be until the app is finished, so
there is no live user who can hit this today. It stays open as work that must
land **before the first real user signs in** — the deadline is launch, not this
wave. Asked again each session until it is answered.

### 7. The light palette itself, and a contrast check on the tints — `owner: user`

`specs.md` §10.24 Prerequisite 3 and §12. `index.html` hardcodes
`<html class="dark">`, and every `chart-*` token in the light palette is still
the scaffold's zero-chroma grey — so light mode is not merely unstyled, it is
**colorless**: every category tint, chip and breakdown bar renders grey, and
the scan-by-colour affordance stops working entirely.

Consequence: **Track G2 ships no theme picker.** Offering `claro` would ship a
control that visibly lies when tapped; offering `sistema` is worse, since it
hands the broken palette to anyone whose phone is on light without them
choosing it.

**Updated 2026-08-20 (user): the user is designing the light theme, and
category colours are already handled.** A tint is an identity, so `:root`'s
`chart-*` tokens now carry the same five values `.dark` does — that was the
minimum that had to be true before a light theme lands, and nothing else in the
palette was touched, deliberately, so there is nothing to undo.

**What is still yours:** the light palette itself (surfaces, borders, text
tiers), and a contrast check on those five tints against a light surface —
they were picked against a dark background, and `#f5b93f` and `#2fd896` are the
two to look at first. Until that exists, Track G2 still ships no theme
picker.

### 8. The brand mark for the boot screen — `owner: user`

Raised 2026-08-20, when the user chose a fixed brand moment at boot (§10.28).
The screen needs a mark and there isn't one: §12 has carried "App icon for the
brand" since Wave 1 and the PWA still ships the scaffold `favicon.svg`.

Built meanwhile from `APP_NAME` and the existing type/colour tokens, composed
to read as deliberate rather than unfinished, and structured so a real mark
drops in without a redesign. Note `AGENTS.md`: the display name is provisional
and lives only in `src/lib/branding.ts` — a mark that bakes the current name
into the artwork inherits that provisionality, so a wordmark and a symbol are
worth separating.

The same asset closes the PWA icon item, so it is one piece of work, not two.

---

## Closed

_Nothing yet._
