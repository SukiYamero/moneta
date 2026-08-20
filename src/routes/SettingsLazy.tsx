import { lazy } from 'react'

// Isolated from router.tsx (which also exports the non-component `router`)
// so this file only ever exports a component — react-refresh's
// only-export-components rule requires that split to stay warning-free,
// same reasoning as `KitLazy.tsx`. `/settings` is off the three tabs'
// critical path, so it's code-split like `/kit` rather than bundled with
// the always-loaded route table.
export const SettingsLazy = lazy(() =>
  import('@/features/settings/SettingsScreen').then((module) => ({
    default: module.SettingsScreen,
  })),
)
