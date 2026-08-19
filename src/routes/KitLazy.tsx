import { lazy } from 'react'

// Isolated from router.tsx (which also exports the non-component `router`)
// so this file only ever exports a component — react-refresh's
// only-export-components rule requires that split to stay warning-free.
export const KitLazy = lazy(() =>
  import('@/routes/Kit').then((module) => ({ default: module.Kit })),
)
