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

### 10. Look at the new screens on light — `owner: user`

Raised 2026-08-20, at the end of Wave 4.1 stage 1. Four screens were built in
the same batch that made light real, and **none of them has ever been seen on
a light background**: the returning-user screen (§10.21), and the PIN lock
screen, PIN setup and lock-settings panel (§10.2).

The cross-track pass checked them and found them clean, but it is worth being
precise about what that evidence is: it read every class and confirmed they
resolve through tokens rather than hardcoded values, which is a strong
argument that nothing is _structurally_ wrong. **It is not the same as looking
at them.** Glows and shadows tuned against black can be technically
token-correct and still read as muddy on `#F4F3EF`.

Pairs with what already needed your eye from §10.30: `#f72121` (the light rose
had nowhere to go but pure red) and `#af7809` (any yellow earning contrast on
white goes brown). One pass over the app in light mode answers all of it.

**Partially answered 2026-08-24 (user): "el tema claro funciona bien."** The
theme itself is confirmed working, and PIN setup and the lock-settings panel
were both driven in that session (the user set a PIN and enabled biometrics).

Three things in this item are still not confirmed, and they are not the same
question as "does light mode work":

- the **returning-user screen** on light — it only renders when a session has
  lapsed, so it is not on the path the user walked;
- the **PIN lock screen** on light (entering the PIN), as opposed to setting
  one up;
- the **judgment call** on `#f72121` and `#af7809` — whether pure red and
  brown are acceptable, which no measurement can answer.

Stays open, narrowed to those three.

### 4. Verify `connectDrive` against a real Drive — `owner: user`

Open in `specs.md` §12 since Wave 1 and **no agent can close it**: it needs a
human in the OAuth popup.

The check: first run creates the `KuroBello` folder plus its files; a second run
**reuses them without duplicating** (find-before-create). Confirm and §12's item
closes.

**Asked again 2026-08-20 (Wave 4.1 dispatch): not tested yet.** Stays open.

**Partially exercised 2026-08-24, and it is important to be precise about what
that does and does not prove.** The user signed in with Google in a browser,
created movements, saw the sync indicator read as connected, reloaded, and the
movements were still there.

That proves the OAuth round-trip and local persistence. **It does not prove
this item.** A reload survives on IndexedDB alone (§10.3.1) — it says nothing
about a file in Drive. And the specific thing this item exists for is the
**second** run: find-before-create. What still has to be seen with human eyes
is `drive.google.com` itself — **exactly one** `KuroBello` folder after the
first run, and **still exactly one**, not two, after signing out and back in.
Stays open.

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

**Asked again 2026-08-20 (Wave 4.1 dispatch): the user has not seen it running
yet.** Stays open. Track AD owns the handoff _into_ this screen and is
explicitly forbidden from redesigning the screen itself while it waits for the
user's own eye.

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

**Built 2026-08-21 (Wave 4.1, Track AG): both halves shipped.** The switcher
recovers every profile ever signed into on the device, and a guest signing in
with local movements is now asked, once, whether to bring them along. **The item
stays open until you have used it** — a shipped flow is not a confirmed one.

**Updated 2026-08-20 (Wave 4.1): both halves are now specified and owned.**
§10.32 prevents the cliff (a guest signing in is _asked_ whether to bring their
movements into the account — a prompt rather than an automatic move, because
adopting means uploading to that person's Drive and guest mode is precisely the
consent that withholds), and §10.31 recovers from it (the profile switcher).
Both are Track AG, stage 2 of Wave 4.1. **The item stays open until the user has
used the built flow** — the plan being right is not the same as the person
getting their month back.

**Updated 2026-08-20 (user): this no longer gates the `repoProvider` flip.**
Nothing is in production and nothing will be until the app is finished, so
there is no live user who can hit this today. It stays open as work that must
land **before the first real user signs in** — the deadline is launch, not this
wave. Asked again each session until it is answered.

### 8. The brand mark — now only the PWA icon — `owner: user`

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

**Rescoped 2026-08-20:** the boot screen this item was raised for **no longer
exists** — §10.29 deleted it the same day (the user saw two loaders in the
running app, and the design export has no splash artboard at all). What remains
is the PWA icon, plus the small mark the export does use on the auth screens,
which Track AD builds with Lucide from `APP_NAME` per `AGENTS.md`. A real
designed mark still replaces it without a redesign.

### 12. The Add sheet's gear button — what should it actually do? — `owner: user`

Raised 2026-08-25, Ajustes 1 Track AJ-C, while rebuilding the Add/Edit
sheet against the design export nobody had read (`specs.md` §10.41, §12).
`docs/ui/design-export-add-sheet.md` §2 draws a gear button in the sheet's
header, opening app settings.

