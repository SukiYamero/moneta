import {
  Briefcase,
  Car,
  Circle,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  PartyPopper,
  Receipt,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import type { Moneda, Movimiento, TipoMovimiento } from '@/lib/schema'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'

// Single source of truth for category -> icon/tint. Icon/tint are
// presentation, deliberately not part of schema.ts — every screen that
// renders a Movimiento imports this instead of re-deriving its own mapping.
// Keyed by category *name* (CONFIG_SEMILLA.categorias[].nombre), plus common
// categories from the design's sample data so screens built against either
// source render consistently.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  Sueldo: Briefcase,
  Ventas: TrendingUp,
  Freelance: Laptop,
  Servicios: Receipt,
  Impuestos: Landmark,
  'Caja menor': Wallet,
  Comida: UtensilsCrossed,
  Transporte: Car,
  Compras: ShoppingBag,
  Ocio: PartyPopper,
  Salud: HeartPulse,
  Hogar: House,
  Regalo: Gift,
}

const CATEGORY_TINT: Record<string, IconAvatarTint> = {
  Sueldo: 'emerald',
  Ventas: 'emerald',
  Freelance: 'blue',
  Servicios: 'blue',
  Impuestos: 'rose',
  'Caja menor': 'amber',
  Comida: 'amber',
  Transporte: 'blue',
  Compras: 'purple',
  Ocio: 'rose',
  Salud: 'emerald',
  Hogar: 'emerald',
  Regalo: 'purple',
}

const FALLBACK_ICON: Record<TipoMovimiento, LucideIcon> = {
  ingreso: TrendingUp,
  gasto: Circle,
}

const FALLBACK_TINT: Record<TipoMovimiento, IconAvatarTint> = {
  ingreso: 'emerald',
  gasto: 'neutral',
}

export interface MovimientoVisual {
  icon: LucideIcon
  tint: IconAvatarTint
}

/** Unknown category names (custom user tags) fall back to a type-based icon/tint. */
export const getMovimientoVisual = (
  m: Pick<Movimiento, 'categoria' | 'tipo'>,
): MovimientoVisual => {
  return {
    icon: CATEGORY_ICON[m.categoria] ?? FALLBACK_ICON[m.tipo],
    tint: CATEGORY_TINT[m.categoria] ?? FALLBACK_TINT[m.tipo],
  }
}

const SIGN: Record<TipoMovimiento, '+' | '-'> = { ingreso: '+', gasto: '-' }

// income reads success-green, expense reads plain foreground — matches the
// design (only income gets a color call-out, expense is never flagged red).
const AMOUNT_COLOR_CLASS: Record<TipoMovimiento, string> = {
  ingreso: 'text-success',
  gasto: 'text-foreground',
}

// Constructing an Intl.NumberFormat is expensive relative to formatting a
// number — MovimientoRow calls this per row per render in a list the spec
// expects to grow to years of entries, so the formatters are built once per
// currency at module scope instead of on every call.
const CURRENCY_FORMATTERS: Record<Moneda, Intl.NumberFormat> = {
  COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }),
  USD: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD' }),
}

export const formatMonto = (monto: number, moneda: Moneda): string => {
  return CURRENCY_FORMATTERS[moneda].format(monto)
}

export interface MovimientoAmountView {
  text: string
  colorClass: string
}

/** `monto` is always positive (schema.ts) — sign and color come from `tipo`. */
export const getMovimientoAmountView = (
  m: Pick<Movimiento, 'monto' | 'moneda' | 'tipo'>,
): MovimientoAmountView => {
  return {
    text: SIGN[m.tipo] + formatMonto(m.monto, m.moneda),
    colorClass: AMOUNT_COLOR_CLASS[m.tipo],
  }
}
