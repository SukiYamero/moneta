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

### 18. Saving a category does not work — `owner: user` (deferred by the user)

Raised 2026-08-25 by the user, from the same iPhone pass: "sigue sin poder
guardar la categoría y necesitamos ajustar cosas allí una vez terminemos
todo." **Deferred by the user's explicit decision** until the current
adjustments close; filed here so it does not die in a conversation.

**Not investigated, and deliberately not guessed at in code.** One lead is
recorded so the eventual track does not start cold: `CategoryFormModal`'s
Save is **disabled until the form is valid** (a comment in
`useMovimientoForm.ts` names this as the precedent it deliberately did _not_
follow). If that is what is happening, it is the same shape as the Add
sheet's own "nothing happens" bug (`specs.md` §10.48) — the app knows why it
will not save and does not say so anywhere the user can see. A disabled
button with no stated reason is indistinguishable from a broken one.

That is a hypothesis, not a finding. It must be reproduced before anything
is changed.

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

### 17. Is the background above the keyboard gone? — `owner: user`

Raised 2026-08-25 by the user's own report and fixed the same day
(`specs.md` §10.52). With the Add sheet open and the keyboard up, the strip
above the keyboard showed the app's canvas background plus the `+` FAB and
the tab icons instead of the dimmed backdrop, because Track AJ3-B's
keyboard fix clamped the backdrop along with the panel.

**Still reported by the user a third time after §10.52's fix** — so Track
AJ4-A (`specs.md` §10.53) made two further changes, neither trusting the
same geometry reasoning a third time: the backdrop now overscans well past
`inset-0` on every edge (uncoverable regardless of whether the pan/shrink
model is exactly right), and `BottomNav` itself now hides
(`opacity-0 pointer-events-none`, never unmounts) while _any_ overlay is
open, discovered via the shared overlay stack rather than a check specific
to the Add sheet — so even if the backdrop's geometry is still somehow
wrong, there is nothing visible left underneath it to bleed through.

**CONFIRMED by regression test** (both shells' overscan, `BottomNav`'s
hide-and-refocus, each watched failing first). **Not confirmed on a
device** — no iOS device is available in this environment, same limit as
items 13/15/16.

**The check:** on a real iPhone, open the Add sheet and raise the keyboard.
Is everything behind the sheet uniformly dimmed, with no strip of app
background, no `+` and no tab icons anywhere — this time for good?

### 16. Does a blocked Add tap bring you to the field that blocked it? — `owner: user`

Raised 2026-08-25, cross-track review of the Ajustes 3 batch, for Track
AJ3-D (`specs.md` §10.51): tapping Add with the amount empty or no category
picked now moves focus to whichever one blocked the save (and scrolls it
into view), instead of the earlier fix's unconditional `blur()`. Same honesty
limit as items 13/15, never applied to this fix specifically: **CONFIRMED**
that focus lands on the right control (a unit test proves it, both for the
category-missing and the invalid-amount case), but whether that focus
change actually **dismisses the iOS software keyboard** when the category
is what's missing is standard, documented WebKit behavior reasoned about,
not watched happen — no iOS device is available in this environment.

**The check:** on a real iPhone, open the Add sheet, leave the amount blank,
tap the category "ver todas" chip's Add-adjacent flow so no category ends up
picked, then tap Add. Does the keyboard actually go away and land you on the
category picker? Then, separately: leave the amount as something invalid
(e.g. just a decimal separator) with a category already picked, and tap Add
— does the keyboard stay up with the amount field still focused and visible
(not covered), rather than flickering or losing your place?

### 20. Is the band above the keyboard finally gone? — `owner: user`

The strip of undimmed app background above the iOS keyboard, reported three
times against three different fixes. The first three treated it as geometry
and were all wrong.

The cause is a WebKit clipping bug (bug 300965): a `position: fixed` element
painting at **exactly** `opacity: 1` is treated as a simple fill and clipped
to the main viewport, leaving out the region behind the keyboard's accessory
bar. `animate-fade-in` ends at `opacity: 1` with no fill-mode, so every
overlay layer sat precisely on the triggering value at rest. They now paint
at `.99` — imperceptible, and enough to escape the clipping. A second,
structurally different fallback dims the `body`'s own background while any
overlay is open; a root canvas paint is not a fixed layer, so it cannot be
clipped the same way.

**PLAUSIBLE, not confirmed.** No agent here has an iOS device. What _was_
proven is that the geometry is sound — the overscan, the clamp and the scroll
container were all measured correct in real WebKit — so the model was never
the problem. The mechanism is corroborated by independent external reports of
the same symptom and the same workaround.

