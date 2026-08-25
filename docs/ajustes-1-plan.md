# Ajustes 1 — operator plan

Not a wave. A batch of **adjustments from the first real manual pass on a
phone** (user, 2026-08-24). The wave plan (`docs/waves.md`) is explicitly
paused for this batch at the user's request — Wave 5 and everything queued
after Wave 4.1 stays where it is.

`docs/waves.md` keeps the shape of the waves; this file is the execution view
of this batch; `specs.md` outranks both on behavior.

Baseline, measured on `main` at `b526b57` before dispatch: `bun run check`
green — 145 test files, 1563 tests, 2 pre-existing `react/only-export-components`
warnings (`button.tsx`, `FirstSyncGate.tsx`), which are warnings, not errors.

## 1. What the user found, and what it actually was

Every item traced to a cause in the code before any track was written. None of
these was found by a review pass; all six came from one person holding the app.

| #   | Report                                               | Cause, traced                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | pinch/double-tap zoom works and should not           | `index.html` viewport has no `maximum-scale`/`user-scalable`; no `touch-action: manipulation` anywhere                                                                                                                                          |
| 2   | the welcome screen scrolls, once                     | `WelcomeScreen` is `min-h-dvh` with a tall action stack (Google + `my-6` divider + guest + reassurance + legal); on a ~360–430px-wide phone the content exceeds the viewport and the body scrolls                                               |
| 3   | every screen starts at a different height            | Home `pt-2` (8px) · Search `pt-6` (24px) · History `pt-14` (56px) · Settings `pt-14`. **No shared token, no shared header component.** Home also sits at the very top edge because `body`'s `env(safe-area-inset-top)` is `0` in browser chrome |
| 4   | the sheet's grab handle scrolls away                 | `BottomSheet.tsx` puts the grabber **inside** the panel's own `overflow-y-auto` box. Native sheets keep it as fixed chrome                                                                                                                      |
| 5   | Add Movement does not look like the design           | The code implements `specs.md` §10.23's UI section faithfully. **The spec is what diverged** — see §3 below                                                                                                                                     |
| 6   | "Usar otra cuenta" is redundant on the return screen | Worse: in `ReturningUserScreen.tsx` both buttons call the same `login()`. It is the same button twice. That screen also offers no guest path at all                                                                                             |

## 2. Staging

