import { describe, it, expect } from 'vitest'
import { parseAmount, parseAmountForInput, formatAmountForInput } from '@/lib/i18n/amountFormat'

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

describe('parseAmountForInput', () => {
  it('distinguishes empty from malformed from non-positive (docs/error-handling.md, the seam Track F picks up)', () => {
    expect(parseAmountForInput('', 'es-CO')).toEqual({ ok: false, reason: 'empty' })
    expect(parseAmountForInput('   ', 'es-CO')).toEqual({ ok: false, reason: 'empty' })
    expect(parseAmountForInput('abc', 'es-CO')).toEqual({ ok: false, reason: 'malformed' })
    expect(parseAmountForInput('0', 'es-CO')).toEqual({ ok: false, reason: 'not_positive' })
  })

  // schema.ts: `monto` is always positive — parseAmount today wrongly lets
  // 0 through (`value >= 0`), which is the real defect this parser closes.
  it('rejects 0 as not_positive, not as a valid amount', () => {
    expect(parseAmountForInput('0', 'en-US')).toEqual({ ok: false, reason: 'not_positive' })
    expect(parseAmountForInput('0,00', 'es-CO')).toEqual({ ok: false, reason: 'not_positive' })
  })

  it('rejects a negative amount as not_positive, since it is a well-formed negative number', () => {
    expect(parseAmountForInput('-5', 'es-CO')).toEqual({ ok: false, reason: 'not_positive' })
    expect(parseAmountForInput('-1.234,56', 'es-CO')).toEqual({ ok: false, reason: 'not_positive' })
  })

  it('returns ok:true with the parsed value for a well-formed positive amount', () => {
    expect(parseAmountForInput('18.000', 'es-CO')).toEqual({ ok: true, value: 18000 })
    expect(parseAmountForInput('18,000.50', 'en-US')).toEqual({ ok: true, value: 18000.5 })
  })

  it('rejects a pasted 1e999 as malformed rather than letting it reach Infinity', () => {
    // Number('1e999') is Infinity — the regex must reject the exponent
    // notation outright, this must not depend on an Infinity check downstream.
    expect(parseAmountForInput('1e999', 'en-US')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects a lone group/decimal separator as malformed, not empty', () => {
    expect(parseAmountForInput('.', 'es-CO')).toEqual({ ok: false, reason: 'malformed' })
    expect(parseAmountForInput(',', 'en-US')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('parseAmount is built on parseAmountForInput, not duplicated beside it', () => {
    const parsed = parseAmountForInput('18.000', 'es-CO')
    expect(parsed.ok).toBe(true)
    expect(parseAmount('18.000', 'es-CO')).toBe(parsed.ok ? parsed.value : undefined)
    expect(parseAmount('0', 'es-CO')).toBeUndefined()
    expect(parseAmount('abc', 'es-CO')).toBeUndefined()
  })
})
