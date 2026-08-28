import { describe, expect, it } from 'vitest'
import type { Movimiento } from '@/lib/schema'
import { buildMovimientoCsvParts, type CsvExportOptions } from '@/lib/export/csv'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

const DEFAULT_CATEGORIAS: CsvExportOptions['categorias'] = [{ id: 'cat_sueldo', nombre: 'Sueldo' }]

const buildCsv = (
  movimientos: readonly Movimiento[],
  locale = 'es-CO',
  overrides: Partial<Pick<CsvExportOptions, 'categorias'>> = {},
): string =>
  buildMovimientoCsvParts(movimientos, {
    locale,
    categorias: DEFAULT_CATEGORIAS,
    ...overrides,
  }).join('')

const lines = (csv: string): string[] => csv.split('\r\n')

describe('buildMovimientoCsvParts()', () => {
  it('starts the file with a UTF-8 BOM, so Excel renders accents correctly instead of mojibake', () => {
    const csv = buildCsv([movimiento({ nota: 'Café' })])
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('follows the BOM with a sep=; hint line, so Excel under a Spanish locale opens columns correctly', () => {
    const csv = buildCsv([])
    const [firstLine] = lines(csv)
    expect(firstLine).toBe(`﻿sep=;`)
  })

  it('uses the schema field names as the header row, not localized labels, with no section column', () => {
    const csv = buildCsv([])
    const [, header] = lines(csv)
    expect(header).toBe('id;fecha;categoria;tipo;monto;moneda;metodo;nota;createdAt')
  })

  it('produces a header-only file for an empty dataset, not an error', () => {
    const csv = buildCsv([])
    expect(lines(csv)).toEqual([
      '﻿sep=;',
      'id;fecha;categoria;tipo;monto;moneda;metodo;nota;createdAt',
      '',
    ])
  })

  it('separates fields with ; and rows with CRLF, showing the category name, not the id, in a 9-field row', () => {
    const csv = buildCsv([movimiento({ id: 'm1', monto: 500 })])
    const row = lines(csv)[2]
    expect(row).toBe('m1;2026-08-15;Sueldo;ingreso;500;COP;;;2026-08-15T00:00:00.000Z')
    expect(row!.split(';')).toHaveLength(9)
  })

  it('falls back to the raw id when the category is not in Config (unsynced shard, deleted elsewhere)', () => {
    const csv = buildCsv([movimiento({ id: 'm1', monto: 500 })], 'es-CO', {
      categorias: [],
    })
    const row = lines(csv)[2]
    expect(row).toBe('m1;2026-08-15;cat_sueldo;ingreso;500;COP;;;2026-08-15T00:00:00.000Z')
  })

  it('renders optional fields (metodo, nota) as an empty column when undefined', () => {
    const csv = buildCsv([movimiento({ metodo: undefined, nota: undefined })])
    const row = lines(csv)[2]
    const fields = row!.split(';')
    expect(fields[6]).toBe('')
    expect(fields[7]).toBe('')
  })

  it('passes fecha and createdAt through as the stored ISO strings, unformatted', () => {
    const csv = buildCsv([
      movimiento({ fecha: '2026-01-05', createdAt: '2026-01-05T08:30:00.000Z' }),
    ])
    const row = lines(csv)[2]
    expect(row).toContain('2026-01-05;')
    expect(row).toContain('2026-01-05T08:30:00.000Z')
  })

  it('never includes the "extra" bag, so future secret-shaped data cannot leak into the export', () => {
    const csv = buildCsv([
      movimiento({ extra: { accessToken: 'secret-drive-token', dek: 'secret-key-material' } }),
    ])
    expect(csv).not.toContain('secret-drive-token')
    expect(csv).not.toContain('secret-key-material')
  })

  describe('decimal separator follows the active locale', () => {
    it('uses a comma for es-CO', () => {
      const csv = buildCsv([movimiento({ monto: 12000.5 })], 'es-CO')
      const row = lines(csv)[2]
      expect(row!.split(';')[4]).toBe('12000,5')
    })

    it('uses a period for en-US', () => {
      const csv = buildCsv([movimiento({ monto: 12000.5 })], 'en-US')
      const row = lines(csv)[2]
      expect(row!.split(';')[4]).toBe('12000.5')
    })

    it('disables thousands grouping, so no locale grouping mark can appear next to the ; separator', () => {
      const csvComma = buildCsv([movimiento({ monto: 1234567 })], 'es-CO')
      const csvPeriod = buildCsv([movimiento({ monto: 1234567 })], 'en-US')
      expect(lines(csvComma)[2]!.split(';')[4]).toBe('1234567')
      expect(lines(csvPeriod)[2]!.split(';')[4]).toBe('1234567')
    })

    it('preserves full precision rather than rounding to a fixed number of decimals', () => {
      const csv = buildCsv([movimiento({ monto: 1234.56789 })], 'en-US')
      expect(lines(csv)[2]!.split(';')[4]).toBe('1234.56789')
    })
  })

  describe('CSV injection escaping — a security issue, not a formatting one', () => {
    it.each(['=cmd', '+1+1', '-1+1', '@SUM(A1:A9)'])(
      'prefixes a nota starting with "%s" so Excel/Sheets treats it as text, not a formula',
      (dangerous) => {
        const csv = buildCsv([movimiento({ nota: dangerous })])
        const row = lines(csv)[2]
        const nota = row!.split(';')[7]
        expect(nota).toBe(`'${dangerous}`)
        expect(nota!.startsWith('=')).toBe(false)
        expect(nota!.startsWith('+')).toBe(false)
        expect(nota!.startsWith('-')).toBe(false)
        expect(nota!.startsWith('@')).toBe(false)
      },
    )

    it("escapes a category's resolved *name* the same way, since it is user-editable free text", () => {
      const csv = buildCsv([movimiento({ categoria: 'cat_x' })], 'es-CO', {
        categorias: [{ id: 'cat_x', nombre: '=HYPERLINK("evil")' }],
      })
      const row = lines(csv)[2]
      const fields = row!.split(';')
      expect(fields[2]).toBe('"\'=HYPERLINK(""evil"")"')
    })

    it('leaves an ordinary value beginning with a normal character untouched', () => {
      const csv = buildCsv([movimiento({ nota: 'Almuerzo con el equipo' })])
      const row = lines(csv)[2]
      expect(row!.split(';')[7]).toBe('Almuerzo con el equipo')
    })
  })

  describe('RFC4180 quoting for values containing the separator, quotes, or newlines', () => {
    it('quotes a field containing the ; field separator', () => {
      const csv = buildCsv([movimiento({ nota: 'a; b' })])
      expect(csv).toContain('"a; b"')
    })

    it('quotes and doubles internal quotes for a field containing "', () => {
      const csv = buildCsv([movimiento({ nota: 'he said "hi"' })])
      const row = lines(csv)[2]
      expect(row).toContain('"he said ""hi"""')
    })

    it('quotes a field containing an embedded newline', () => {
      const csv = buildCsv([movimiento({ nota: 'line one\nline two' })])
      expect(csv).toContain('"line one\nline two"')
    })
  })

  describe('chunking for a large dataset', () => {
    it('returns more than one string part once the dataset exceeds one chunk, never one giant string', () => {
      const many = Array.from({ length: 1200 }, (_, i) => movimiento({ id: `m${i}` }))
      const parts = buildMovimientoCsvParts(many, {
        locale: 'es-CO',
        categorias: DEFAULT_CATEGORIAS,
      })
      expect(parts.length).toBeGreaterThan(1)
    })

    it('the joined parts contain exactly one data row per movimiento, in order', () => {
      const many = Array.from({ length: 1200 }, (_, i) => movimiento({ id: `m${i}` }))
      const csv = buildMovimientoCsvParts(many, {
        locale: 'es-CO',
        categorias: DEFAULT_CATEGORIAS,
      }).join('')
      const dataLines = lines(csv).slice(2, -1)
      expect(dataLines).toHaveLength(1200)
      expect(dataLines[0]!.startsWith('m0;')).toBe(true)
      expect(dataLines[1199]!.startsWith('m1199;')).toBe(true)
    })
  })
})
