# Ajustes — manual passes on a real phone

**Goal.** Fix the defects a human holding the running app finds that no review pass caught.

**Why.** Emulators and desktop browsers can't show a real notch, a real software keyboard, or a real safe-area inset — several of these only reproduce on an actual device.

- Shell chrome standardized: no pinch/double-tap zoom, one shared top-inset token across screens, `BottomSheet`'s grab handle is fixed chrome instead of scrolling away with the panel content (specs.md §10.34–§10.35).
- `min-h-dvh` on a root already padded by `env(safe-area-inset-*)` demands the full raw viewport on top of that padding and overflows by exactly the inset — invisible on desktop, real on any notched device; swept to `min-h-full` across every screen root (§10.39).
- The Add-sheet spec (§10.23) had drifted from the design export's own Add-sheet artboard, which a marker-based search had skipped; the spec is corrected to match.
- The returning-user screen's duplicate "sign in" button is replaced with a guest escape hatch, gated behind a modal that states plainly that guest mode has no data from the signed-in account (§10.36–§10.37).
- "Olvidé mi PIN" copy is rewritten: it does not delete financial data (only the token vault/login marker), and local data was never encrypted at rest in the first place — both claims the old copy made were false (§10.38).
- `ConfirmDialog` takes a variant instead of hardcoding `destructive` on every confirmation, so a reversible action (guest switch, forgot-PIN) no longer renders as a delete (§10.40).
- The `+` FAB focus now happens inside the user-activation event so iOS actually raises the keyboard; the amount display centers the digits, not the whole `[symbol, amount]` row, and groups digits live as typed (§10.45–§10.46).
- A blocked submit brings the failing field into view instead of failing silently (§10.48).
- Overlays (`BottomSheet`/`CenterModal`) are bounded to `window.visualViewport`, not `dvh`, so the keyboard never pushes content or a modal's close button out of reach (§10.49).
- `DateChipPicker`'s month grid height and aria-labels are fixed regardless of a 4/5/6-week month (§10.50).
- `AmountField` is removed — one amount input, not two independent implementations.
