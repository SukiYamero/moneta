# Ajustes 3 — operator plan

Third batch from a real phone pass (user, 2026-08-25, **iOS**). `docs/waves.md`
stays paused; `specs.md` outranks this file on behavior.

Baseline on `main` at `47f3a7d`: `bun run check` exit 0 — 152 files, 1652
tests, the 2 known `react/only-export-components` warnings
(`src/components/ui/button.tsx:74`, `src/features/sync/FirstSyncGate.tsx:79`).
Those are pre-existing warnings. **No track fixes them.**

---

## 1. The organizing constraint: the user is redesigning the Add sheet

Stated directly: _"vamos a tener que rediseñar ese slide de crear porque
necesitamos espacio y organizar secciones… yo ya lo estoy trabajando en el
design."_

So the question this batch answers is not "what is broken" — it is **what is
worth fixing before a redesign lands that will move things around anyway.**

The line that separates them is **layout vs. behavior**:

- **Layout** — where the type toggle sits, how sections are grouped, what the
  sheet's visual order is. **The user owns this. No track touches it.**
- **Behavior and shell** — whether a button tells you why it did nothing,
  whether the keyboard covering half the screen is handled at all, whether a
  calendar jumps a row between months, whether a dead component still exists.
  **None of these change meaning when the layout is redrawn.** They are the
  work that survives the redesign.

Every track below is on the behavior side of that line. If a track finds
itself wanting to move, regroup or restyle the Add sheet's contents, it has
crossed into the user's work and must stop and escalate.

---

## 2. What the user reported, and what each one is

| #   | Report (verbatim intent)                                                                                         | Traced                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The keyboard rises correctly and focus lands** — `pendientes-usuario.md` #13                                   | **CONFIRMED by the user on iOS.** Ajustes 2's fix works. That item closes only when the user says so, but they said so                                                                                                                              |
| 2   | Opening the sheet scrolls down and hides the gasto/ingreso toggle; you must dismiss the keyboard and scroll back | The sheet is `fixed` inside a scroll-locked body. iOS auto-scrolls a focused input into view against the **layout** viewport, which the keyboard does not shrink — so the scroll lands on the page and drags the sheet's top out of sight           |
| 3   | Can't add: tap the Add button and nothing happens                                                                | **Hypothesis, not a conclusion.** `useMovimientoForm.submit` returns silently when no category is picked, and the only feedback is an inline message rendered _below_ the amount — off-screen behind the keyboard, given item 2. Must be reproduced |
| 4   | The calendar looks ugly — "is it the library's?"                                                                 | **It is ours.** `DateChipPicker.tsx` is hand-rolled markup; `date-fns` supplies date math only. Nothing to fight, nothing to override                                                                                                               |
| 5   | Some months push the content down a little                                                                       | **CONFIRMED by reading.** `eachDayOfInterval(startOfWeek(startOfMonth) → endOfWeek(endOfMonth))` yields 28/35/42 cells depending on the month, and the grid renders exactly what it gets. A 6-week month is one row taller                          |
| 6   | `AmountField` should go — one amount input only                                                                  | **Decided by the user.** Cross-track review confirmed zero production call sites (`specs.md` §10.47)                                                                                                                                                |

---

## 3. Deferred by the user, recorded so they are not lost

- **The create-category modal on iOS** — takes the full height, and the user
  _could not close it_. Their words: "solo para tenerlo en cuenta, luego vamos
  con ello". **Deferred by their decision, and the operator's concern is
  recorded rather than argued:** being unable to leave a modal is severe, not
  cosmetic. It is deferred anyway for one substantive reason beyond the user's
  call — it is very likely **the same root cause as item 2**, not a separate
  bug. `CenterModal` and `BottomSheet` share `useOverlay`; a modal whose close
  control sits below a keyboard-shrunk viewport is item 2 wearing a different
  shell. Track AJ3-B is told to check whether its fix resolves this for free,
  and to report the answer either way — **without redesigning that modal.**
- **Category features** — "algunas cosas no funcionan y necesitamos ajustar
  otras". Explicitly after this batch. No track touches `src/features/tags/**`.
- **The Add sheet's layout and sections** — the user's redesign, in progress.

---

## 4. Tracks

Three, **all stage 1, in parallel**. §5 proves the writable sets are disjoint.

### Track AJ3-A — the button that does nothing, and the dead input

**Goal.** A tap on the commit action either creates the movement or tells the
user, where they can see it, why it did not.

**Done when**

- **You have reproduced item 3 before fixing anything.** The plan's hypothesis
  is that the guard in `useMovimientoForm.submit` returns silently when
  `categoriaId` is undefined. Note that `AddMovimientoSheet.test.tsx` already
  has a passing end-to-end test that saves a movement with a category picked —
  so whatever is wrong is **not** "submit is broken", and a fix that does not
  explain that passing test is the wrong fix. **If the real cause is something
  else, say so; the hypothesis is the operator's reasoning, not a finding.**
