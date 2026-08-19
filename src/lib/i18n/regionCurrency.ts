import type { Moneda } from '@/lib/schema'

// The regions the four supported copy locales target (specs.md §10.7).
// EC and US both use USD (Ecuador is dollarized, has no currency of its
// own) — a many-to-one mapping, still a plain lookup, no branch.
const REGION_CURRENCY: Record<string, Moneda> = {
  MX: 'MXN',
  AR: 'ARS',
  BR: 'BRL',
  PE: 'PEN',
  CO: 'COP',
  EC: 'USD',
  US: 'USD',
}

/**
 * First-run currency for a detected device region. An unmapped or missing
 * region falls back to `COP` — today's behavior — rather than guessing at
 * a currency for a region this app doesn't target yet.
 */
export const monedaForRegion = (region: string | undefined): Moneda =>
  (region ? REGION_CURRENCY[region.toUpperCase()] : undefined) ?? 'COP'
