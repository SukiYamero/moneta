# Open items that need the user, not an agent

Things only the user can do — design work in the Claude Design canvas, decisions nobody else can make, and verification that needs a human in a browser.

**How this file works, and it is binding on every agent:**

1. **At the start of a session, read this file and ask about every open item.** Ask concretely — "did you get to the PIN unlock screen?" — not "any updates?"
2. **Never mark an item done on your own.** An item is closed only when the user says so. If they don't answer, it stays open and gets asked again next session. Silence is not confirmation.
3. When an item closes, move it to **Closed** at the bottom, so the record survives and nobody re-raises it.
4. Add an item here the moment something turns out to need the user — do not let it live only in a conversation that ends.

---

## Open

### 31. Is "welcome back" on every reload without a PIN the right trade-off? — `owner: user`

Without a PIN/biometric lock configured, `authStore` never persists a session across a reload — `restore()` deliberately never attempts a silent Google re-auth, since GIS's silent mode can pop a visible window under iOS WebKit's third-party-cookie blocking. The only path that survives a reload without re-tapping is having PIN/biometric lock enabled, which caches an encrypted token. The decision needed: keep this as-is (push people toward PIN for persistence), or look for a middle ground — accept it as intentional, or want it revisited.

### 30. Clear stored data before the new category model runs — `owner: user`

`SCHEMA_VERSION` goes to 2 with the category-experience work and no migration is registered, so the app throws `schema_mismatch` against anything already stored. Nothing is lost that matters — there are no users and the data is test data — but the app will not boot until the old data is gone, and stale Drive data would otherwise pull the old taxonomy straight back over the new seed. Three steps, all of them the user's: (1) in the browser's DevTools, Application → Storage → **Clear site data** for the dev origin, which removes the `kurobello`, `kurobello-<profile>` and `kurobello-device` IndexedDB databases and the service-worker cache — do it for every origin the app has been opened on, including the HTTPS dev origin used from the phone; (2) on `drive.google.com`, delete the **`KuroBello`** folder and empty the trash; (3) on `drive.google.com` → Settings → **Manage apps** → the app → Options → **Delete hidden app data**, which is the only way to reach the `appDataFolder` holding `config-<device>.json` — it is invisible in the normal Drive UI. The check afterwards: open the app, get through onboarding, and confirm the category sheet shows the seeded catalog and not five old categories.

### 27. `dvh` never recovers in the installed PWA on iOS — `owner: user`

Measured on a real iPhone in an installed PWA: `100dvh` reads 852 before the first keyboard, 793 after it, and stays 793 for the rest of the session — `window.innerHeight` and `visualViewport.height` drift with it. It is a WebKit bug with no web-side fix, and it means `max-h-[88dvh]` on both overlay shells silently resolves ~7% short once any field has been focused. Not visible in a Safari tab, only in the installed app. Moot once the native migration (`docs/tasks/native-kmp-migration.md`) ships its iOS app — the web build stops being a real target at that point, and a native app has no `dvh` at all.

### 29. The AutoFill bar overlapping the sheet bottom — `owner: user`

With the keyboard up, iOS floats its AutoFill bar (key/card/location, ~20–44px depending on whether QuickType is collapsed) over the bottom of the sheet. `visualViewport.height` does not subtract it and no CSS `env()` or web API exposes its height, so the only web-side option is reserving a fixed bottom buffer that is wrong on some devices. Deliberately not compensated for. Moot once the native migration (`docs/tasks/native-kmp-migration.md`) ships its iOS app — a native text field has no AutoFill bar to float over the sheet.

### 25. Does the iOS picker wheel close the calendar? — `owner: user`

The date picker's caption is now a month dropdown and a year dropdown, the only native `<select>`s in the app. On iOS a `<select>` raises the OS picker wheel — a third layer above the popover, which is itself above a `BottomSheet`. The app's own overlay bookkeeping is safe (`useOverlay.ts` binds nothing to focus events, so it is simply inert while that layer is up), but Radix's `DismissableLayer` dismisses on focus activity it judges to be outside the popover, and WebKit has raised a `blur` before immediately refocusing a `<select>` in some versions. If it does that here, the calendar closes mid-selection. No agent can verify this. The check: open the calendar from the date chip, tap the month or the year to raise the wheel, spin it and pick a different value — does the calendar stay open and move to that month/year, or does it close by itself?

### 10. Look at the new screens on light — `owner: user`

Two things still haven't been seen on the light theme: the returning-user screen (only renders after a session lapses, so it wasn't on the path the user already walked), and the PIN-entry lock screen (as opposed to PIN setup, which was seen).

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

### 11. Where the biometric option lives, and how it is presented — `owner: user`

The biometric unlock mechanism itself works end to end (confirmed) — the complaint is about where the toggle sits and how it's shown in the UI, with no more specific feedback given yet. The design export has no biometric UI anywhere to fall back on, so the current placement was built without a reference. Ask what specifically looked wrong about the placement/presentation before any track touches it.

