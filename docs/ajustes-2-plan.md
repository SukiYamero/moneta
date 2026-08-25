# Ajustes 2 — operator plan

Not a wave. The **second** batch of adjustments from a real manual pass on a
phone (user, 2026-08-25), taken after Ajustes 1 shipped. `docs/waves.md` stays
paused; `specs.md` outranks this file on behavior.

Baseline, measured on `main` at `8a143c1` before dispatch: `bun run check`
green — see §7 for the real output.

---

## 1. What the user confirmed fixed — do not touch these

Stated explicitly in the same pass. They are here so no track "improves" one of
them and silently regresses a thing the user already signed off:

| Ajustes 1 item                                              | User's verdict                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Top spacing / first-content offset (AJ-A, §10.34)           | "lo veo okay"                                                                                         |
| The Add sheet now matching the design export (AJ-C, §10.41) | "ahora sí se parece tal cual"                                                                         |
| Grab handle surviving scroll (AJ-B, §10.35)                 | correct, and the gap it keeps from the content reads native                                           |
| The native keyboard once it is open                         | "se despliega correctamente y se ve todo bien" — the URL-bar cramping is a browser artifact, not ours |

**One thing the user raised and then withdrew, recorded so nobody re-opens it
from the transcript:** the "box" around the amount input looking cramped. They
identified it themselves as the focus outline and dropped it. **No track acts
on it.** If a track believes the focus ring on a borderless display field is
still wrong, it escalates to the operator — it does not change it.

---

## 2. What is actually being asked, and what each one is in the code

Four items. Every one traced to the real code before this file was written.

| #   | Report                                                                  | Cause / target, traced                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tapping the `+` should focus the amount input and raise the keyboard    | `AddMovimientoSheet.tsx:69` **already** passes `initialFocus={amountInputRef}`, and `useOverlay.ts:135` does focus it — but inside a `requestAnimationFrame`, in a passive `useEffect`. Both steps leave the user-activation task, and iOS Safari only opens the software keyboard for a `.focus()` that happens **inside** it. So focus lands, the keyboard does not. |
| 2   | The amount input is not really centered — the `$` is being centered too | `MovimientoAmountInput.tsx:76` is `flex … justify-center gap-2` over `[symbol, input]`, so the row's centre falls between them and the digits sit right of centre by `(symbolWidth + gap) / 2`. The symbol size is **not** the problem — `--text-6xl` is `1.75rem`/28px in this project's remapped scale (`src/styles/index.css:139`), matching the export's 27px.     |
| 3   | The primary button's label is too small for its importance              | `Button size="touch"` inherits the cva base `text-sm font-medium` — and `--text-sm` is **12px** here, not 14px. `docs/ui/design-export-add-sheet.md` §2 draws that button as `height:54px; border-radius:18px; font-size:15.5px; font-weight:800`. **The export agrees with the user**; the code diverged.                                                             |
| 4   | Typed amounts show no locale grouping (`1000`, never `1.000` / `1,000`) | There is no formatter on the typing path at all. `parseAmountForInput` **reads** locale separators and `formatAmountForInput` **prefills** with them, but `amountRaw` is passed through verbatim on every keystroke — `MovimientoAmountInput.tsx:84` is a bare `onChange(event.target.value)`.                                                                         |

Items 1 and 3 are sheet/shell surface. Items 2 and 4 are both the amount
display. That is the split.

---

## 3. Tracks

Two tracks, **both stage 1, in parallel**. §4 proves their writable sets are
disjoint.

### Track AJ2-A — the amount display (items 2 and 4)

**Goal.** The number the user is typing is centered on its own and reads under
their locale's own grouping convention, live, with the caret staying where they
put it.

**Done when**

- The digits are optically centered in the sheet's content box. The currency
  symbol is **out of the centering flow**, sitting immediately to the left of
  the number — it must not shift the number's centre by its own width.
  - This is a **deliberate divergence from the design export**, which centers
    the `[symbol, number]` group as one (`justify-content:center; gap:8px`).
    The user asked for it directly, so it is settled, not a question — **record
    it in `specs.md` §11** with that framing so a later reader does not "fix"
    the code back to the artboard.
  - `field-sizing: content` means the input's width changes with every
    keystroke. Whatever technique you pick must keep the number's centre
    stable and must not let a long number collide with or overrun the symbol.
    The export bounds this with `max-width: calc(100% - 48px)`; today's code
    has `max-w-full`. Decide deliberately and say why.
- Typing produces the locale's grouping and decimal characters, from `Intl`,
  never a hand-rolled table — `specs.md` §10.14's "never a hand-rolled parser"
  applies to the formatter too. A locale that groups with `.`, one that groups
  with `,`, one that groups with a space, and one that does not group at all
  must all be right without a per-locale branch.
- **The caret does not jump.** Inserting a separator ahead of the caret must
  not send it to the end of the field. The known-good technique is to count the
  _digits_ before the caret, reformat, then place the caret after that same
  digit count — but you own the choice; what is not acceptable is shipping
  without covering it in a test.
