import { describe, it, expect, vi } from 'vitest'
import {
  parseAmount,
  parseAmountForInput,
  formatAmountForInput,
  isAmountInputInvalid,
  formatAmountLive,
  digitsBeforeIndex,
  indexAfterDigitCount,
  decimalSeparatorFor,
  groupSeparatorFor,
} from '@/lib/i18n/amountFormat'

describe('decimalSeparatorFor', () => {
  it("returns the locale's own decimal separator — comma for es-CO, dot for en-US", () => {
    expect(decimalSeparatorFor('es-CO')).toBe(',')
    expect(decimalSeparatorFor('en-US')).toBe('.')
  })
})

describe('groupSeparatorFor', () => {
  it("returns the locale's own grouping separator — dot for es-CO, comma for en-US", () => {
    expect(groupSeparatorFor('es-CO')).toBe('.')
    expect(groupSeparatorFor('en-US')).toBe(',')
  })
})

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

describe('isAmountInputInvalid', () => {
  it('is false for empty input with no caller error — nothing typed yet is not a typo', () => {
    expect(isAmountInputInvalid('', 'es-CO', undefined)).toBe(false)
  })

  it('is false for a well-formed amount with no caller error', () => {
    expect(isAmountInputInvalid('18.000', 'es-CO', undefined)).toBe(false)
  })

  it('is false for not_positive (e.g. a bare 0) with no caller error — a valid keystroke in progress, not a typo', () => {
    expect(isAmountInputInvalid('0', 'es-CO', undefined)).toBe(false)
  })

  it('is true for malformed text even with no caller error', () => {
    expect(isAmountInputInvalid('abc', 'es-CO', undefined)).toBe(true)
  })

  it('is true whenever the caller passes an error, regardless of what the text parses to', () => {
    expect(isAmountInputInvalid('18.000', 'es-CO', 'monto requerido')).toBe(true)
    expect(isAmountInputInvalid('', 'es-CO', 'monto requerido')).toBe(true)
  })
})

