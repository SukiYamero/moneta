import { Circle, type LucideIcon, TrendingUp } from 'lucide-react'
import type { Categoria, Config, Moneda, Movimiento, TipoMovimiento } from '@/lib/schema'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { CATEGORY_ICONS } from '@/components/shared/categoryIcons'

export const resolveCategoria = (
  categoriaId: string,
  config: Pick<Config, 'categorias'> | null | undefined,
): Categoria | undefined => config?.categorias.find((c) => c.id === categoriaId)

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

export const getMovimientoVisual = (
  categoria: Pick<Categoria, 'icono' | 'color'> | undefined,
  tipo: TipoMovimiento,
): MovimientoVisual => ({
  icon: (categoria?.icono ? CATEGORY_ICONS[categoria.icono] : undefined) ?? FALLBACK_ICON[tipo],
  tint: categoria?.color ?? FALLBACK_TINT[tipo],
})

const AMOUNT_COLOR_CLASS: Record<TipoMovimiento, string> = {
  ingreso: 'text-success',
  gasto: 'text-foreground',
}

// Constructing an Intl.NumberFormat is expensive relative to formatting with it.
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

// Intl.NumberFormat shows the ISO code instead of a symbol by default when
// the currency is foreign to the formatting region; narrowSymbol overrides that.
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

// Intl puts the sign before the currency symbol, whose own position is locale
// data ("R$" leads in pt-BR, trails in en-US) — hence formatToParts.
// formatToParts' only numeric part types are integer, nan, and infinity.
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

export const formatMontoWithSign = (monto: number, moneda: Moneda, locale: string): string =>
  attachSignToNumber(getSignedCurrencyFormatter(moneda, locale).formatToParts(monto))

export interface MovimientoAmountView {
  text: string
  colorClass: string
}

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
