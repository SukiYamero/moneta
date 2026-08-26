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

  it('parses a plain integer with no separators the same in every locale', () => {
    expect(parseAmount('5000', 'es-CO')).toBe(5000)
    expect(parseAmount('5000', 'en-US')).toBe(5000)
  })

  it.each([
    ['empty string', '', 'es-CO'],
    ['whitespace only', '   ', 'es-CO'],
    ['negative amount', '-5', 'es-CO'],
    ['non-numeric text', 'abc', 'es-CO'],
    ['a lone group separator', '.', 'es-CO'],
    ['a lone group separator', ',', 'en-US'],
    ['two lone group separators', '..', 'es-CO'],
    ['a lone decimal separator', ',', 'es-CO'],
    ['a lone decimal separator', '.', 'en-US'],
    ['multiple decimal separators', '12.34.56', 'en-US'],
    ['multiple decimal separators', '12,34,56', 'es-CO'],
    ['a pasted currency symbol', '$100', 'es-CO'],
    ['a pasted currency code', 'COP 100', 'es-CO'],
    ['a hex-looking string', '0x1a', 'en-US'],
  ] as const)('returns undefined for %s (%p, %s)', (_label, input, locale) => {
    expect(parseAmount(input, locale)).toBeUndefined()
  })
})

describe('parseAmountForInput', () => {
  it('distinguishes empty from malformed from non-positive, so a caller can react differently to each', () => {
    expect(parseAmountForInput('', 'es-CO')).toEqual({ ok: false, reason: 'empty' })
    expect(parseAmountForInput('   ', 'es-CO')).toEqual({ ok: false, reason: 'empty' })
    expect(parseAmountForInput('abc', 'es-CO')).toEqual({ ok: false, reason: 'malformed' })
    expect(parseAmountForInput('0', 'es-CO')).toEqual({ ok: false, reason: 'not_positive' })
  })

  it('rejects 0 as not_positive, not as a valid amount — monto is always positive (schema.ts)', () => {
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
    // Number('1e999') is Infinity.
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
  it.each([
    ['empty input, no caller error — nothing typed yet is not a typo', '', undefined, false],
    ['a well-formed amount, no caller error', '18.000', undefined, false],
    [
      'not_positive input (a bare 0), no caller error — a valid keystroke in progress',
      '0',
      undefined,
      false,
    ],
    ['malformed text, no caller error', 'abc', undefined, true],
    ['a well-formed amount with a caller error', '18.000', 'monto requerido', true],
    ['empty input with a caller error', '', 'monto requerido', true],
  ] as const)('%s', (_label, text, error, expected) => {
    expect(isAmountInputInvalid(text, 'es-CO', error)).toBe(expected)
  })
})

describe('formatAmountLive', () => {
  it('groups a plain digit string as the locale would, with no fraction typed yet', () => {
    expect(formatAmountLive('1234567', 'es-CO')).toBe('1.234.567')
    expect(formatAmountLive('1234567', 'en-US')).toBe('1,234,567')
  })

  it('groups with a space for a locale that groups that way', () => {
    // The exact space character (narrow-no-break vs. plain) is an ICU/runtime detail.
    const expected = new Intl.NumberFormat('fr-FR').format(1234567)
    expect(formatAmountLive('1234567', 'fr-FR')).toBe(expected)
    expect(formatAmountLive('1234567', 'fr-FR')).not.toBe('1234567')
  })

  it('does not insert any grouping when the locale reports no group separator', () => {
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

  it.each([
    ['non-numeric text', 'abc', 'es-CO'],
    ['a pasted currency symbol', '$100', 'es-CO'],
    ['multiple decimal separators', '12.34.56', 'en-US'],
    ['a lone group separator', '.', 'es-CO'],
    ['two lone group separators', '..', 'es-CO'],
  ] as const)(
    'passes %s through unchanged rather than mangling it — the parser still flags it (%p)',
    (_label, input, locale) => {
      expect(formatAmountLive(input, locale)).toBe(input)
    },
  )

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
    expect(indexAfterDigitCount('1.234.567', 2)).toBe(3)
  })

  it('extends through a separator run right after the nth digit, landing before the next digit', () => {
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
