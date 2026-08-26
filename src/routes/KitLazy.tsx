import { lazy } from 'react'

export const KitLazy = lazy(() =>
  import('@/routes/Kit').then((module) => ({ default: module.Kit })),
)