- These stay typeable, and each needs a test: a trailing decimal separator
  mid-entry (`1,` on its way to `1,50`), a trailing zero in the fraction
  (`1,50` must not collapse to `1,5`), deleting a grouping separator,
  backspacing across one, and a paste.
- `parseAmountForInput` still parses whatever the field now holds — it already
  strips group separators, so verify the round-trip rather than assuming it.
- Edit-mode prefill (`formatAmountForInput`) and live typing must produce the
  **same** string for the same number. If they can differ, that is a bug.

**Judgement call this track owns, and must state its reasoning for.** Once you
sanitize input as it is typed, the `malformed` error reason becomes unreachable
from the keyboard (only paste or a programmatic set can still produce it).
Decide whether to sanitize or to let malformed text stand and surface the
error, check what `isAmountInputInvalid` and the existing tests assume, and
record the decision. Do **not** quietly delete an error path that other code
still depends on.

**Writable**

- `src/features/movimientos/MovimientoAmountInput.tsx` + its test
- `src/features/movimientos/MovimientoFormFields.tsx` — only if a prop change
  is genuinely needed; prefer keeping the change inside the input
- `src/lib/i18n/amountFormat.ts` + `amountFormat.test.ts`
- `src/features/movimientos/useMovimientoForm.ts` + its test — only if needed
- `src/features/movimientos/README.md`, `src/lib/i18n/README.md`
- `specs.md` §10.45 (append-only) and §11

**Read-only:** `AddMovimientoSheet.tsx`, `MovimientoSheet.tsx`,
`BottomSheet.tsx`, `useOverlay.ts`, `button.tsx`, `schema.ts`,
`src/styles/index.css`, the locale JSON files.

### Track AJ2-B — sheet entry and the primary CTA (items 1 and 3)

**Goal.** Tapping `+` puts the user on the keyboard, and the button that
commits the movement looks like the commitment it is.

**Done when**

- Opening the Add sheet from the FAB raises the software keyboard with the
  caret in the amount field, on a real phone.
  - **The hypothesis, which you must verify rather than accept:** iOS Safari
    grants `.focus()` a keyboard only inside the task that carries the user
    activation. `useOverlay`'s focus runs in a `requestAnimationFrame` inside a
    passive `useEffect` — two hops out of that task. Focusing synchronously
    (before paint, in the same task as the click) is the shape that normally
    fixes it. Check whether the ref is actually attached at that point; child
    refs commit before a parent's effects, but confirm it, do not assume.
  - If you conclude the hypothesis is wrong, **say so and say what the real
    constraint is** — a wrong fix that cannot be tested here is worse than an
    honest "this needs a different approach".
  - **You cannot verify this yourself.** No agent in this repo can open iOS
    Safari. Write the unit test that proves the _mechanism_ changed (focus
    happens synchronously, not deferred), state plainly that the keyboard
    itself is unverified, and hand the operator a one-line thing for the user
    to check on their phone.
- **Sweep the shape, not the instance.** `initialFocus` has three other
  consumers: `PinSetup.tsx`, `CategoryFormModal.tsx`, and `Kit.tsx`'s demo.
  Whatever you change in `useOverlay` changes all of them — for `PinSetup` that
  is very likely an improvement, for `CategoryFormModal` it is a keyboard
  appearing where one did not before. Enumerate every consumer, say what each
  one now does, and flag any you think is wrong rather than discovering it in a
  later session.
- Do **not** regress what `useOverlay` already gets right, and re-verify each:
  the nesting stack (only the topmost overlay claims focus), Escape, the
  Tab trap, the refcounted scroll lock, and focus restored to the trigger on
  close. The comment at `useOverlay.ts:180` explains why the effect's dep array
  is `[open]` alone — read it before touching the effect.
- The Add sheet's primary CTA matches `docs/ui/design-export-add-sheet.md` §2:
  54px tall, 18px radius, ~15.5px, weight 800. Every one of those already has a
  token — `h-13.5`, `rounded-2xl` (`--radius-2xl: 18px`), `--text-md` (15px),
  `font-extrabold`. **No arbitrary px** — `bun run lint:units` fails on one.
- **Sweep the shape here too.** `size="touch"` has 19 call sites across the app
  and is a _touch-target_ size, not "the sheet's primary CTA" — **do not change
  its typography globally.** But the edit sheet's save button
  (`MovimientoSheet.tsx`) is the same element in the same layout, and §10.41
  records that edit inherits the Add sheet's design. Decide whether it moves
  with this one, and justify it. If you conclude a shared variant is warranted
  rather than a per-call-site override, **stop and escalate to the operator** —
  do not edit `button.tsx` on your own judgement.

**Writable**

- `src/components/shared/useOverlay.ts` + its test
- `src/components/shared/BottomSheet.tsx` + its test
- `src/features/movimientos/AddMovimientoSheet.tsx` + its test
- `src/features/movimientos/MovimientoSheet.tsx` + its test
- `src/components/shared/README.md`
- `specs.md` §10.46 (append-only) and §11

