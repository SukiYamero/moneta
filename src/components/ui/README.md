# src/components/ui

shadcn/ui primitives (Radix-based, Nova preset). Add new ones with
`bunx shadcn@latest add <name>` rather than hand-rolling — compose them with
the `cn()` helper from `@/lib/utils`.

- `button.tsx` — variants include `destructive`/`secondary`, used by
  `src/components/shared/ConfirmDialog.tsx`. `size="touch"`/`"icon-touch"`
  (h/size-11, 44px) are the AGENTS.md-compliant sizes — every size below
  `lg` (h-9/36px) is under the touch-target rule, so a caller needing a
  real button reaches for `touch`/`icon-touch` instead of a per-call-site
  `className="min-h-11"` override (`specs.md` §12, 2026-08-19).
- `input.tsx` / `label.tsx` — added via `bunx shadcn@latest add input label`
  and normalised per `AGENTS.md` (the generator emits a namespace `import *
as React` and `function` declarations; the namespace import was fixed to a
  named import, the `function` declaration was left as-is since this
  directory is the one `func-style` exemption). Not used directly by
  feature code — composed into `src/components/shared/TextField.tsx` and
  `AmountField.tsx`, which own the label association, error wiring and
  44px touch target these primitives don't provide on their own.
