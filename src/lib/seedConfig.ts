import { detectRegion } from '@/lib/i18n/detectLocale'
import { monedaForRegion } from '@/lib/i18n/regionCurrency'
import { CONFIG_SEMILLA, type Config } from '@/lib/schema'

/**
 * First-run config seed, `monedaPrincipal` derived from the device region.
 * `CONFIG_SEMILLA` stays a static constant (specs.md §10.7 edge case: a
 * region-dependent value computed at module-import time reproduces the
 * blank-page defect shape §11, 2026-08-19 records twice) — this function is
 * what varies per seeding call, not the constant it starts from. Shared by
 * both seeding paths (`repo.local.ts`, `bootstrap.ts`) so a fix to one
 * can't drift from the other. Only meant to be called when no `Config`
 * exists yet — a stored `Config` always wins; callers gate that, this
 * function doesn't need to.
 */
export const buildSeedConfig = (region: string = detectRegion()): Config => ({
  ...CONFIG_SEMILLA,
  preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: monedaForRegion(region) },
})
