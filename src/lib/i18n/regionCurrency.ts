import type { Moneda } from '@/lib/schema'

const REGION_CURRENCY: Record<string, Moneda> = {
  MX: 'MXN',
  AR: 'ARS',
  BR: 'BRL',
  PE: 'PEN',
  CO: 'COP',
  EC: 'USD',
  US: 'USD',
}

export const monedaForRegion = (region: string | undefined): Moneda =>
  (region ? REGION_CURRENCY[region.toUpperCase()] : undefined) ?? 'COP'
