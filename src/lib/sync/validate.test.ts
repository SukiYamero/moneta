import { describe, expect, it } from 'vitest'
import { createLogicalClock } from '@/lib/hlc'
import { CONFIG_SEMILLA } from '@/lib/schema'
import {
  isValidActivo,
  isValidMovimiento,
  parseActOpFile,
  parseConfigOpFile,
  parseMovOpFile,
  sanitizeConfig,
} from '@/lib/sync/validate'

const clock = createLogicalClock('dev1')

const movimiento = {
  id: 'm1',
  fecha: '2026-08-01',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
}

const activo = {
  id: 'a1',
  nombre: 'CDT',
  tipo: 'CDT',
  valorActual: 1000,
  moneda: 'COP',
  fechaActualizacion: '2026-08-01',
}

describe('isValidMovimiento', () => {
  it('accepts a well-shaped movimiento', () => {
    expect(isValidMovimiento(movimiento)).toBe(true)
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['missing id', { ...movimiento, id: undefined }],
    ['non-ISO fecha', { ...movimiento, fecha: '08/01/2026' }],
    ['invalid tipo', { ...movimiento, tipo: 'ahorro' }],
    ['non-positive monto', { ...movimiento, monto: 0 }],
    ['non-finite monto', { ...movimiento, monto: Number.NaN }],
    ['invalid moneda', { ...movimiento, moneda: 'XYZ' }],
    ['invalid metodo', { ...movimiento, metodo: 'cripto' }],
    ['extra not an object', { ...movimiento, extra: 'nope' }],
  ])('rejects: %s', (_label, value) => {
    expect(isValidMovimiento(value)).toBe(false)
  })
})

describe('isValidActivo', () => {
  it('accepts a well-shaped activo', () => {
    expect(isValidActivo(activo)).toBe(true)
  })

  it.each([
    ['negative valorActual', { ...activo, valorActual: -1 }],
    ['invalid tipo', { ...activo, tipo: 'oro' }],
    ['non-ISO fechaActualizacion', { ...activo, fechaActualizacion: '01-08-2026' }],
    ['invalid moneda', { ...activo, moneda: 'JPY' }],
  ])('rejects: %s', (_label, value) => {
    expect(isValidActivo(value)).toBe(false)
  })
})

describe('sanitizeConfig', () => {
  it('accepts the real seed config unchanged', () => {
    expect(sanitizeConfig(CONFIG_SEMILLA)).toEqual(CONFIG_SEMILLA)
  })

  it.each([
    ['secciones not an array', { ...CONFIG_SEMILLA, secciones: 'nope' }],
    ['a seccion missing orden', { ...CONFIG_SEMILLA, secciones: [{ id: 'x', nombre: 'X' }] }],
    [
      'a categoria with invalid tipo',
      {
        ...CONFIG_SEMILLA,
        categorias: [{ id: 'c', nombre: 'C', seccionId: 's', tipo: 'ahorro' }],
      },
    ],
    [
      'a categoria missing id',
      {
        ...CONFIG_SEMILLA,
        categorias: [{ nombre: 'C', seccionId: 's', tipo: 'gasto' }],
      },
    ],
    [
      'invalid preferencias.tema',
      {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, tema: 'neon' },
      },
    ],
    [
      'invalid primerDiaSemana',
      {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, primerDiaSemana: 3 },
      },
    ],
  ])('rejects the whole config: %s', (_label, value) => {
    expect(sanitizeConfig(value)).toBeNull()
  })

  it('strips an invalid icono but keeps the category and the rest of the config — an unknown icono is never a reason to drop a category the user created (specs.md §10.22)', () => {
    const value = {
      ...CONFIG_SEMILLA,
      categorias: [
        { id: 'c', nombre: 'C', seccionId: 's', tipo: 'gasto', icono: 'not-a-real-icon' },
      ],
    }
    const sanitized = sanitizeConfig(value)
    expect(sanitized).not.toBeNull()
    expect(sanitized?.categorias).toEqual([{ id: 'c', nombre: 'C', seccionId: 's', tipo: 'gasto' }])
  })

  it("strips an invalid color but keeps the category — an invalid IconAvatarTint from a hand-edited Drive file must never reach IconAvatar/TagChip's TINT_CLASSES[tint] lookup unguarded", () => {
    const value = {
      ...CONFIG_SEMILLA,
      categorias: [{ id: 'c', nombre: 'C', seccionId: 's', tipo: 'gasto', color: 'purple-ish' }],
    }
    const sanitized = sanitizeConfig(value)
    expect(sanitized).not.toBeNull()
    expect(sanitized?.categorias).toEqual([{ id: 'c', nombre: 'C', seccionId: 's', tipo: 'gasto' }])
  })

  it('keeps a valid icono/color untouched', () => {
    const value = {
      ...CONFIG_SEMILLA,
      categorias: [
        { id: 'c', nombre: 'C', seccionId: 's', tipo: 'gasto', icono: 'coffee', color: 'amber' },
      ],
    }
    expect(sanitizeConfig(value)?.categorias).toEqual([
      { id: 'c', nombre: 'C', seccionId: 's', tipo: 'gasto', icono: 'coffee', color: 'amber' },
    ])
  })
})

