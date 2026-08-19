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
// grow unbounded. Two caches because they're built with different
// `Intl.NumberFormatOptions` (plain vs. `signDisplay: 'exceptZero'`), not
// two copies of the same thing.
//
// `locale` is a required parameter, not something this module reads off
// i18next itself, so it stays pure and independently testable
// (docs/error-handling.md §7's "return a key, don't read global state"
// judgment, applied to a formatter instead of a copy lookup). It has no
// default: a call site that forgets to pass the active locale
// (`useLocaleFormatting()`) is a compile error instead of silently
// rendering es-CO to a user who switched the app to `en`/`pt-BR`
// (docs/wave-2/review-k.md finding 1 — the bug this track exists to close).
const currencyFormatters = new Map<string, Intl.NumberFormat>()
const signedCurrencyFormatters = new Map<string, Intl.NumberFormat>()

const cachedFormatter = (
  cache: Map<string, Intl.NumberFormat>,
  moneda: Moneda,
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat => {
  const key = `${locale}:${moneda}`
  const cached = cache.get(key)
  if (cached) return cached
  const formatter = new Intl.NumberFormat(locale, options)
  cache.set(key, formatter)
  return formatter
}

// currencyDisplay: 'narrowSymbol', always — never the ISO code (specs.md
// §10.7). Standard Intl shows the code instead of a symbol when the
// currency is foreign to the formatting region; traded away deliberately
// for a consistent look, since the app shows one currency at a time.
const getCurrencyFormatter = (moneda: Moneda, locale: string): Intl.NumberFormat =>
  cachedFormatter(currencyFormatters, moneda, locale, {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'narrowSymbol',
  })

const getSignedCurrencyFormatter = (moneda: Moneda, locale: string): Intl.NumberFormat =>
  cachedFormatter(signedCurrencyFormatters, moneda, locale, {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'narrowSymbol',
    signDisplay: 'exceptZero',
  })

// Intl attaches a currency's sign before the currency symbol by default
// ("-$ 12.000,00"); the sign belongs to the amount, not the currency
// ("$ -12.000,00" — specs.md §10.7), so it's moved next to the first digit
// via formatToParts instead of string-prepending a character — the
// symbol's own position is locale data ("R$" leads in pt-BR, trails in
// es-CO/en-US) a hand-built string can't safely assume.
// The types that actually render the numeric value, as opposed to currency
// symbol/literal decoration around it. `integer` covers every finite
// amount; `nan`/`infinity` are formatToParts' only other numeric part
// types (no non-finite `monto` should ever reach this — validated at
// write time, schema.ts — but a non-finite derived total, e.g. an
// arithmetic overflow, must still land the sign next to the value instead
// of silently reproducing the sign-before-currency bug this closes).
const NUMERIC_PART_TYPES = new Set<Intl.NumberFormatPartTypes>(['integer', 'nan', 'infinity'])

const attachSignToNumber = (parts: Intl.NumberFormatPart[]): string => {
  const sign = parts.find((p) => p.type === 'minusSign' || p.type === 'plusSign')
  const rest = parts.filter((p) => p.type !== 'minusSign' && p.type !== 'plusSign')
  if (!sign) return rest.map((p) => p.value).join('')
  const numberStart = rest.findIndex((p) => NUMERIC_PART_TYPES.has(p.type))
  const insertAt = numberStart === -1 ? 0 : numberStart
  return [...rest.slice(0, insertAt), sign, ...rest.slice(insertAt)].map((p) => p.value).join('')
}

export const formatMonto = (monto: number, moneda: Moneda, locale: string): string =>
  attachSignToNumber(getCurrencyFormatter(moneda, locale).formatToParts(monto))

/**
 * Same as `formatMonto`, but always shows the sign ("+" for a positive
 * `monto`, not just "-" for a negative one) — for a call site that needs
 * an explicitly signed amount (income/expense totals) rather than
 * `formatMonto`'s "only show a sign when actually negative" default.
 * Every call site with a sign to show must go through this (or
 * `getMovimientoAmountView`, which is built on it) instead of
 * concatenating a "+"/"-" in front of `formatMonto`'s output — that
 * string-prepend is the exact bug this closes (specs.md §10.7): it puts
 * the sign before the currency symbol, not next to the number.
 */
export const formatMontoWithSign = (monto: number, moneda: Moneda, locale: string): string =>
  attachSignToNumber(getSignedCurrencyFormatter(moneda, locale).formatToParts(monto))

export interface MovimientoAmountView {
  text: string
  colorClass: string
}

/** `monto` is always positive (schema.ts) — sign and color come from `tipo`. */
export const getMovimientoAmountView = (
  m: Pick<Movimiento, 'monto' | 'moneda' | 'tipo'>,
  locale: string,
): MovimientoAmountView => {
  const signedMonto = m.tipo === 'ingreso' ? m.monto : -m.monto
  return {
    text: formatMontoWithSign(signedMonto, m.moneda, locale),
    colorClass: AMOUNT_COLOR_CLASS[m.tipo],
  }
}