describe('formatAmountLive', () => {
  it('groups a plain digit string as the locale would, with no fraction typed yet', () => {
    expect(formatAmountLive('1234567', 'es-CO')).toBe('1.234.567')
    expect(formatAmountLive('1234567', 'en-US')).toBe('1,234,567')
  })

  it('groups with a space for a locale that groups that way', () => {
    // The exact space character (plain vs. narrow-no-break) is an ICU/runtime
    // detail, not something this test should hard-code — assert it matches
    // whatever Intl itself produces for the same locale/number.
    const expected = new Intl.NumberFormat('fr-FR').format(1234567)
    expect(formatAmountLive('1234567', 'fr-FR')).toBe(expected)
    expect(formatAmountLive('1234567', 'fr-FR')).not.toBe('1234567')
  })

  it('does not insert any grouping when the locale reports no group separator', () => {
    // No real BCP-47 locale in this ICU build skips grouping by default, so
    // this simulates one: a locale whose formatToParts/format never emit a
    // 'group' part, the same shape separatorsFor's '' fallback exists for.
    const RealNumberFormat = Intl.NumberFormat
    class NoGroupFormat {
      format = String
      formatToParts(value: number) {
        const [integer, fraction] = String(value).split('.')
        return fraction === undefined
          ? [{ type: 'integer', value: integer }]
          : [
              { type: 'integer', value: integer },
              { type: 'decimal', value: '.' },
              { type: 'fraction', value: fraction },
            ]
      }
    }
    vi.stubGlobal('Intl', { ...Intl, NumberFormat: NoGroupFormat })
    try {
      expect(formatAmountLive('1234567', 'no-group-test')).toBe('1234567')
    } finally {
      vi.stubGlobal('Intl', { ...Intl, NumberFormat: RealNumberFormat })
    }
  })

  it('keeps a trailing decimal separator mid-entry, on the way to a fraction', () => {
    expect(formatAmountLive('1,', 'es-CO')).toBe('1,')
    expect(formatAmountLive('1234567,', 'es-CO')).toBe('1.234.567,')
  })

  it('does not collapse a trailing fraction zero', () => {
    expect(formatAmountLive('1,50', 'es-CO')).toBe('1,50')
    expect(formatAmountLive('1.50', 'en-US')).toBe('1.50')
  })

  it('regroups the integer part as more digits are typed, ignoring stale separators already in the string', () => {
    expect(formatAmountLive('1.2345', 'es-CO')).toBe('12.345')
  })

  it('is a no-op when a grouping separator is deleted — it reappears since it is derived, not literal', () => {
    expect(formatAmountLive('12345', 'es-CO')).toBe('12.345')
  })

  it('preserves a leading minus sign', () => {
    expect(formatAmountLive('-1234567', 'es-CO')).toBe('-1.234.567')
    expect(formatAmountLive('-1234567,5', 'es-CO')).toBe('-1.234.567,5')
  })

  it('passes malformed text through unchanged rather than mangling it — the parser still flags it', () => {
    expect(formatAmountLive('abc', 'es-CO')).toBe('abc')
    expect(formatAmountLive('$100', 'es-CO')).toBe('$100')
    expect(formatAmountLive('12.34.56', 'en-US')).toBe('12.34.56')
  })

  it('passes a lone group separator through unchanged — separator noise with no digits at all, not a number in progress', () => {
    expect(formatAmountLive('.', 'es-CO')).toBe('.')
    expect(formatAmountLive('..', 'es-CO')).toBe('..')
  })

  it('keeps a leading decimal separator with digits after it (no integer part typed yet)', () => {
    expect(formatAmountLive(',50', 'es-CO')).toBe(',50')
  })

  it('produces the same string as formatAmountForInput for the same number, up to 2 typed fraction digits', () => {
    const cases: [number, string][] = [
      [1234567, 'es-CO'],
      [1234567.89, 'es-CO'],
      [1234567.89, 'en-US'],
      [50, 'pt-BR'],
      [0.5, 'es-AR'],
    ]
    for (const [amount, locale] of cases) {
      const prefilled = formatAmountForInput(amount, locale)
      expect(formatAmountLive(prefilled, locale)).toBe(prefilled)
    }
  })

  it('returns empty string for empty input', () => {
    expect(formatAmountLive('', 'es-CO')).toBe('')
  })
})

describe('digitsBeforeIndex', () => {
  it('counts only digit characters before the given index', () => {
    expect(digitsBeforeIndex('1.234.567', 0)).toBe(0)
    expect(digitsBeforeIndex('1.234.567', 1)).toBe(1)
    expect(digitsBeforeIndex('1.234.567', 2)).toBe(1)
    expect(digitsBeforeIndex('1.234.567', 9)).toBe(7)
  })

  it('clamps to the string length for an out-of-range index', () => {
    expect(digitsBeforeIndex('123', 99)).toBe(3)
  })
})

describe('indexAfterDigitCount', () => {
  it('finds the index right after the nth digit when the next character is itself a digit', () => {
    // "1.234.567": digit #2 is the "2" at index 2, immediately followed by
    // the digit "3" — no separator run to extend through.
    expect(indexAfterDigitCount('1.234.567', 2)).toBe(3)
  })

  it('extends through a separator run right after the nth digit, landing before the next digit', () => {
    // "1." — digit #1 is at index 0; index 1 (right after it) is the
    // separator itself. The only sensible caret spot for "1 digit typed" is
    // past the separator too (index 2, the end), not wedged before it —
    // wedging it there is the exact bug that made "1,50" type as "150,".
    expect(indexAfterDigitCount('1.234.567', 1)).toBe(2)
    expect(indexAfterDigitCount('1.234.567', 7)).toBe(9)
  })

  it('returns 0 for a digit count of 0 or less', () => {
    expect(indexAfterDigitCount('1.234.567', 0)).toBe(0)
  })

  it('returns the string length when the digit count exceeds the digits available', () => {
    expect(indexAfterDigitCount('123', 10)).toBe(3)
  })
})