It is **not built**. Traced: `/settings` is a sibling top-level route, not
nested under the layout route that hosts `AppShell` (deliberately, so
`ProfileSheet`'s own settings link closes it for free by unmounting
`AppShell`). Wiring the Add sheet's gear the same way would unmount
`AppShell` mid-entry and silently discard whatever the user had typed —
`ProfileSheet` gets away with the same link only because it holds no draft
to lose.

This needs a product answer, not an engineering one: **what is the gear
even for, mid-entry?** Two shapes exist and neither is a small fix: turning
`/settings` into an overlay instead of a page-swap route (touches the
whole app's navigation model), or a scoped "quick settings" popover inside
the sheet (showing what, exactly — the currency? the default account? — no
one has decided). Until there's an answer, the control is simply not
rendered, the same way the camera/microphone aren't (a control that would
work but do something surprising is worse than its absence).

### 14. Does an IME/soft keyboard survive typing an amount? — `owner: user`

Raised 2026-08-25, review-aj2-a (`specs.md` §10.45.1), reviewing Track
AJ2-A's live-grouping amount input. `MovimientoAmountInput.tsx`'s
`onChange` handler reformats the typed text and moves the caret directly
on the native input's DOM node, synchronously, on every `input` event — it
does not check `event.nativeEvent.isComposing` and does not special-case
`compositionstart`/`compositionend`. Reasoned through and mechanically
verified with jsdom's `compositionStart`/`change`/`compositionEnd` events
that the handler does reformat mid-"composition" there, but jsdom does not
model a real IME's composition-string overlay, so this cannot be confirmed
or ruled out in this environment — forcibly rewriting `.value` and the
selection while a real IME owns an active composition range is a
known-risky pattern elsewhere (some editors special-case it for exactly
this reason).

**The check:** on a real device with an IME active (e.g. an Android
keyboard set to Japanese or Chinese, or an iOS keyboard with predictive
full-width numerals), open the Add sheet and type a multi-digit amount
into the Monto field. Does the number and its grouping come out correct,
with no duplicated/dropped characters and no composition candidate window
misbehaving? A plain Latin/QWERTY keyboard (including `inputMode=decimal`
numeric layouts) is not expected to exercise this at all — the concern is
specifically an IME session.

### 13. Does tapping `+` now raise the keyboard? — `owner: user`

Raised 2026-08-25, Ajustes 2 Track AJ2-B (`specs.md` §10.46), while fixing
the Add sheet's amount input never raising iOS Safari's software keyboard.
The fix (a synchronous `useLayoutEffect` focus instead of a deferred
`requestAnimationFrame` inside a passive `useEffect`) is **CONFIRMED as the
right mechanism** — proven by a unit test that fails against the old code
and passes against the new one — but whether iOS Safari **itself** now
raises the keyboard is **PLAUSIBLE only**: no agent in this repo can drive
real iOS Safari. `specs.md` §10.46 already flagged this needed a
one-line check here at merge; it had not actually been added until this
review pass caught the gap.

**The check:** on a real iPhone, tap the `+` FAB. Does the software
keyboard rise immediately, with the caret already in the amount field, no
extra tap needed?

### 11. Where the biometric option lives, and how it is presented — `owner: user`

Raised 2026-08-24, from the first manual pass. The user set up a PIN, enabled
biometrics, and **it worked end to end** — the machine's own biometric prompt
came up. The mechanism is not in question.

What they did not like is **where the control sits and how it is shown**. Their
words: "funciona… sin embargo, dónde está ubicado y cómo lo mostramos no me
gustó."

Nothing more specific than that yet, and it is deliberately not guessed at
here. Before any track touches it, the user says what is wrong with the
placement — it is a design judgment, and §10.2's biometric half was built by
the operator without a canvas artboard to work from, because the design export
contains **no biometric UI anywhere** (confirmed by exhaustive search,
`docs/ui/design-export-reference.md` §4). So there is no reference to fall back
on; the answer has to come from the user.

**Not a bug, and not urgent.** Filed so it does not die in a conversation.

### 15. Does the Add sheet stay put with the keyboard up now? — `owner: user`

Raised 2026-08-25, Ajustes 3 Track AJ3-B (`specs.md` §10.49), fixing item 2
of `docs/ajustes-3-plan.md`: tapping `+` correctly raised the keyboard
(item 13, confirmed), but the sheet then appeared scrolled down, hiding
the gasto/ingreso toggle at its top. The fix pins the sheet (and the
create-category modal) to the actual visible area using
`window.visualViewport`, rather than the full layout viewport `dvh`
resolves against — **CONFIRMED only by unit test against a mocked
viewport API; no agent here can drive real iOS Safari or a real Android
device**, so whether it actually holds on a phone is PLAUSIBLE, not
proven.