**Read-only:** `MovimientoAmountInput.tsx`, `MovimientoFormFields.tsx`,
`amountFormat.ts`, `button.tsx` (escalate to write), `movimientoSheetStore.ts`,
`BottomNav.tsx`, `AppShell.tsx`, `src/styles/index.css`.

**Hand to the operator, do not write:** your line for
`src/features/movimientos/README.md` — AJ2-A owns that file. Per `AGENTS.md`
§ Review protocol 5, the operator applies it in the merge commit and verifies
it against the code as it then stands.

---

## 4. The conflict hunt

`AGENTS.md` asks for the file **no track owns that both will want**. Run
deliberately:

| Contested                                      | Wanted by                                                             | Resolution                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/features/movimientos/README.md`           | AJ2-A (the input) and AJ2-B (the sheet + CTA)                         | **AJ2-A owns it.** AJ2-B hands its line to the operator at merge                                                        |
| `src/features/movimientos/MovimientoSheet.tsx` | AJ2-B (CTA sweep); AJ2-A renders inside it via `MovimientoFormFields` | **AJ2-B owns the file.** AJ2-A's change reaches edit mode through the input component, without editing this file        |
| `src/components/ui/button.tsx`                 | AJ2-B only, and only if it argues for a shared variant                | **Operator-owned.** AJ2-B escalates; 19 call sites is not a track-scoped decision                                       |
| `src/styles/index.css`                         | both, if either wants a token                                         | **Operator-owned.** Every value both tracks need already has a token (§3); if one genuinely does not, stop and escalate |
| `src/lib/i18n/locales/*.json`                  | neither — no copy changes in this batch                               | **Operator-owned.** A track that finds it needs new copy stops and escalates                                            |
| `specs.md`                                     | both                                                                  | Append-only, distinct sections: AJ2-A §10.45, AJ2-B §10.46. §11 lines are appended, never rewritten                     |

`src/routes/Kit.tsx` is read-only for both. It hosts an `initialFocus` demo
that AJ2-B's change will alter the behavior of; AJ2-B reports that in its
sweep rather than editing the kit.

---

## 5. Rules both tracks are held to

Beyond `AGENTS.md`, which is binding in full:

- **Question the framing.** This file is an argument, not a specification of
  reality. Every trace in §2 was made by the operator and can be wrong. If the
  cause is not what §2 says, or the fix is next to the problem rather than in
  it, say so — that is the job, not a deviation from it.
- **TDD where it applies.** Item 4 is money-adjacent input handling: write the
  failing test first, watch it fail for the right reason, then implement.
- **Separate proved from reasoned.** Mark CONFIRMED only what you traced or
  reproduced, and say which. Item 1 in particular ends in a PLAUSIBLE unless
  you find a way to actually observe it.
- **`bun run check` must be green, and you report its real output.** Never a
  claimed pass.
- **No padding.** "Two changes, here they are, nothing else was wrong" is the
  better report.

---

## 6. Status

| Track | Branch                 | Stage | Status |
| ----- | ---------------------- | ----- | ------ |
| AJ2-A | `aj2-a-amount-display` | 1     | —      |
| AJ2-B | `aj2-b-sheet-entry`    | 1     | —      |

Each track gets its own review subagent after it merges (`AGENTS.md` § Review
protocol 1–4), then a cross-track pass over the batch (protocol 6).

## 7. Baseline

Run on `main` at `8a143c1`, 2026-08-25, before dispatch. Exit code 0:

- `tsc -b --noEmit` clean
- `oxlint` — 2 warnings, both pre-existing and both `react/only-export-components`
  (`src/components/ui/button.tsx:74`, `src/features/sync/FirstSyncGate.tsx:79`).
  Warnings, not errors. **Neither track may "fix" them** — `button.tsx` is
  operator-owned here and `FirstSyncGate.tsx` is out of scope entirely.
- `lint:units` (no-raw-px, no-ui-imports-in-lib, no-in-flow-min-h-dvh) clean
- `vitest run` — **152 files, 1618 tests, all passing**

## 8. Worktrees at the start of this batch

Checked, not assumed: `git worktree list` shows only the primary checkout,
`git branch -vv` shows only `main`, `.git/worktrees` does not exist,
`git worktree prune --dry-run -v` is silent, and
`../moneta-worktrees/` is empty. `docs/waves.md`'s worktree log already reads
`(none)`. **Nothing to prune** — the log and reality agree for once, which is
the first time this batch's predecessor could say that (see the 2026-08-25
pruning note in that log).

Note for the record: `main` is **59 commits ahead of `origin/main`** and has
never been pushed. Not this batch's work, and not an agent's call — flagged to
the user.

## 9. Still the user's, not any agent's

Carried unchanged from `docs/pendientes-usuario.md`: the real-Drive
find-before-create check (§4), the three narrowed light-mode items (§10), the
first-run download view (§5), the guest cliff flow (§6), the brand mark /
PWA icon (§8), where the biometric option lives (§11), and what the Add
sheet's gear button should do (§12).

**New from this batch:** whether the keyboard actually rises on the user's own
phone when they tap `+` (AJ2-B, item 1). No agent can verify it. Added to
`docs/pendientes-usuario.md` when AJ2-B merges, not before.