describe('sanitizeConfig — Preferencias.idioma (specs.md §12, Wave 4 stage-2 cross-track pass)', () => {
  it('strips an unsupported idioma and keeps the rest of the config', () => {
    const value = {
      ...CONFIG_SEMILLA,
      preferencias: { ...CONFIG_SEMILLA.preferencias, idioma: 'klingon' },
    }

    const sanitized = sanitizeConfig(value)

    expect(sanitized).not.toBeNull()
    expect(sanitized?.preferencias).not.toHaveProperty('idioma')
    expect(sanitized?.preferencias.monedaPrincipal).toBe(
      CONFIG_SEMILLA.preferencias.monedaPrincipal,
    )
    expect(sanitized?.categorias).toEqual(CONFIG_SEMILLA.categorias)
  })

  it('keeps a supported idioma', () => {
    const value = {
      ...CONFIG_SEMILLA,
      preferencias: { ...CONFIG_SEMILLA.preferencias, idioma: 'pt-BR' },
    }

    expect(sanitizeConfig(value)?.preferencias.idioma).toBe('pt-BR')
  })

  it('accepts a config with no idioma at all — absence means "follow the device"', () => {
    expect(sanitizeConfig(CONFIG_SEMILLA)?.preferencias).not.toHaveProperty('idioma')
  })
})

describe('parseMovOpFile', () => {
  it('parses a well-shaped file', () => {
    const hlc = clock.tick()
    const raw = {
      v: 1,
      device: 'dev1',
      periodo: '2026-08',
      ops: [{ op: 'put', hlc, basedOn: null, mov: movimiento }],
    }
    expect(parseMovOpFile(raw)).toEqual({ file: raw, skipped: 0 })
  })

  it('drops a malformed entry but keeps the rest of a good file — never takes the whole file down, and counts what it dropped', () => {
    const good = clock.tick()
    const raw = {
      v: 1,
      device: 'dev1',
      periodo: '2026-08',
      ops: [
        { op: 'put', hlc: good, basedOn: null, mov: movimiento },
        { op: 'put', hlc: 'not-a-real-hlc', basedOn: null, mov: movimiento },
        { op: 'weird-op', hlc: good, basedOn: null, mov: movimiento },
        { op: 'put', hlc: good, basedOn: null, mov: { id: 'bad', monto: -5 } },
      ],
    }
    const { file, skipped } = parseMovOpFile(raw)
    expect(file?.ops).toHaveLength(1)
    expect(file?.ops[0]).toEqual({ op: 'put', hlc: good, basedOn: null, mov: movimiento })
    expect(skipped).toBe(3) // the caller is who logs this (validate.ts stays silent by design)
  })

  it('rejects the whole file when it is not even the right shape — 0 skipped, since there is nothing to salvage a per-entry count from', () => {
    expect(parseMovOpFile(null)).toEqual({ file: null, skipped: 0 })
    expect(parseMovOpFile('a string, e.g. a truncated/corrupted download')).toEqual({
      file: null,
      skipped: 0,
    })
    expect(parseMovOpFile({ v: 1, device: 'dev1', periodo: '2026-08' })).toEqual({
      file: null,
      skipped: 0,
    }) // ops missing
    expect(parseMovOpFile({ v: 1, device: 'dev1', periodo: 'not-a-periodo', ops: [] })).toEqual({
      file: null,
      skipped: 0,
    })
  })

  it('rejects a file from a newer format version — ignored, never a thrown boot', () => {
    const raw = { v: 999, device: 'dev1', periodo: '2026-08', ops: [] }
    expect(parseMovOpFile(raw)).toEqual({ file: null, skipped: 0 })
  })
})

describe('parseActOpFile / parseConfigOpFile', () => {
  it('parseActOpFile parses a well-shaped file', () => {
    const hlc = clock.tick()
    const raw = { v: 1, device: 'dev1', ops: [{ op: 'put', hlc, basedOn: null, act: activo }] }
    expect(parseActOpFile(raw)).toEqual({ file: raw, skipped: 0 })
  })

  it('parseConfigOpFile parses a well-shaped file and rejects a malformed config entry', () => {
    const hlc = clock.tick()
    const good = {
      v: 1,
      device: 'dev1',
      ops: [{ op: 'put', hlc, basedOn: null, config: CONFIG_SEMILLA }],
    }
    expect(parseConfigOpFile(good)).toEqual({ file: good, skipped: 0 })

    const bad = {
      v: 1,
      device: 'dev1',
      ops: [{ op: 'put', hlc, basedOn: null, config: { ...CONFIG_SEMILLA, secciones: 'nope' } }],
    }
    const parsedBad = parseConfigOpFile(bad)
    expect(parsedBad.file?.ops).toHaveLength(0)
    expect(parsedBad.skipped).toBe(1)
  })
})