- The failure is visible **wherever the user is looking when they tap**, not
  only at a fixed place in the sheet's flow. What "visible" means here is a
  behavior decision, and the shapes available (a toast, scrolling the offending
  field into view, disabling the action with a reason) differ in how much they
  presume about layout. **Prefer whatever survives the user's redesign
  untouched** — a fix that depends on the current field order will be wrong in
  a week. Pick one, justify it, and **do not restructure the sheet to make room
  for it.**
- Whatever you choose is reachable without hover and meets the ≥44px rule.
- `AmountField` is deleted: the component, its test, its barrel export in
  `src/components/shared/index.ts`, its `Kit.tsx` demo, and every doc line that
  describes it as if it were in use. **Sweep for stragglers** — grep before
  declaring it gone, and report what the sweep found including "nothing else".
  Confirm `parseAmountForInput`/`formatAmountForInput`/`isAmountInputInvalid`
  keep every caller they still have; deleting the component must not orphan
  the parser it shares with `MovimientoAmountInput`.

**Writable:** `src/features/movimientos/useMovimientoForm.ts` + test,
`src/features/movimientos/AddMovimientoSheet.tsx` + test,
`src/features/movimientos/MovimientoFormFields.tsx`,
`src/features/movimientos/MovimientoSheet.tsx` + test,
`src/components/shared/AmountField.tsx` + test (**to delete**),
`src/components/shared/index.ts`, `src/routes/Kit.tsx`,
`src/features/movimientos/README.md`, `src/components/shared/README.md`,
`src/lib/i18n/README.md`, `src/lib/i18n/locales/*.json` (new copy only if the
fix needs it), `specs.md` §10.48 (append-only) + §11 + §12.

**Read-only:** `BottomSheet.tsx`, `CenterModal.tsx`, `useOverlay.ts`,
`DateChipPicker.tsx`, `index.html`, `src/styles/index.css`,
`src/lib/i18n/amountFormat.ts`, `src/features/tags/**`, `dataStore.ts`.

### Track AJ3-B — the keyboard/viewport contract

**Goal.** When the software keyboard is up, an overlay stays inside the space
the user can actually see, on iOS Safari, on Android Chrome, and installed.

**Done when**

- You have **established what actually happens** before changing anything.
  Relevant facts, each of which you verify rather than take from me: the
  viewport meta in `index.html` currently has no `interactive-widget`
  descriptor; `window.visualViewport` is the only cross-browser way to learn
  the keyboard's real inset; iOS Safari shrinks the **visual** viewport but not
  the **layout** viewport, so `dvh` does not react to the keyboard there; the
  body is scroll-locked by `useOverlay` while an overlay is open, which is
  precisely why iOS's scroll-focused-input-into-view behaviour drags the
  sheet instead of scrolling content inside it.
- Overlays (`BottomSheet` **and** `CenterModal` — same `useOverlay`, same
  problem) are sized and positioned against the space above the keyboard, not
  the full layout viewport. The mechanism is yours to choose; if you expose the
  inset as a CSS custom property, **the token belongs in
  `src/styles/index.css`, which is operator-owned — escalate for it, do not add
  it yourself.**
- **`prefers-reduced-motion` is respected** and no new easing is hand-rolled —
  `AGENTS.md` § UI. A viewport-driven resize must not fight
  `--animate-sheet-up`.
- **Report explicitly what changes and what does not in each of the three
  contexts** the user asked about, because they asked a product question, not
  just a bug question: mobile browser with chrome bars, installed PWA
  (`display: 'standalone'`, already configured in `vite.config.ts`), and a Play
  Store TWA wrapping that PWA. Say plainly which part of the problem installing
  solves for free and which part it does not — **do not let "it'll be fine in
  the app" stand in for a fix**, since the user has said the web path must work
  too.
- **Check whether this fixes the deferred create-category modal** (§3) and
  report the answer. Do not redesign that modal either way.
- **You do not touch the Add sheet's contents.** Your surface is the shell.

**Writable:** `index.html`, `src/components/shared/BottomSheet.tsx` + test,
`src/components/shared/CenterModal.tsx` + test,
`src/components/shared/useOverlay.ts` + test, a new hook/util under
`src/components/shared/**` or `src/lib/**` if one is warranted (`src/lib/` may
not import from `@/components` or `@/features` — `AGENTS.md`),
`src/components/shared/README.md` is **AJ3-A's** — hand your line to the
operator, `specs.md` §10.49 (append-only) + §11.

**Read-only:** everything under `src/features/**`, `src/styles/index.css`
(escalate for a token), `vite.config.ts`, `src/routes/**`.

### Track AJ3-C — the calendar

**Goal.** The month grid stops changing height, and stops looking like a
placeholder.

