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
