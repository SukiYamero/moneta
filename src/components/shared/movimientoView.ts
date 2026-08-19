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
// expects to grow to years of entries, so formatters are built once per
// (locale, currency) pair and cached at module scope instead of on every
// call. The set of pairs actually used is bounded by the app's supported
// locales/currencies, not the number of movimientos, so the cache can't
// grow unbounded.
//
// `locale` defaults to `es-CO` — this codebase has no active-locale-aware
// formatting anywhere yet (docs/wave-2/track-e2.md "Spec deltas"); it is a
// plain parameter, not something this module reads off i18next itself, so
// it stays pure and independently testable (docs/error-handling.md §7's
// "return a key, don't read global state" judgment, applied to a formatter
// instead of a copy lookup). Callers that care about the active locale pass
// it in; callers that don't get today's unchanged es-CO behavior.
const DEFAULT_LOCALE = 'es-CO'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

const getCurrencyFormatter = (moneda: Moneda, locale: string): Intl.NumberFormat => {
  const key = `${locale}:${moneda}`
  const cached = currencyFormatters.get(key)
  if (cached) return cached
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: moneda })
  currencyFormatters.set(key, formatter)
  return formatter
}

export const formatMonto = (
  monto: number,
  moneda: Moneda,
  locale: string = DEFAULT_LOCALE,
): string => {
  return getCurrencyFormatter(moneda, locale).format(monto)
}

export interface MovimientoAmountView {
  text: string
  colorClass: string
}

/** `monto` is always positive (schema.ts) — sign and color come from `tipo`. */
export const getMovimientoAmountView = (
  m: Pick<Movimiento, 'monto' | 'moneda' | 'tipo'>,
  locale: string = DEFAULT_LOCALE,
): MovimientoAmountView => {
  return {
    text: SIGN[m.tipo] + formatMonto(m.monto, m.moneda, locale),
    colorClass: AMOUNT_COLOR_CLASS[m.tipo],
  }
}
