# Open items that need the user, not an agent

Things only the user can do — design work in the Claude Design canvas, decisions nobody else can make, and verification that needs a human in a browser.

**How this file works, and it is binding on every agent:**

1. **At the start of a session, read this file and ask about every open item.** Ask concretely — "did you get to the PIN unlock screen?" — not "any updates?"
2. **Never mark an item done on your own.** An item is closed only when the user says so. If they don't answer, it stays open and gets asked again next session. Silence is not confirmation.
3. When an item closes, move it to **Closed** at the bottom, so the record survives and nobody re-raises it.
4. Add an item here the moment something turns out to need the user — do not let it live only in a conversation that ends.

---

## Open

### 10. Look at the new screens on light — `owner: user`

Three things still haven't been seen on the light theme (confirmed working otherwise): the returning-user screen (only renders after a session lapses, so it wasn't on the path the user already walked), the PIN-entry lock screen (as opposed to PIN setup, which was seen), and a judgment call on two colors (`#f72121`, a rose that has nowhere to go but pure red on light; `#af7809`, a yellow that only earns contrast on white by turning brown) — ask whether those two read as acceptable.

### 4. Verify `connectDrive` against a real Drive — `owner: user`

Needs a human in the OAuth popup; no agent can do this. The user has signed in and confirmed data survives a reload, but that only proves IndexedDB persistence, not Drive. What's still unverified: opening `drive.google.com` directly and confirming there is exactly one `KuroBello` folder after first sign-in, and still exactly one — not a duplicate — after signing out and back in (find-before-create).

### 5. Who designs the first-run download view? — `owner: undecided`, sign-off owner: user

The full-screen view shown on a profile's first Drive pull (real progress, honest failure state) is built from existing primitives so a later canvas design can replace it without a fight. Ownership is settled; what's still open is whether the user has seen it running and considers it good enough to keep as-is or wants it redesigned.

### 6. The guest cliff — must be answered before launch — `owner: user`

Someone who used the app as a guest and then signs in with Google could land in a fresh, empty profile while their guest data sits on the device unreachable — the moment a person would conclude the app lost their data. Both halves of the fix are built and shipped (a profile switcher that recovers every profile ever signed into on the device, and a one-time prompt asking a signing-in guest whether to bring their local movements along), but neither has been used by the user yet. Doesn't block anything today since there's no live user, but must be confirmed working before the first real signup.

### 8. The brand mark — now only the PWA icon — `owner: user`

The boot screen this was originally raised for no longer exists (deleted after the user saw two loaders). What remains is the PWA icon and a small mark used on the auth screens, both built from `APP_NAME` and existing tokens as a placeholder. A real designed mark can drop in later without a redesign — ask whether the user wants to design one, or ship the placeholder.

### 12. The Add sheet's gear button — what should it actually do? — `owner: user`

