import { lazy } from 'react'

export const SettingsLazy = lazy(() =>
  import('@/features/settings/SettingsScreen').then((module) => ({
    default: module.SettingsScreen,
  })),
)
