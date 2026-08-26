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