The design export shows a gear button in the Add sheet's header opening app settings, but it isn't built: `/settings` is a sibling route that unmounts the whole app shell on navigation, which would silently discard whatever the user was typing mid-entry. This needs a product decision, not an engineering fix — either turn `/settings` into an overlay (touches the app's whole navigation model) or build a scoped "quick settings" popover inside the sheet (showing what, exactly — nobody has decided). Ask what the gear should actually do before anything is built.

### 14. Does an IME/soft keyboard survive typing an amount? — `owner: user`

The amount field's live-grouping rewrites the input's value and caret position synchronously on every keystroke, which is a known-risky pattern against an active IME composition session (test tooling can't simulate a real IME's composition overlay to confirm either way). The check: on a real device with an IME active (e.g. Android set to Japanese/Chinese, or iOS predictive full-width numerals), type a multi-digit amount into the Monto field in the Add sheet — does the number and its grouping come out correct, with no duplicated/dropped characters and no composition window misbehaving? A plain Latin/QWERTY keyboard isn't expected to exercise this.

### 18. Saving a category does not work — `owner: user` (deferred by the user until other adjustments close)

Reported directly by the user, not yet investigated or reproduced. One lead worth checking first: the category form's Save button is disabled until the form is judged valid with no visible reason shown — the same shape as an earlier "nothing happens on tap" bug already fixed elsewhere in the app. Needs reproduction before any fix is attempted.

### 11. Where the biometric option lives, and how it is presented — `owner: user`

The biometric unlock mechanism itself works end to end (confirmed) — the complaint is about where the toggle sits and how it's shown in the UI, with no more specific feedback given yet. The design export has no biometric UI anywhere to fall back on, so the current placement was built without a reference. Ask what specifically looked wrong about the placement/presentation before any track touches it.

### 17. Is the background above the keyboard gone? — `owner: user`

With the Add sheet open and keyboard up, a strip of undimmed app background (with the `+` FAB and tab icons visible) used to show above the keyboard instead of a dimmed backdrop. Fixed twice over (the backdrop now overscans past the visible area on every edge, and the bottom nav hides entirely while any overlay is open) and confirmed by regression test, but not on a real device. The check: on a real iPhone, open the Add sheet and raise the keyboard — is everything behind the sheet uniformly dimmed with no app background, `+`, or tab icons showing through, this time for good?

### 16. Does a blocked Add tap bring you to the field that blocked it? — `owner: user`

Tapping Add with the amount empty or no category picked now moves focus to whichever field blocked the save instead of just blurring — confirmed by unit test that focus lands correctly, but whether that focus change actually dismisses the iOS keyboard (standard documented WebKit behavior, not watched happen) is unconfirmed. The check on a real iPhone: leave the amount blank with no category picked, tap Add — does the keyboard go away and land you on the category picker? Then, with a category picked but an invalid amount, tap Add — does the keyboard stay up with the amount field focused and visible, not covered?

### 20. Is the band above the keyboard finally gone? — `owner: user`

Same symptom as item 17, reported a third time, traced to a real WebKit clipping bug (a `position: fixed` element painting at exactly `opacity: 1` gets clipped to the main viewport, missing the region behind the keyboard's accessory bar) — overlays now paint at `.99` to dodge it, plus a body-background dim as a structurally different fallback. The user partly answered: the amount field now uses the app's own keypad and no longer raises the OS keyboard, so that specific case is resolved — but the note field and the create-category name field are ordinary text inputs that still raise the OS keyboard, and those are what still need checking. The check: open the Add sheet, expand "Más detalles", tap into the note field — is the strip above the keyboard dimmed (no app background, `+`, or tab icons), and are the category chips scrollable rather than sliced off?

### 19. Keeping the app in portrait — what actually locks, and the guard screen's design — `owner: user`

`screen.orientation.lock()` isn't called anywhere (it's fullscreen/Chromium-only and iOS Safari doesn't implement it), so a full-screen "rotate your phone" guard blocks the screen instead when no real OS-level lock is possible. The guard mounts above the router, ahead of the app shell, so it covers auth, the PIN lock, and `/settings` too — not just the three bottom-nav tabs. The user is designing this guard screen themselves (currently a placeholder); confirmed once that the gate appears/dismisses correctly on a real phone and that the dismiss is now per-session rather than sticking forever. Still open: whether the installed PWA (added to the home screen) actually stays in portrait when rotated, that the per-session dismiss really does reappear on a fresh reload, and the user's own design for the screen, which hasn't been started.

### 21. Do the PIN screens still summon the iOS keyboard? — `owner: user`

`LockScreen` and `PinSetup` back their PIN dots with a screen-reader-only `<input>` that's clipped visually but stays real and focusable, so WebKit could raise the OS numeric keyboard over the app's own on-screen keypad. Both now carry `inputMode="none"`, the same fix used on the amount field, but whether iOS was actually raising the keyboard there in the first place is unconfirmed on-device. The check: on a real iPhone, open "Configurar PIN" from the profile sheet, and separately reach the unlock screen and tap the PIN dots — in both, does only the app's own keypad appear, with no second system keyboard sliding up over it?

### 24. Can the create-category modal be closed on iOS? — `owner: user` (deferred by the user)

On a real iPhone, the create-category modal took the full screen height and could not be closed. The user deferred fixing it directly, on the suspicion it's the same root cause as the keyboard/viewport clipping items above (17/20) rather than a separate bug, and asked to check whether those fixes resolve it for free without a redesign of that modal. The check: on a real iPhone, open the category picker and tap to create a new category — does the modal now close (backdrop tap, an explicit close control, or however it's meant to dismiss)?