**The check, and it has two halves — please report both:** on your iPhone,
open the Add sheet and raise the keyboard.

1. Is the strip above the keyboard now dimmed like the rest of the screen,
   with no app background, no `+` and no tab icons?
2. Are the category chips **scrollable** rather than sliced off? In your
   screenshot they were cut mid-shape with no sign more content existed.

**Partially answered 2026-08-25 (user), and his premise needs one
correction.** He reports the band was the iOS keyboard's own chrome, and
that since the amount field now uses our on-screen keypad it no longer
affects him — so the workarounds could come out.

The first half is right; the conclusion is not, and removing them would
reintroduce the bug. **The OS keyboard has not left this sheet.** The note
field behind "Más detalles" is an ordinary `TextField`, and so is the
create-category name field — both still raise it. Only the amount field
stopped doing so. The overscan, the `.99` opacity paint and `BottomNav`'s
hide all stay.

**The check is therefore re-worded, not closed:** open the Add sheet, expand
"Más detalles", and tap into the **note** field so the iOS keyboard comes up.
Both halves still apply — is the strip above it dimmed, and are the category
chips scrollable rather than sliced?

### 19. Keeping the app in portrait — what actually locks, and the guard screen's design — `owner: user`

Raised 2026-08-25, Track AJ4-A (`specs.md` §10.53), from "the app should
never enter landscape." Built: `vite.config.ts`'s manifest already declared
`orientation: 'portrait'` (pre-existing); a mobile-browser-tab fallback
(`useIsLandscape`/`LandscapeGuard`) now blocks the screen with a minimal,
deliberately provisional "rotate your phone" message when no real lock is
possible. `screen.orientation.lock()` is not called anywhere — it only
works fullscreen or installed on Chromium and isn't implemented by iOS
Safari at all, so calling it would silently do nothing on the platform that
most needs the fallback.

Two things need you, not more engineering:

- **You said you're designing this guard screen yourself** ("voy
  trabajando en el diseño de esa pantalla"). What's shipped is intentionally
  a placeholder (existing tokens, a generic icon, plain copy) — replace it
  whenever your design is ready; the file to edit is
  `src/components/shared/LandscapeGuard.tsx` alone.
- **The device check, no agent here can run:** on your iPhone, install the
  app to the home screen and try to rotate it to landscape — does it
  actually stay in portrait, or does the screen rotate? Separately, on a
  real mobile browser tab (not installed), rotate the phone — does the
  "rotate your phone" message appear and go away correctly as you rotate
  back? (The guard covers the whole app — it mounts in `src/main.tsx`,
  above the router, so the auth screens, the PIN lock and `/settings` are
  guarded too, not just the three bottom-nav tabs.)

**Partially answered 2026-08-25 (user), and it settled one half while
opening a new question.** He saw the gate on a real phone, dismissed it —
and it never came back, because the skip was written to IndexedDB as a
per-device preference. That confirms the gate appears and that its dismiss
works; it also told him the persistence was wrong. The skip is now
per-session (`specs.md` §10.53): dismiss it and it stays quiet for the rest
of that run however much you rotate, but a reload or a fresh launch shows it
once again.

Three things in this item are still open, and they are not the same
question as "does the gate appear":

- the **installed PWA** actually staying in portrait when you rotate it —
  nothing in this session touched that, and no agent here can test it;
- the **new per-session behavior** on your device: dismiss it, rotate back
  and forth (it must stay quiet), then reload (it must come back once);
- your own **design** for the screen, which is still yours and still
  unstarted. What ships is the placeholder.

### 21. Do the PIN screens still summon the iOS keyboard? — `owner: user`

Raised 2026-08-25, sweeping for the shape of the amount field's fix
(`specs.md` §10.2, §10.54). `LockScreen` and `PinSetup` each back their PIN
dots with an `sr-only` `<input>`. `sr-only` clips the box to a pixel but
leaves it real and focusable — so WebKit still raises the OS numeric
keyboard for it, on top of `PinPad`, which is the keypad those screens
actually show. `PinSetup` focuses it synchronously on open (`initialFocus`),
and on `LockScreen` the wrapping `<label>` forwards a tap on the visible
dots to it, so both screens reach it without any autofocus.

Both now carry `inputMode="none"`, the same fix the amount field uses.
**CONFIRMED** that the input is focusable (read from the compiled Tailwind
`sr-only` rule) and that `PinPad`'s keys are real labelled buttons, so the
accessible path survives. **PLAUSIBLE, not confirmed**, that iOS was
actually raising the keyboard there — no iOS device exists in this
environment, the same limit as items 16/17/20.

