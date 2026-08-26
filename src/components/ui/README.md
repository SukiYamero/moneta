# src/components/ui

shadcn/ui primitives (Radix-based). Add new ones with
`bunx shadcn@latest add <name>` rather than hand-rolling; compose with the
`cn()` helper from `@/lib/utils`. This directory is exempt from the repo's
usual `func-style`/named-import rules — leave the generator's output as-is
beyond normalizing namespace imports (`import * as React` → named imports).

- `button.tsx` — variants (`default`/`outline`/`secondary`/`ghost`/
  `destructive`/`link`) and sizes (`xs`/`sm`/`default`/`lg`, plus `icon`/
  `icon-xs`/`icon-sm`/`icon-lg`). `size="touch"`/`"icon-touch"` (44px) are
  the sizes that meet the app's touch-target floor — every other size is
  below it. Used throughout `src/features/**` and `src/components/shared`.
- `input.tsx` / `label.tsx` — added via `bunx shadcn@latest add input label`.
  Composed into `src/components/shared/TextField.tsx` (label association,
  error wiring, touch target) and `src/features/movimientos/
MovimientoAmountInput.tsx`; also imported directly by
  `src/features/tags/TagPickerSheet.tsx`.
