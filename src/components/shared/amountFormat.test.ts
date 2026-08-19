import { describe, it, expect } from 'vitest'
import { parseAmount, formatAmountForInput } from '@/components/shared/amountFormat'

describe('parseAmount', () => {
  it('parses a dot-grouped, comma-decimal amount (es-CO)', () => {
    expect(parseAmount('1.234.567,89', 'es-CO')).toBe(1234567.89)
  })

  it('parses a comma-grouped, dot-decimal amount (en-US)', () => {
    expect(parseAmount('1,234,567.89', 'en-US')).toBe(1234567.89)
  })

  it('round-trips formatAmountForInput -> parseAmount for every target locale', () => {
    const amount = 1234567.89
    for (const locale of ['es-CO', 'es-MX', 'es-AR', 'en-US', 'pt-BR']) {
      expect(parseAmount(formatAmountForInput(amount, locale), locale)).toBe(amount)
    }
  })

  it('returns undefined for an empty or whitespace-only string', () => {
    expect(parseAmount('', 'es-CO')).toBeUndefined()
    expect(parseAmount('   ', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for a negative amount', () => {
    expect(parseAmount('-5', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for malformed text', () => {
    expect(parseAmount('abc', 'es-CO')).toBeUndefined()
  })

  it('parses a plain integer with no separators the same in every locale', () => {
    expect(parseAmount('5000', 'es-CO')).toBe(5000)
    expect(parseAmount('5000', 'en-US')).toBe(5000)
  })

  it('returns undefined for a lone group separator, not 0', () => {
    // `Number('')` is `0` once grouping is stripped from a string that was
    // nothing but group separators — this must not read as "$0".
    expect(parseAmount('.', 'es-CO')).toBeUndefined()
    expect(parseAmount(',', 'en-US')).toBeUndefined()
    expect(parseAmount('..', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for a lone decimal separator', () => {
    expect(parseAmount(',', 'es-CO')).toBeUndefined()
    expect(parseAmount('.', 'en-US')).toBeUndefined()
  })

  it('returns undefined for multiple decimal separators', () => {
    expect(parseAmount('12.34.56', 'en-US')).toBeUndefined()
    expect(parseAmount('12,34,56', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for a pasted currency symbol', () => {
    expect(parseAmount('$100', 'es-CO')).toBeUndefined()
    expect(parseAmount('COP 100', 'es-CO')).toBeUndefined()
  })

  it('returns undefined for a hex-looking string instead of coercing it via Number()', () => {
    expect(parseAmount('0x1a', 'en-US')).toBeUndefined()
  })
})
