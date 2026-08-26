import { describe, expect, it } from 'vitest'
import { createLogicalClock } from '@/lib/hlc'
import type { Activo, Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import {
  buildActFilename,
  buildConfigFilename,
  buildMovMonthFilename,
  buildMovYearFilename,
  buildYearlyCsvFilename,
  currentPeriodo,
  currentYear,
  leemeFilename,
  parseDriveFilename,
  replayActivos,
  replayConfig,
  replayMovimientos,
  yearOfPeriodo,
  type ActOpFile,
  type ConfigOpFile,
  type MovOpFile,
} from '@/lib/sync/opLog'

// Two clocks share one synthetic, ever-incrementing now() so their hlc
// values sort in call order, modeling two devices whose physical clocks
// agree — clock skew/merge logic is hlc.test.ts's job, not this file's.
const makeClocks = (): {
  a: ReturnType<typeof createLogicalClock>
  b: ReturnType<typeof createLogicalClock>
} => {
  let t = 0
  const nowFn = (): number => (t += 1)
  return { a: createLogicalClock('devicea', nowFn), b: createLogicalClock('deviceb', nowFn) }
}

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  fecha: '2026-08-01',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const movFile = (device: string, periodo: string, ops: MovOpFile['ops']): MovOpFile => ({
  v: 1,
  device,
  periodo,
  ops,
})

describe('replayMovimientos', () => {
  it('a lone create is alive', () => {
    const { a: clockA } = makeClocks()
    const hlc = clockA.tick()
    const file = movFile('devicea', '2026-08', [
      { op: 'put', hlc, basedOn: null, mov: movimiento() },
    ])
    const { items, revivedIds } = replayMovimientos([file])
    expect(items).toEqual([movimiento()])
    expect(revivedIds).toEqual([])
  })

  it('a sequential edit (basedOn the create) wins over the create', () => {
    const { a: clockA } = makeClocks()
    const created = clockA.tick()
    const edited = clockA.tick()
    const file = movFile('devicea', '2026-08', [
      { op: 'put', hlc: created, basedOn: null, mov: movimiento({ monto: 100 }) },
      { op: 'put', hlc: edited, basedOn: created, mov: movimiento({ monto: 200 }) },
    ])
    const { items } = replayMovimientos([file])
    expect(items).toEqual([movimiento({ monto: 200 })])
  })

  it('a sequential delete (basedOn the most recent put) removes the record', () => {
    const { a: clockA } = makeClocks()
    const created = clockA.tick()
    const deleted = clockA.tick()
    const file = movFile('devicea', '2026-08', [
      { op: 'put', hlc: created, basedOn: null, mov: movimiento() },
      { op: 'del', hlc: deleted, basedOn: created, id: 'm1' },
    ])
    const { items } = replayMovimientos([file])
    expect(items).toEqual([])
  })

  it('edits an eight-months-old movement without reopening its file: the op just lands in the current shard and wins', () => {
    const { a: clockA } = makeClocks()
    const created = clockA.tick()
    const edited = clockA.tick()
    const oldShard = movFile('devicea', '2026-01', [
      {
        op: 'put',
        hlc: created,
        basedOn: null,
        mov: movimiento({ fecha: '2026-01-05', monto: 100 }),
      },
    ])
    // The correcting op lives in August's file even though the movement's
    // own `fecha` is January.
    const currentShard = movFile('devicea', '2026-08', [
      {
        op: 'put',
        hlc: edited,
        basedOn: created,
        mov: movimiento({ fecha: '2026-01-05', monto: 150 }),
      },
    ])
    const { items } = replayMovimientos([oldShard, currentShard])
    expect(items).toEqual([movimiento({ fecha: '2026-01-05', monto: 150 })])
  })

  it('a concurrent delete-vs-edit revives the record with the edit content', () => {
    const { a: clockA, b: clockB } = makeClocks()
    const created = clockA.tick()
    // Device B edits, based on the create — never having seen a delete.
    const edited = clockB.tick()
    // Device A deletes, also based on the create — never having seen the edit.
    const deleted = clockA.tick()
    const editFile = movFile('deviceb', '2026-08', [
      { op: 'put', hlc: edited, basedOn: created, mov: movimiento({ monto: 300, nota: 'edited' }) },
    ])
    const deleteFile = movFile('devicea', '2026-08', [
      { op: 'del', hlc: deleted, basedOn: created, id: 'm1' },
    ])
    const { items, revivedIds } = replayMovimientos([editFile, deleteFile])
    expect(items).toEqual([movimiento({ monto: 300, nota: 'edited' })])
    expect(revivedIds).toEqual(['m1'])
  })

  it('a delete that DID see the edit (basedOn the edit, not the create) deletes normally — no false revival', () => {
    const { a: clockA, b: clockB } = makeClocks()
    const created = clockA.tick()
    const edited = clockB.tick()
    // Device A pulled B's edit before deleting: basedOn correctly chains to it.
    const deleted = clockA.tick()
    const editFile = movFile('deviceb', '2026-08', [
      { op: 'put', hlc: edited, basedOn: created, mov: movimiento({ monto: 300 }) },
    ])
    const deleteFile = movFile('devicea', '2026-08', [
      { op: 'del', hlc: deleted, basedOn: edited, id: 'm1' },
    ])
    const { items, revivedIds } = replayMovimientos([editFile, deleteFile])
    expect(items).toEqual([])
    expect(revivedIds).toEqual([])
  })

  it('two concurrent edits: plain last-hlc-wins, no revival machinery involved', () => {
    const { a: clockA, b: clockB } = makeClocks()
    const created = clockA.tick()
    const editA = clockA.tick()
    const editB = clockB.tick()
    const files = [
      movFile('devicea', '2026-08', [
        { op: 'put', hlc: created, basedOn: null, mov: movimiento() },
        { op: 'put', hlc: editA, basedOn: created, mov: movimiento({ monto: 111 }) },
      ]),
      movFile('deviceb', '2026-08', [
        { op: 'put', hlc: editB, basedOn: created, mov: movimiento({ monto: 222 }) },
      ]),
    ]
    const { items } = replayMovimientos(files)
    // Whichever hlc actually sorts last wins — assert against the real order
    // rather than assuming which device's tick happened to be greater.
    const expected = editA > editB ? 111 : 222
    expect(items[0]?.monto).toBe(expected)
  })

  it('a delete followed by a later, sequential re-put revives normally (not the concurrent path)', () => {
    const { a: clockA } = makeClocks()
    const created = clockA.tick()
    const deleted = clockA.tick()
    const recreated = clockA.tick()
    const file = movFile('devicea', '2026-08', [
      { op: 'put', hlc: created, basedOn: null, mov: movimiento() },
      { op: 'del', hlc: deleted, basedOn: created, id: 'm1' },
      { op: 'put', hlc: recreated, basedOn: deleted, mov: movimiento({ monto: 999 }) },
    ])
    const { items, revivedIds } = replayMovimientos([file])
    expect(items).toEqual([movimiento({ monto: 999 })])
    expect(revivedIds).toEqual([])
  })

  it('nothing is discarded: nonexistent movements from an unrelated id are untouched by another id’s conflict', () => {
    const { a: clockA } = makeClocks()
    const hlc1 = clockA.tick()
    const hlc2 = clockA.tick()
    const file = movFile('devicea', '2026-08', [
      { op: 'put', hlc: hlc1, basedOn: null, mov: movimiento({ id: 'm1' }) },
      { op: 'put', hlc: hlc2, basedOn: null, mov: movimiento({ id: 'm2', monto: 50 }) },
    ])
    const { items } = replayMovimientos([file])
    expect(items).toHaveLength(2)
    expect(items.map((m) => m.id).toSorted()).toEqual(['m1', 'm2'])
  })

  it('an empty set of files replays to no movements', () => {
    expect(replayMovimientos([]).items).toEqual([])
  })
})

describe('replayActivos', () => {
  const activo = (overrides: Partial<Activo> = {}): Activo => ({
    id: 'a1',
    nombre: 'CDT',
    tipo: 'CDT',
    valorActual: 1000,
    moneda: 'COP',
    fechaActualizacion: '2026-08-01',
    ...overrides,
  })

  it('replays put/del the same way movimientos do', () => {
    const { a: clockA } = makeClocks()
    const created = clockA.tick()
    const deleted = clockA.tick()
    const file: ActOpFile = {
      v: 1,
      device: 'devicea',
      ops: [
        { op: 'put', hlc: created, basedOn: null, act: activo() },
        { op: 'del', hlc: deleted, basedOn: created, id: 'a1' },
      ],
    }
    expect(replayActivos([file]).items).toEqual([])
  })
})

describe('replayConfig', () => {
  it('last-write-wins across device files (a whole-object-put gap, known and not fixed here)', () => {
    const { a: clockA, b: clockB } = makeClocks()
    const t1 = clockA.tick()
    const t2 = clockB.tick()
    const configA: Config = { ...CONFIG_SEMILLA, secciones: [] }
    const configB: Config = { ...CONFIG_SEMILLA, secciones: CONFIG_SEMILLA.secciones }
    const fileA: ConfigOpFile = {
      v: 1,
      device: 'devicea',
      ops: [{ op: 'put', hlc: t1, basedOn: null, config: configA }],
    }
    const fileB: ConfigOpFile = {
      v: 1,
      device: 'deviceb',
      ops: [{ op: 'put', hlc: t2, basedOn: null, config: configB }],
    }
    const { config } = replayConfig([fileA, fileB])
    const expected = t1 > t2 ? configA : configB
    expect(config).toEqual(expected)
  })

  it('no files means no config', () => {
    expect(replayConfig([]).config).toBeUndefined()
  })
})

describe('filenames', () => {
  it('round-trips every file kind through parseDriveFilename', () => {
    expect(parseDriveFilename(buildMovMonthFilename('pj7k', '2026-08'))).toEqual({
      kind: 'mov-month',
      device: 'pj7k',
      periodo: '2026-08',
    })
    expect(parseDriveFilename(buildMovYearFilename('pj7k', '2026'))).toEqual({
      kind: 'mov-year',
      device: 'pj7k',
      periodo: '2026',
    })
    expect(parseDriveFilename(buildActFilename('pj7k'))).toEqual({ kind: 'act', device: 'pj7k' })
    expect(parseDriveFilename(buildConfigFilename('pj7k'))).toEqual({
      kind: 'config',
      device: 'pj7k',
    })
    expect(parseDriveFilename(buildYearlyCsvFilename('2026'))).toEqual({
      kind: 'csv',
      periodo: '2026',
    })
    expect(parseDriveFilename(leemeFilename())).toEqual({ kind: 'leeme' })
  })

  it('an unrecognized name is "unknown", never thrown — edge case: ignored, never deleted', () => {
    expect(parseDriveFilename('some-users-random-file.txt').kind).toBe('unknown')
    expect(parseDriveFilename('mov-pj7k.json').kind).toBe('unknown')
    expect(parseDriveFilename('config.json').kind).toBe('unknown') // the old fixed-file layout's own name
  })
})

describe('periodo helpers', () => {
  it('currentPeriodo/currentYear use local calendar time, zero-padded', () => {
    const date = new Date(2026, 2, 5) // March 5 2026, local
    expect(currentPeriodo(date)).toBe('2026-03')
    expect(currentYear(date)).toBe('2026')
  })

  it('yearOfPeriodo takes the year prefix of a YYYY-MM periodo', () => {
    expect(yearOfPeriodo('2026-08')).toBe('2026')
  })
})