**The check:** on your iPhone, open _Configurar PIN_ from the profile sheet,
and separately reach the unlock screen and tap the dots. In both, does only
our own keypad appear — no second, system keyboard sliding up over it?

### 22. Does the amount keypad behave on the device? — `owner: user`

Raised 2026-08-25, from your own report that it never went away
(`specs.md` §10.54). Four behaviors changed and all four are **CONFIRMED in
Chromium and PLAUSIBLE on iOS** — the root cause was WebKit-specific and no
iOS device is available here, so the fix is deliberately built not to depend
on either engine's focus behavior rather than verified against the one that
broke.

**The check, and please report each separately:**

1. Tapping anywhere outside the pad hides it and clears the green ring.
   **This is now the only way to dismiss it** — the drag bar the user asked
   for was removed at his own request the same day, for eating vertical
   space, so if this fails on his device he is stranded with the pad up.
2. Tapping the gutter beside the outer keys, between two keys, or dead
   centre where four keys meet, does **not** hide it. This is the case he
   reported twice; it could not be reproduced in Chromium _or_ in real
   WebKit, so the fix is an invariant (a gesture starting on the pad never
   dismisses it) rather than a repair of a proven fault.
3. All twelve keys are visible without the bottom row being cut. Keys are
   53px tall now; the previous 62px plus the bar overflowed a small sheet
   by 36px, which is what he was hitting.
4. Tapping a category chip while the pad is up selects that chip on the
   **first** tap, rather than only closing the pad.

**Before reporting a failure, rule out a stale build.** This is a PWA; a
service worker can serve an older bundle, and the user was testing against a
work-in-progress dev server at one point. A forced reload separates "the fix
does not work" from "the fix was not there".

Separately, a question rather than a check: with the pad up, the amount
field keeps a green focus ring, because it genuinely holds focus the whole
time. It goes away when you dismiss the pad. Do you want it suppressed on
that field specifically, given our own keypad already makes it obvious where
you are typing?

### 23. Three more amount-field requests — `owner: user`

Raised 2026-08-26, from your own three follow-up requests. All CONFIRMED in
Chromium (real geometry/timers, not just jsdom); no iOS device is available
here.

1. Tapping the empty space beside the amount (or the currency symbol
   itself) now hides the pad, for both a short and a long amount — not just
   right at the phone's true edge.
2. Holding the delete key now keeps deleting until you lift your finger,
   move off the key, or reach an empty field.
3. As the amount grows past 9 and 12 characters, the digits shrink a step
   (measured ~28px and ~67px narrower than they'd otherwise be) so more of
   a large number stays visible — short amounts render at exactly the size
   they always did.

---

## Closed

### 13. Does tapping `+` now raise the keyboard? — closed 2026-08-25 (user)

**Confirmed on a real iPhone:** "toqué el + y sube el teclado bien, me pone
el foco listo para escribir." Ajustes 2 Track AJ2-B's synchronous
`useLayoutEffect` focus (`specs.md` §10.46) was CONFIRMED as the right
mechanism by unit test and PLAUSIBLE on the device; it is now confirmed on
the device too.

Worth keeping for the next time this shape appears: the fix was reasoned
from a platform rule (iOS Safari only opens the keyboard for a `.focus()`
inside the task carrying user activation) that no test here could exercise.
The unit test proved the _mechanism_ changed — focus became synchronous —
and the user proved the _outcome_. Neither alone would have been enough.

### 15. Does the Add sheet stay put with the keyboard up now? — closed 2026-08-25 (user)

**Both halves confirmed on a real iPhone.** The gasto/ingreso toggle stays
visible with the keyboard up ("si ya están a la vista expense y income lo veo
bien"), and the create-category modal is now proportional to the viewport —
it opens fully visible with the keyboard up and stretches back correctly when
the keyboard closes. `specs.md` §10.49's device claim was PLAUSIBLE and is now
CONFIRMED.

Two things came out of the same pass and are **not** part of this item:

- The three floating options above the keyboard are **Safari's own form
  accessory bar**, not ours. Confirmed with the user, nothing to do.
- **A regression the fix introduced**, reported in the same message and fixed
  the same day (cross-track review, `specs.md` §10.52): the backdrop was
  nested inside the wrapper the fix clamps, so it shrank too and let
  `BottomNav`'s canvas gradient, the `+` FAB and the tab icons show through
  above the keyboard. The backdrop is now an always-full-screen sibling.
  **That fix is itself unconfirmed on a device** — see item 17.

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
