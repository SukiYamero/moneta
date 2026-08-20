// `Preferencias.primerDiaSemana` (0 = domingo, 1 = lunes) needs a
// day↔choice mapping in both directions: `PreferencesSection.tsx` reads a
// stored value to a label, `PreferencesEditor.tsx` writes a picked label
// back to a value. Both hand-maintained their own inverse table until now
// (specs.md §12, 2026-08-20, the same "primerDiaSemana ↔ day-name is two
// hand-maintained inverse lookup tables" shape as the `toIsoDate`
// duplication) — one ordered source here replaces both, per AGENTS.md's
// "move the value down into `src/lib/`" rule.
export type WeekStartChoice = 'sunday' | 'monday'

const WEEK_START_ENTRIES: readonly (readonly [0 | 1, WeekStartChoice])[] = [
  [0, 'sunday'],
  [1, 'monday'],
]

export const WEEK_START_KEY: Record<0 | 1, WeekStartChoice> = Object.fromEntries(
  WEEK_START_ENTRIES,
) as Record<0 | 1, WeekStartChoice>

export const WEEK_START_VALUE: Record<WeekStartChoice, 0 | 1> = Object.fromEntries(
  WEEK_START_ENTRIES.map(([day, choice]) => [choice, day]),
) as Record<WeekStartChoice, 0 | 1>
