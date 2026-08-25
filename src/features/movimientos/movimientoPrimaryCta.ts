/**
 * The commit action's own size, per `docs/ui/design-export-add-sheet.md`
 * §2 (54px/18px-radius/~15.5px/800) — `size="touch"` on `Button` is a
 * touch-target minimum (44px/12px/500), not this. A per-call-site override
 * rather than a new `button.tsx` variant: this shape has exactly two call
 * sites (`AddMovimientoSheet`'s Add and `MovimientoSheet`'s edit-mode
 * Save — specs.md §10.41 has edit inherit the Add sheet's layout), nowhere
 * near the 19 call sites a shared variant would touch. Lives in its own
 * module, not exported from either component file, so neither sheet
 * becomes the other's dependency for a value that belongs to both equally
 * (same reasoning as `tintClasses.ts`/`categoryIconKeys.ts` in
 * `src/components/shared/` — specs.md §10.46.1).
 */
export const MOVIMIENTO_PRIMARY_CTA_CLASS = 'h-13.5 rounded-2xl text-md font-extrabold'
