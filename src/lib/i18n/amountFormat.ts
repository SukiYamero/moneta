interface AmountSeparators {
  decimal: string
  group: string
}

const separatorsFor = (locale: string): AmountSeparators => {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5)
  return {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
  }
}

const NORMALIZED_AMOUNT = /^-?\d+(\.\d+)?$/

export const decimalSeparatorFor = (locale: string): string => separatorsFor(locale).decimal

export const groupSeparatorFor = (locale: string): string => separatorsFor(locale).group

export type ParsedAmount =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'malformed' | 'not_positive' }

export const parseAmountForInput = (raw: string, locale: string): ParsedAmount => {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, reason: 'empty' }

  const { decimal, group } = separatorsFor(locale)
  const normalized = trimmed.split(group).join('').replace(decimal, '.')
  if (!NORMALIZED_AMOUNT.test(normalized)) return { ok: false, reason: 'malformed' }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, reason: 'malformed' }
  if (value <= 0) return { ok: false, reason: 'not_positive' }
  return { ok: true, value }
}

export const parseAmount = (raw: string, locale: string): number | undefined => {
  const result = parseAmountForInput(raw, locale)
  return result.ok ? result.value : undefined
}

export const formatAmountForInput = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)

export const isAmountInputInvalid = (
  value: string,
  locale: string,
  error: string | undefined,
): boolean => {
  const parsed = parseAmountForInput(value, locale)
  const isMalformed = !parsed.ok && parsed.reason === 'malformed'
  return error !== undefined || isMalformed
}

const DIGITS_ONLY = /^\d*$/

export const formatAmountLive = (raw: string, locale: string): string => {
  const { decimal, group } = separatorsFor(locale)
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw

  const decimalIndex = body.indexOf(decimal)
  const hasSecondDecimal = decimalIndex !== -1 && body.includes(decimal, decimalIndex + 1)
  if (hasSecondDecimal) return raw

  const integerPart = decimalIndex === -1 ? body : body.slice(0, decimalIndex)
  const fractionPart = decimalIndex === -1 ? undefined : body.slice(decimalIndex + decimal.length)

  const integerDigits = integerPart.split(group).join('')
  if (!DIGITS_ONLY.test(integerDigits)) return raw
  if (integerPart !== '' && integerDigits === '') return raw
  if (fractionPart !== undefined && !DIGITS_ONLY.test(fractionPart)) return raw

  const groupedInteger =
    integerDigits === '' ? '' : new Intl.NumberFormat(locale).format(BigInt(integerDigits))
  const sign = negative ? '-' : ''

  return fractionPart === undefined
    ? sign + groupedInteger
    : sign + groupedInteger + decimal + fractionPart
}

const isDigitAt = (text: string, index: number): boolean => {
  const code = text.charCodeAt(index)
  return code >= 48 && code <= 57
}

export const digitsBeforeIndex = (text: string, index: number): number => {
  const clamped = Math.min(Math.max(index, 0), text.length)
  let count = 0
  for (let i = 0; i < clamped; i++) {
    if (isDigitAt(text, i)) count++
  }
  return count
}

export const indexAfterDigitCount = (text: string, digitCount: number): number => {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (isDigitAt(text, i)) {
      seen++
      if (seen === digitCount) {
        let end = i + 1
        while (end < text.length && !isDigitAt(text, end)) end++
        return end
      }
    }
  }
  return text.length
}