**The check:** on a real iPhone, tap `+` on the Add sheet. Once the
keyboard rises and the amount field is focused, is the gasto/ingreso
toggle at the top of the sheet still visible, with no need to dismiss the
keyboard and scroll back up? Separately, worth a look while the sheet
being opened: the create-category modal (opened from the Add sheet's
dashed "Custom" chip) previously took the full screen height with no
reachable way to close it — the same shell fix now bounds and scrolls it,
which is reasoned to fix this too but was never confirmed on a device
either.

---

## Closed

### 3. The two undecided artboards — closed 2026-08-24 (user)

**Decided: both stay, frozen.** "Notificaciones" and "Escaneo de factura" keep
their artboards, and their viability gets looked at **at the end**, once
everything else is built — not now, and not as part of any current wave.

So they are neither aspirational nor deleted: they are parked, with a named
moment to revisit. The risk this leaves open is that someone implements one by
mistake, which is why it is also written into `specs.md` §11 and why
`docs/waves.md` § "Deliberately not in this wave" already names both.

The other two questions in this item were resolved on 2026-08-20 and are kept
here so they are not re-asked: the **Drive status row** (the canvas was ahead,
Track AB shipped it, §10.26) and **"AUTH: ACCOUNT CHOOSER"** (it is a mock of
Google's own dialog, which we never render; what the user actually wanted from
it became Track AG, §10.31).

### 1. Design the PIN screens in the canvas — closed 2026-08-20 (user)

The user reports the PIN design is done, covering both the unlock states and
the forgotten-PIN path.

**Unblocked 2026-08-20, and the reason is worth keeping:** this item sat
waiting on an artifact link because the canvas file (`Moneta.dc.html`) is not
in this repo and the live canvas is unreachable to an agent session (403,
verified). Versioning the export instead removed the dependency entirely —
`docs/ui/design-export-reference.md` §4 documents all four PIN artboards
(settings panel, lock screen, setup, and the "Olvidé mi PIN" confirm) in
enough detail to implement, so Track AF was dispatched without the link ever
arriving. The one thing the export genuinely does not contain is any biometric
UI, confirmed by exhaustive search — which is why §10.2.1 assigns that half to
the operator.

### 9. Should a guest be able to set a PIN? — closed 2026-08-20 (user)

**Decided: no PIN for a guest. Biometrics at most.** Raised the same day, from
the user's own question about forgotten PINs, and answered the same day.

The reasoning it resolves: a guest lockout has no honest recovery, because
re-entry cannot be "sign in with Google" when there is no Google — leaving
only "wipe their data" (brutal) or "let them in anyway" (decoration).
Biometrics sidesteps it: there is nothing to forget, so there is no lockout to
recover from.

**What the operator told the user before they decided, recorded so the
limitation is not rediscovered as a bug:** for a guest this is a UI gate, not
a cryptographic boundary. There is no session, so there is no token to wrap
with the WebAuthn PRF secret — and the local financial data is not encrypted
at rest for anyone, guest or signed-in (§10.2 put "encrypting the local
financial-data cache" explicitly out of scope). It genuinely defends against
the realistic threat — someone picking up an unlocked phone — and does not
defend against someone who knows to open IndexedDB. Closing that second gap
means encrypting the local cache, which is separate, deferred work.

**Still to build** (not a user item — filed for the implementing track): the
guest branch of the lock UI, which today shows a control that can only fail
(`specs.md` §12). With this decision it shows a biometric option where the
platform supports it, and nothing where it does not — never a PIN.

### 2. Design the returning-user screen in the canvas — closed 2026-08-20 (user)

**The design already existed and nobody had looked.** The versioned export
(`docs/ui/design-export-reference.md` §3) contains a complete `AUTH: RETURN`
artboard — small brand mark, greeting by first name, an account card with an
expired chip, "Continuar como <name>", "Usar otra cuenta" — matching §10.21
closely. Asked directly, the user confirmed Track AD builds from it.

Two divergences from the artboard are deliberate and recorded in
`docs/wave-4.1-plan.md` §3: the expired chip uses the `--warning` token instead
of the export's untokenized `#E8B84B`, and the reassurance line is **gated on
local data actually being present** rather than rendered unconditionally the
way the artboard does — the export has no branch for "the data isn't there",
and §10.21 is explicit that this exact class of claim must stay true.

### 7. The light palette itself, and a contrast check on the tints — closed 2026-08-20 (user)

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

**Closed 2026-08-20.** The palette arrived with the design export
(`docs/ui/moneta-theme.css`), and the operator ran the contrast check as
measurement rather than judgment — correcting its own earlier guess that
`#f5b93f` and `#2fd896` were "the two to look at": **all five tints fail on
light**, 1.62–2.32 against a 3.0 threshold, measured in their real usage. Light
variants holding hue and saturation are decided in §10.30.

**Two are worth your eye once you can see them running**, and neither blocks:
`#f72121` (the rose had nowhere to go but pure red) and `#af7809` (any yellow
earning contrast on white goes brown).
