import { describe, expect, it } from 'vitest'
import { createLogicalClock } from '@/lib/hlc'
import { CONFIG_SEMILLA } from '@/lib/schema'
import {
  isValidActivo,
  isValidConfig,
  isValidMovimiento,
  parseActOpFile,
  parseConfigOpFile,
  parseMovOpFile,
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

describe('isValidConfig', () => {
  it('accepts the real seed config', () => {
    expect(isValidConfig(CONFIG_SEMILLA)).toBe(true)
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
  ])('rejects: %s', (_label, value) => {
    expect(isValidConfig(value)).toBe(false)
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
    expect(parseMovOpFile(raw)).toEqual(raw)
  })

  it('drops a malformed entry but keeps the rest of a good file — never takes the whole file down', () => {
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
    const parsed = parseMovOpFile(raw)
    expect(parsed?.ops).toHaveLength(1)
    expect(parsed?.ops[0]).toEqual({ op: 'put', hlc: good, basedOn: null, mov: movimiento })
  })

  it('rejects the whole file when it is not even the right shape', () => {
    expect(parseMovOpFile(null)).toBeNull()
    expect(parseMovOpFile('a string, e.g. a truncated/corrupted download')).toBeNull()
    expect(parseMovOpFile({ v: 1, device: 'dev1', periodo: '2026-08' })).toBeNull() // ops missing
    expect(parseMovOpFile({ v: 1, device: 'dev1', periodo: 'not-a-periodo', ops: [] })).toBeNull()
  })

  it('rejects a file from a newer format version — ignored, never a thrown boot', () => {
    const raw = { v: 999, device: 'dev1', periodo: '2026-08', ops: [] }
    expect(parseMovOpFile(raw)).toBeNull()
  })
})

describe('parseActOpFile / parseConfigOpFile', () => {
  it('parseActOpFile parses a well-shaped file', () => {
    const hlc = clock.tick()
    const raw = { v: 1, device: 'dev1', ops: [{ op: 'put', hlc, basedOn: null, act: activo }] }
    expect(parseActOpFile(raw)).toEqual(raw)
  })

  it('parseConfigOpFile parses a well-shaped file and rejects a malformed config entry', () => {
    const hlc = clock.tick()
    const good = {
      v: 1,
      device: 'dev1',
      ops: [{ op: 'put', hlc, basedOn: null, config: CONFIG_SEMILLA }],
    }
    expect(parseConfigOpFile(good)).toEqual(good)

    const bad = {
      v: 1,
      device: 'dev1',
      ops: [{ op: 'put', hlc, basedOn: null, config: { ...CONFIG_SEMILLA, secciones: 'nope' } }],
    }
    expect(parseConfigOpFile(bad)?.ops).toHaveLength(0)
  })
})