**Done when**

- **The row-count jump is gone.** A grid that renders 28, 35 or 42 cells
  depending on the month is the cause (§2 item 5) — the fix is a constant
  number of week rows, but you decide which and justify it against what a
  native date picker does. Cover it with a test that would fail today: pick two
  real months with different week counts and assert the rendered cell count is
  the same.
- The picker reads as deliberate rather than unstyled. **Constraints, not
  suggestions:** every value comes from a token in `src/styles/index.css`
  (which you may **read only** — escalate if you need a new one), no arbitrary
  px (`bun run lint:units` fails on them), touch targets ≥44px, no
  hover-only affordance, `lucide-react` icons, and the `--ease-ios`/`animate-*`
  tokens for any transition.
- Its two hardcoded Spanish `aria-label`s (`"Selector de fecha"`, `"Mes
anterior"`, `"Mes siguiente"`) go through `src/lib/i18n` like the rest of the
  app, unless you find a recorded reason they were left out — check before
  assuming it was an oversight.
- **You change how the picker looks and how tall it is. You do not change
  where it sits in the Add sheet** — that is the user's redesign. If you
  believe the chip belongs somewhere else, say so in your report and leave it.

**Writable:** `src/components/shared/DateChipPicker.tsx` + test,
`src/lib/i18n/locales/*.json` (the picker's own a11y strings only),
`src/lib/i18n/README.md` is **AJ3-A's** — hand your line to the operator,
`specs.md` §10.50 (append-only) + §11.

**Read-only:** `MovimientoFormFields.tsx`, `src/styles/index.css`, `Kit.tsx`,
everything else.

---

## 5. The conflict hunt

`AGENTS.md` asks for the file **no track owns that two will both want**:

| Contested                             | Wanted by                                                    | Resolution                                                                                            |
| ------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/routes/Kit.tsx`                  | AJ3-A (delete the `AmountField` demo), AJ3-C (calendar demo) | **AJ3-A owns it.** AJ3-C hands any kit change to the operator                                         |
| `src/components/shared/README.md`     | AJ3-A (AmountField gone), AJ3-B (overlay behavior)           | **AJ3-A owns it.** AJ3-B hands its line over                                                          |
| `src/lib/i18n/locales/*.json`         | AJ3-A (error copy), AJ3-C (picker a11y strings)              | **Split by namespace, and each track edits only its own keys.** Collision on one key ⇒ stop, escalate |
| `src/lib/i18n/README.md`              | AJ3-A, AJ3-C                                                 | **AJ3-A owns it.** AJ3-C hands its line over                                                          |
| `src/styles/index.css`                | AJ3-B (keyboard inset), AJ3-C (any new token)                | **Operator-owned.** Both escalate; neither adds a token                                               |
| `src/components/shared/useOverlay.ts` | AJ3-B only                                                   | AJ3-A and AJ3-C are read-only on it — it was rewritten last batch, do not churn it twice              |
| `MovimientoFormFields.tsx`            | AJ3-A (feedback), AJ3-C renders inside it                    | **AJ3-A owns the file.** AJ3-C's change reaches it through `DateChipPicker`, without editing it       |
| `specs.md`                            | all three                                                    | Append-only, distinct sections: AJ3-A §10.48, AJ3-B §10.49, AJ3-C §10.50                              |

---

## 6. Rules all three are held to

Beyond `AGENTS.md`, binding in full:

- **Reproduce before you fix.** Item 3 especially: a fix for a cause you did
  not observe is a guess wearing a commit message.
- **Question the framing.** §2 is the operator's tracing and can be wrong. Two
  of the last batch's four review findings were a track's own confidently-
  written claim being disproved by reproduction — see the §11 entry on that
  pattern before writing "this is safe because" into `specs.md`. **A true
  general principle is not evidence that this instance meets its
  precondition.**
- **Layout is the user's.** Restated because it is the one rule that makes this
  batch coherent.
- **`bun run check` green, real output reported.** Never a claimed pass.
- **No padding.** Say plainly when something is fine.

## 7. Status

| Track | Branch               | Stage | Status |
| ----- | -------------------- | ----- | ------ |
| AJ3-A | `aj3-a-add-feedback` | 1     | —      |
| AJ3-B | `aj3-b-keyboard-vp`  | 1     | —      |
| AJ3-C | `aj3-c-calendar`     | 1     | —      |

Per-track review after each merges; cross-track pass at the end
(`AGENTS.md` § Review protocol).

## 8. Still the user's

`docs/pendientes-usuario.md`, unchanged except #13, which **the user confirmed
on iOS in this pass** (the keyboard rises, focus lands). Still open: the real-
Drive find-before-create check, the three light-mode items, the first-run
download view, the guest-cliff flow, the brand mark, where biometrics live,
the Add sheet's gear button, and #14 (IME typing an amount).