### 17. Is the background above the keyboard gone? — `owner: user`

With the Add sheet open and keyboard up, a strip of undimmed app background (with the `+` FAB and tab icons visible) used to show above the keyboard instead of a dimmed backdrop. Fixed twice over (the backdrop now overscans past the visible area on every edge, and the bottom nav hides entirely while any overlay is open) and confirmed by regression test, but not on a real device. The check: on a real iPhone, open the Add sheet and raise the keyboard — is everything behind the sheet uniformly dimmed with no app background, `+`, or tab icons showing through, this time for good?

### 16. Does a blocked Add tap bring you to the field that blocked it? — `owner: user`

Tapping Add with the amount empty or no category picked now moves focus to whichever field blocked the save instead of just blurring — confirmed by unit test that focus lands correctly, but whether that focus change actually dismisses the iOS keyboard (standard documented WebKit behavior, not watched happen) is unconfirmed. The check on a real iPhone: leave the amount blank with no category picked, tap Add — does the keyboard go away and land you on the category picker? Then, with a category picked but an invalid amount, tap Add — does the keyboard stay up with the amount field focused and visible, not covered?

### 20. Is the band above the keyboard finally gone? — `owner: user`

Same symptom as item 17, reported a third time, traced to a real WebKit clipping bug (a `position: fixed` element painting at exactly `opacity: 1` gets clipped to the main viewport, missing the region behind the keyboard's accessory bar) — overlays now paint at `.99` to dodge it, plus a body-background dim as a structurally different fallback. The user partly answered: the amount field now uses the app's own keypad and no longer raises the OS keyboard, so that specific case is resolved — but the note field and the create-category name field are ordinary text inputs that still raise the OS keyboard, and those are what still need checking. The check: open the Add sheet, expand "Más detalles", tap into the note field — is the strip above the keyboard dimmed (no app background, `+`, or tab icons)?

### 19. Keeping the app in portrait — what actually locks, and the guard screen's design — `owner: user`

`screen.orientation.lock()` isn't called anywhere (it's fullscreen/Chromium-only and iOS Safari doesn't implement it), so a full-screen "rotate your phone" guard blocks the screen instead when no real OS-level lock is possible. The guard mounts above the router, ahead of the app shell, so it covers auth, the PIN lock, and `/settings` too — not just the three bottom-nav tabs. The user is designing this guard screen themselves (currently a placeholder); confirmed once that the gate appears/dismisses correctly on a real phone and that the dismiss is now per-session rather than sticking forever. Still open: whether the installed PWA (added to the home screen) actually stays in portrait when rotated, that the per-session dismiss really does reappear on a fresh reload, and the user's own design for the screen, which hasn't been started.

### 21. Do the PIN screens still summon the iOS keyboard? — `owner: user`

`LockScreen` and `PinSetup` back their PIN dots with a screen-reader-only `<input>` that's clipped visually but stays real and focusable, so WebKit could raise the OS numeric keyboard over the app's own on-screen keypad. Both now carry `inputMode="none"`, the same fix used on the amount field, but whether iOS was actually raising the keyboard there in the first place is unconfirmed on-device. The check: on a real iPhone, open "Configurar PIN" from the profile sheet, and separately reach the unlock screen and tap the PIN dots — in both, does only the app's own keypad appear, with no second system keyboard sliding up over it?

## Closed

### 32. Does the swipe/drag flick-and-exit feel native on a real phone?

Confirmed on a real iPhone: the flick-to-commit/dismiss and the exit animation feel right, and a diagonal swipe over the category icon picker pages cleanly without scrolling the modal underneath it.

### 18. Saving a category does not work

Cause: `CategoryFormModal.tsx:107` and `dataStore.ts:114` mint an id with `crypto.randomUUID()`, which is `undefined` outside a secure context — a plain `http://<lan-ip>:5173` dev session couldn't create a category or a movement at all. `bun run dev:https` (self-signed HTTPS) is the fix; no code change was needed. Confirmed working over `dev:https` on a real phone.

### 24. Create-category modal couldn't be closed on iOS

Same root cause as the keyboard/viewport clipping fixes (overlays painting at `.99` opacity to dodge the WebKit `position: fixed` clipping bug). Confirmed on a real iPhone: the modal now closes.

### 10 (partial). The two judgment-call colors on light theme

`#f72121` (rose) and `#af7809` (amber) confirmed acceptable on the light theme.

### 28. Native wrapper for the App Store

Decided: genuinely native, via Kotlin Multiplatform — not Capacitor. Distribution moves to the app stores as the only real target — desktop/mobile web becomes a landing page that redirects to the Play Store / App Store listings, not a usable copy of the app. Android ships first; iOS starts only once Android works. Full decision and rationale: `docs/tasks/native-kmp-migration.md`, tracked as backlog priority 2 in `specs.md` §11. Items 27 and 29 stay open until the iOS app actually ships.