| Stage | Tracks           | Why                                                                                                                                                          |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | AJ-A, AJ-B, AJ-D | Disjoint writable sets (§4 proves it). AJ-D is small but owns the locale files, which AJ-C needs later                                                       |
| **2** | AJ-C             | Consumes `BottomSheet` (AJ-B rewrites its chrome) and the locale files (AJ-D's in stage 1). Running it alongside either puts two writers on the same surface |

Stage 2 opens only when every stage-1 track has merged **and** passed its own
review pass (`AGENTS.md` § Review protocol), not merely merged.

## 3. Item 5 is a spec defect, not a UI defect — and it says something about the process

`specs.md` §10.23 was written 2026-08-20 from prose. The design export was
versioned the _same day_, and its Add-sheet artboard was never compared to the
spec section that claims to describe the same screen. The code then implemented
the spec correctly, and every review since agreed with the code — because a
track-scoped reviewer checks code against spec, and the spec was the wrong
thing.

The artboard is now extracted verbatim to
[`docs/ui/design-export-add-sheet.md`](ui/design-export-add-sheet.md), together
with why a marker-based search of the export missed it (it is the one artboard
introduced by a bare `<!-- add sheet -->` comment instead of the
`<!-- ===== NAME ===== -->` banner every other one uses).

**The finding worth more than the bug:** a versioned design export that is never
diffed against the spec sections describing the same screens is decoration.
Sixteen further artboards are in that position right now. Filed to `specs.md`
§12 by AJ-C — not fixed in this batch, because sixteen diffs is its own piece of
work and the user asked for adjustments.

## 4. File ownership, and the conflict hunt

`AGENTS.md` asks for the file **no track owns that two will both want**. Run
deliberately; three real collisions were found and resolved before dispatch:

| Contested file                | Wanted by                                                                                             | Resolution                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/index.css`        | AJ-A (spacing token, `touch-action`) and AJ-B (sheet chrome)                                          | **AJ-A owns it outright.** AJ-B consumes tokens and escalates to the operator if it needs a new one — it does not add one itself                   |
| `src/lib/i18n/locales/*.json` | AJ-A (welcome copy, if the scroll fix needs it), AJ-D (`auth` namespace), AJ-C (`movimientos`/`tags`) | **AJ-D owns them in stage 1; AJ-C owns them in stage 2.** AJ-A must not change copy — if its fix requires a wording change, it stops and escalates |
| `src/features/auth/**`        | AJ-A (`WelcomeScreen.tsx`) and AJ-D (`ReturningUserScreen.tsx`)                                       | Split by file, not by folder. Neither may touch the other's                                                                                        |

### Track AJ-A — the shell standard (items 1, 2, 3)

- `index.html` (viewport)
- `src/styles/index.css` — the screen-chrome token and `touch-action`
- `src/routes/Home.tsx`, `src/features/history/HistoryScreen.tsx`,
  `src/features/search/SearchScreen.tsx`,
  `src/features/settings/SettingsScreen.tsx`,
  `src/features/boot/PreContentSkeleton.tsx` (it mirrors Home's geometry and
  will visibly drift if left behind)
- `src/features/auth/WelcomeScreen.tsx` **only**
- A new shared screen-header primitive under `src/components/shared/**` if it
  decides one is warranted; **no edits to existing shared files**
- `specs.md` §10.34 (append-only), `docs/ui/design-tokens.md`

### Track AJ-B — sheet chrome (item 4)

- `src/components/shared/BottomSheet.tsx` + its test
- `src/features/profile/ProfileSheet.tsx` + its test
- `src/components/shared/README.md`
- `specs.md` §10.35 (append-only)
- **Read-only:** `useOverlay.ts`, `CenterModal.tsx`, `index.css`

### Track AJ-D — the return screen's second action (item 6)

- `src/features/auth/ReturningUserScreen.tsx` + its test **only**
- `src/lib/i18n/locales/*.json` — `auth` namespace only
- `src/features/auth/README.md`
- `specs.md` §10.36 (append-only)

### Track AJ-C — the Add sheet (item 5), stage 2

- `src/features/movimientos/**`
- `src/features/tags/**`
- `src/lib/i18n/locales/*.json`
- `specs.md` §10.37 (append-only, superseding §10.23's UI section) and §12
- **Read-only:** `BottomSheet.tsx`, `dataStore.ts`, `amountFormat.ts`,
  `schema.ts`, `AppShell.tsx`

## 5. Status

| Track | Branch                | Stage | Status             |
| ----- | --------------------- | ----- | ------------------ |
| AJ-A  | `aj-a-shell-standard` | 1     | dispatched         |
| AJ-B  | `aj-b-sheet-chrome`   | 1     | dispatched         |
| AJ-D  | `aj-d-return-action`  | 1     | dispatched         |
| AJ-C  | `aj-c-add-sheet`      | 2     | blocked on stage 1 |

## 6. Still the user's, not any agent's

Unchanged by this batch, carried from `docs/pendientes-usuario.md`: the real-Drive
folder check (item 4), the first-download view (item 5), the four new screens in
light plus `#f72121`/`#af7809` (item 10), and the guest cliff end-to-end (item 6).
Item 3 was answered 2026-08-24: **both artboards stay, frozen** — their viability
gets looked at once everything else is built, not now.

## 7. Routed mid-batch

**The `FullScreenPanel` twin.** AJ-B's shape sweep found that
`src/features/lock/FullScreenPanel.tsx` carries the identical defect it was
fixing: the panel is the `overflow-y-auto` box and its consumers
(`LockSettings`, PIN setup) render their header row as that box's first child,
so scrolling those panels scrolls their header away. Confirmed by the operator
by reading the file.

It was read-only for AJ-B, correctly — it did not widen its own scope. Routed
to **AJ-B's review pass**, which owns it now, with an explicit instruction to
decide the right shape for a full-screen panel with a real header rather than
copy AJ-B's grabber split.

Its `pt-[max(1.5rem,env(safe-area-inset-top))]` is a candidate for whatever
token AJ-A lands. Deliberately **not** reconciled inside either track — that
belongs to the cross-track pass, or the two of them race on the same value.

## 8. Two items added mid-batch by the user (2026-08-24)

### AJ-E — the returning screen's second action, take two

Track AJ-D removed the redundant button and rejected "continue as guest" on
§10.21's own prohibition. **The user overruled that, with information AJ-D did
not have:** Google's sign-in already opens the account chooser by default, so a
"use another account" button really is redundant — what belongs in that slot is
an escape hatch for someone who does not want to sign in again, behind a modal
that says plainly that the account's data will not be there in guest mode.

`specs.md` outranks the code; it does not outrank the person who wrote it. So
§10.21's prohibition is **amended in an append-only §10.37**, not circumvented.

The risk the track was told to find before writing any copy: this screen only
renders for a device holding a Google profile with real data, and guest mode is
a separate database (§10.15) that §10.33 makes persistent. If the way back —
the profile switcher (§10.31) — is not reachable or not discoverable, the button
strands people and no modal wording fixes that.

### AJ-F — "Olvidé mi PIN" describes a deletion that does not happen

Raised by the user as a wording complaint: the dialog talks about deleting data
and it frightens them. **Traced by the operator, and the copy is not merely
scary — it appears to be false.** Current `es` copy:

> title: "¿Restablecer el acceso?"
> description: "Sin el PIN no podemos abrir los datos de este dispositivo: **se
> van a borrar** y vas a tener que iniciar sesión de nuevo."
> confirm: "**Borrar y salir**"

What the code actually does, read end to end:

- `LockScreen.confirmForgot` → `lockStore.reset()` → `resetVault()` +
  `authStore.logout()`.
- `resetVault()` (`src/lib/pinLock.ts`) deletes the **token vault row**, the
  "has logged in before" marker and the persisted Drive decision. Nothing else.
- `logout()` (`src/lib/authStore.ts`) resets in-memory auth state, clears the
  Drive decision, invalidates the vault and the boot state. **It touches no
  financial data.**
- The movements live in the profile's own Dexie database (§10.15) and survive.

There is also a second false claim in the same sentence: "sin el PIN no podemos
abrir los datos" implies the local data is encrypted at rest. **It is not** —
§10.2 put encrypting the local financial cache explicitly out of scope, and the
PIN wraps the cached _token_, not the data. This is recorded in
`docs/pendientes-usuario.md` item 9's closing note.

So the honest fix is not gentler wording, it is **true** wording — which happens
to be shorter and less frightening, which is what the user wanted. The track
must also verify the claim in the other direction before writing anything: does
signing back in with the same Google account actually return the person to the
same profile and its data (§10.15/§10.31)? If it does not, the current copy is
accidentally right and the _behaviour_ is the bug.

**Blocked** until AJ-B's review pass releases `src/features/lock/**`, which it
currently holds for the `FullScreenPanel` fix.

## 9. AJ-G — the sweep AJ-A found and was right not to take

AJ-A root-caused the welcome screen's scroll and the cause was not the copy
stack: `min-h-dvh` on a root that sits **in normal flow inside a `body` already
padded by `env(safe-area-inset-*)`** demands the full raw viewport regardless of
what that padding already spent, so the page overflows by exactly the inset.

**Zero in a desktop browser or DevTools emulation. Non-zero on any real notch or
home indicator.** That is why it survived every review and every manual pass —
including the user's own, which was done in a browser on a PC.

Reproduced, not inferred: injecting a simulated `body { padding-top: 47px }` in a
running browser overflowed by precisely that amount, and `min-h-full` (which
resolves against the real `html`/`body`/`#root` chain, all `height: 100%`)
removed it.

**`src/routes/AppShell.tsx` has it** — reproduced on the real Home screen, where
the whole shell including `BottomNav` scrolled as one unit. Eight more files
share the shape: `AppErrorBoundary.tsx`, `RouteErrorFallback.tsx`,
`boot/BootErrorScreen.tsx`, `auth/DrivePermissionScreen.tsx`,
`auth/ReturningUserScreen.tsx`, `lock/LockScreen.tsx` (both branches),
`sync/DriveDownloadScreen.tsx`, `components/shared/ScreenLoading.tsx`.
`FullScreenPanel.tsx` is exempt — it is `fixed`/portaled, so it never sat in
that padded content box.

**One track, one owner, deliberately.** The obvious shortcut is to let each
in-flight track fix the instance in its own files — AJ-E owns
`ReturningUserScreen.tsx`, AJ-F owns `lock/**`, and so on. That is precisely
the split that leaves a twin unfixed, which `AGENTS.md` names as this project's
most expensive lesson. Both review passes were told explicitly not to touch it.

Queued behind AJ-F, which currently holds `src/features/lock/**`.

## 10. AJ-H — the confirm button says danger for things that are not dangerous

Escalated by AJ-E's review pass, which correctly declined to fix it: both
changes reach outside a review's ownership.

**`ConfirmDialog.tsx:53` hardcodes `variant="destructive"`.** Every confirm
dialog in the app therefore renders a red danger action. Today that includes
two flows this batch has just spent its effort proving destroy nothing:

- the guest confirmation (§10.37) — reversible, rebinds a profile pointer;
- **"Olvidé mi PIN" (§10.38)** — where the whole point of the rewrite was that
  the old copy promised a deletion the code never performs. The words were
  fixed and the button is still painted like a delete.

That is the same defect one layer down, and it undercuts the fix the user
actually asked for. Seven consumers today: `IdentitySection` (sign-out),
`MovimientoSheet` (delete — genuinely destructive), `ProfilesSection`,
`LockScreen`, `ReturningUserScreen`, `CategoriesSection` (archive), and the
`/kit` demo. Some of those _are_ destructive; the point is that the component
does not let the caller say which, so honesty is impossible by construction.

**Second escalation: the guest button's classes are byte-identical** between
`WelcomeScreen.tsx` and `ReturningUserScreen.tsx`. This directory already set
the precedent by extracting `GoogleSignInButton.tsx` for the primary CTA. Two
hand-maintained copies of one control is the shape this project's most
valuable review findings have taken.

Blocked until AJ-A's review pass releases `WelcomeScreen.tsx`.

## 11. Batch closed — 2026-08-25

Eleven tracks, each with its own review pass, plus the cross-track pass
`AGENTS.md` § Review protocol item 6 requires. `main` green at every merge;
final state **152 test files, 1618 tests**, with the same two pre-existing
`react/only-export-components` warnings the batch started with.

Beyond AJ-A through AJ-J: **AJ-I** (a storage read failure that could talk a
person into deleting a live profile) and the final cross-track pass, neither
of which was in the original plan. Both came from a review escalating
something outside its own scope.

### The number worth keeping

**Four of the batch's five most serious defects were found by a track doing
something else.**

- AJ-A found `AppShell`'s safe-area overflow while standardising top margins.
- AJ-B found the identical shape in the lock panels while fixing a grab handle.
- AJ-E's review found `ConfirmDialog` painting harmless actions as deletes.
- AJ-H's review found `readOwnerMarker`'s conflation, the one that could cost
  a profile.
- And AJ-J, sent to pick between two CSS values, found that the shell's middle
  pane had never scrolled independently at all — the file's own comment had
  claimed it did since the day it was written.

None of these was in any brief. What they have in common is that each lives in
a **seam**: between a stylesheet and a component, between a component and its
twin in another folder, between a lib function and the UI that acts on its
return value. A reviewer scoped to one track cannot see a seam by
construction, and neither can a test suite that was written against the same
misunderstanding as the code.

The practical consequence, and it is the batch's main process finding: **the
per-track review protocol is necessary and is not sufficient.** The cross-track
pass is not a formality at the end — in this batch it found a fifth instance
(`PreContentSkeleton`) of a shape a track had just fixed, and corrected two
claims earlier commits had made about their own completeness.

### Still the user's, and unchanged by any of this

`docs/pendientes-usuario.md` items 4, 5, 6, 8, 10, 11 and the new 12 (what the
Add sheet's gear button should do). Two things this batch changed **cannot be
verified on a desktop at all** — the URL-bar transition and the software
keyboard against the new fixed-height shell. Chromium on a laptop cannot show
either; they need a real phone.
