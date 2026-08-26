import { format, parseISO, subDays } from 'date-fns'
import type { Activo, Categoria, Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { CrudRepo, EntityId, ListQuery, ListResult, Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'

const FAKE_CATEGORIAS: Categoria[] = [
  ...CONFIG_SEMILLA.categorias,
  {
    id: 'cat_comida',
    nombre: 'Comida',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'utensils',
    color: 'amber',
  },
  {
    id: 'cat_transporte',
    nombre: 'Transporte',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'car',
    color: 'blue',
  },
  {
    id: 'cat_compras',
    nombre: 'Compras',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'shopping-bag',
    color: 'purple',
  },
  {
    id: 'cat_ocio',
    nombre: 'Ocio',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'party-popper',
    color: 'rose',
  },
  {
    id: 'cat_salud',
    nombre: 'Salud',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'heart-pulse',
    color: 'emerald',
  },
  {
    id: 'cat_hogar',
    nombre: 'Hogar',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'house',
    color: 'emerald',
  },
  {
    id: 'cat_regalo',
    nombre: 'Regalo',
    seccionId: 'sec_personal',
    tipo: 'ingreso',
    icono: 'gift',
    color: 'purple',
  },
  {
    id: 'cat_freelance',
    nombre: 'Freelance',
    seccionId: 'sec_trabajo',
    tipo: 'ingreso',
    icono: 'laptop',
    color: 'blue',
  },
]

const FAKE_CONFIG: Config = {
  ...CONFIG_SEMILLA,
  categorias: FAKE_CATEGORIAS,
}

interface MovimientoTemplate {
  offsetDays: number
  seccion: string
  categoria: string
  tipo: Movimiento['tipo']
  monto: number
  metodo?: Movimiento['metodo']
  nota?: string
}

const MOVIMIENTO_TEMPLATES: MovimientoTemplate[] = [
  {
    offsetDays: 0,
    seccion: 'sec_personal',
    categoria: 'cat_comida',
    tipo: 'gasto',
    monto: 18000,
    metodo: 'debito',
    nota: 'Café de la mañana',
  },
  {
    offsetDays: 1,
    seccion: 'sec_personal',
    categoria: 'cat_compras',
    tipo: 'gasto',
    monto: 245000,
    metodo: 'debito',
    nota: 'Supermercado',
  },
  {
    offsetDays: 1,
    seccion: 'sec_personal',
    categoria: 'cat_transporte',
    tipo: 'gasto',
    monto: 48000,
    metodo: 'efectivo',
    nota: 'Uber al trabajo',
  },
  {
    offsetDays: 3,
    seccion: 'sec_personal',
    categoria: 'cat_ocio',
    tipo: 'gasto',
    monto: 63000,
    metodo: 'credito',
    nota: 'Netflix',
  },
  {
    offsetDays: 5,
    seccion: 'sec_emprendimiento',
    categoria: 'cat_ventas',
    tipo: 'ingreso',
    monto: 1800000,
    metodo: 'banco',
    nota: 'Proyecto freelance',
  },
  {
    offsetDays: 7,
    seccion: 'sec_personal',
    categoria: 'cat_transporte',
    tipo: 'gasto',
    monto: 180000,
    metodo: 'efectivo',
    nota: 'Gasolina',
  },
  {
    offsetDays: 9,
    seccion: 'sec_personal',
    categoria: 'cat_comida',
    tipo: 'gasto',
    monto: 154000,
    metodo: 'debito',
    nota: 'Cena con amigos',
  },
  {
    offsetDays: 11,
    seccion: 'sec_personal',
    categoria: 'cat_regalo',
    tipo: 'ingreso',
    monto: 400000,
    metodo: 'efectivo',
    nota: 'Regalo cumpleaños',
  },
  {
    offsetDays: 14,
    seccion: 'sec_personal',
    categoria: 'cat_compras',
    tipo: 'gasto',
    monto: 356000,
    metodo: 'credito',
    nota: 'Ropa nueva',
  },
  {
    offsetDays: 15,
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 4200000,
    metodo: 'banco',
    nota: 'Salario',
  },
  {
    offsetDays: 18,
    seccion: 'sec_personal',
    categoria: 'cat_ocio',
    tipo: 'gasto',
    monto: 96000,
    metodo: 'debito',
    nota: 'Cine',
  },
  {
    offsetDays: 21,
    seccion: 'sec_personal',
    categoria: 'cat_salud',
    tipo: 'gasto',
    monto: 75000,
    metodo: 'efectivo',
    nota: 'Farmacia',
  },
  {
    offsetDays: 23,
    seccion: 'sec_emprendimiento',
    categoria: 'cat_ventas',
    tipo: 'ingreso',
    monto: 1280000,
    metodo: 'banco',
    nota: 'Anticipo proyecto',
  },
  {
    offsetDays: 25,
    seccion: 'sec_emprendimiento',
    categoria: 'cat_impuestos',
    tipo: 'gasto',
    monto: 320000,
    metodo: 'banco',
    nota: 'Retención en la fuente',
  },
  {
    offsetDays: 28,
    seccion: 'sec_emprendimiento',
    categoria: 'cat_caja_menor',
    tipo: 'gasto',
    monto: 45000,
    metodo: 'efectivo',
    nota: 'Insumos oficina',
  },
  {
    offsetDays: 30,
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 4200000,
    metodo: 'banco',
    nota: 'Salario',
  },
  {
    offsetDays: 33,
    seccion: 'sec_personal',
    categoria: 'cat_hogar',
    tipo: 'gasto',
    monto: 850000,
    metodo: 'banco',
    nota: 'Renta',
  },
  {
    offsetDays: 36,
    seccion: 'sec_personal',
    categoria: 'cat_compras',
    tipo: 'gasto',
    monto: 240600,
    metodo: 'debito',
    nota: 'Supermercado',
  },
  {
    offsetDays: 42,
    seccion: 'sec_personal',
    categoria: 'cat_comida',
    tipo: 'gasto',
    monto: 58000,
    metodo: 'debito',
    nota: 'Restaurante',
  },
  {
    offsetDays: 45,
    seccion: 'sec_personal',
    categoria: 'cat_ocio',
    tipo: 'gasto',
    monto: 43600,
    metodo: 'credito',
    nota: 'Spotify',
  },
  {
    offsetDays: 48,
    seccion: 'sec_trabajo',
    categoria: 'cat_freelance',
    tipo: 'ingreso',
    monto: 780000,
    metodo: 'banco',
    nota: 'Freelance UI',
  },
  {
    offsetDays: 51,
    seccion: 'sec_personal',
    categoria: 'cat_transporte',
    tipo: 'gasto',
    monto: 52000,
    metodo: 'efectivo',
    nota: 'Gasolina',
  },
  {
    offsetDays: 54,
    seccion: 'sec_personal',
    categoria: 'cat_salud',
    tipo: 'gasto',
    monto: 31400,
    metodo: 'efectivo',
    nota: 'Farmacia',
  },
  {
    offsetDays: 60,
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 4200000,
    metodo: 'banco',
    nota: 'Salario',
  },
  {
    offsetDays: 68,
    seccion: 'sec_personal',
    categoria: 'cat_compras',
    tipo: 'gasto',
    monto: 540000,
    metodo: 'credito',
    nota: 'Black Friday',
  },
  {
    offsetDays: 78,
    seccion: 'sec_personal',
    categoria: 'cat_transporte',
    tipo: 'gasto',
    monto: 180000,
    metodo: 'banco',
    nota: 'Seguro auto',
  },
  {
    offsetDays: 90,
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 4200000,
    metodo: 'banco',
    nota: 'Salario',
  },
  {
    offsetDays: 95,
    seccion: 'sec_personal',
    categoria: 'cat_comida',
    tipo: 'gasto',
    monto: 95000,
    metodo: 'debito',
    nota: 'Cena de fin de año',
  },
  {
    offsetDays: 120,
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 1600000,
    metodo: 'banco',
    nota: 'Aguinaldo',
  },
]

const seedMovimientos = (today: Date): Movimiento[] => {
  return MOVIMIENTO_TEMPLATES.map((t, index) => {
    const at = subDays(today, t.offsetDays)
    return {
      id: `mov_seed_${index}`,
      fecha: format(at, 'yyyy-MM-dd'),
      createdAt: at.toISOString(),
      seccion: t.seccion,
      categoria: t.categoria,
      tipo: t.tipo,
      monto: t.monto,
      moneda: 'COP',
      metodo: t.metodo,
      nota: t.nota,
    }
  })
}

const seedActivos = (today: Date): Activo[] => {
  const fechaActualizacion = (offsetDays: number) =>
    format(subDays(today, offsetDays), 'yyyy-MM-dd')
  return [
    {
      id: 'act_seed_0',
      nombre: 'CDT Bancolombia',
      tipo: 'CDT',
      seccion: 'sec_personal',
      capitalInvertido: 5000000,
      valorActual: 5320000,
      moneda: 'COP',
      fechaActualizacion: fechaActualizacion(5),
    },
    {
      id: 'act_seed_1',
      nombre: 'Acciones Ecopetrol',
      tipo: 'acciones',
      seccion: 'sec_personal',
      capitalInvertido: 2000000,
      valorActual: 1840000,
      moneda: 'COP',
      fechaActualizacion: fechaActualizacion(2),
    },
    {
      id: 'act_seed_2',
      nombre: 'Cripto (BTC)',
      tipo: 'cripto',
      seccion: 'sec_emprendimiento',
      capitalInvertido: 1200000,
      valorActual: 1560000,
      moneda: 'COP',
      fechaActualizacion: fechaActualizacion(1),
    },
  ]
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_RE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const validateMovimiento = (m: Movimiento): void => {
  if (!Number.isFinite(m.monto) || m.monto <= 0) {
    throw new RepoError(`monto must be a finite, positive number (got ${m.monto})`, 'invalid_input')
  }
  if (!isValidIsoDate(m.fecha)) {
    throw new RepoError(`fecha must be ISO "yyyy-mm-dd" (got "${m.fecha}")`, 'invalid_input')
  }
  if (!m.moneda) {
    throw new RepoError('moneda is required', 'invalid_input')
  }
}

const validateActivo = (a: Activo): void => {
  if (!isValidIsoDate(a.fechaActualizacion)) {
    throw new RepoError(
      `fechaActualizacion must be ISO "yyyy-mm-dd" (got "${a.fechaActualizacion}")`,
      'invalid_input',
    )
  }
  if (!a.moneda) {
    throw new RepoError('moneda is required', 'invalid_input')
  }
  if (!Number.isFinite(a.valorActual) || a.valorActual < 0) {
    throw new RepoError(
      `valorActual must be a finite, non-negative number (got ${a.valorActual})`,
      'invalid_input',
    )
  }
}

const compareValues = (a: unknown, b: unknown): number => {
  if (a === b) return 0
  if (a === undefined || a === null) return -1
  if (b === undefined || b === null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const sa = String(a)
  const sb = String(b)
  if (sa < sb) return -1
  if (sa > sb) return 1
  return 0
}

const makeComparator = <T extends { id: EntityId }>(
  sortBy: keyof T,
  sortDir: 'asc' | 'desc',
  tiebreakField: (keyof T & string) | undefined,
): ((a: T, b: T) => number) => {
  const dirMul = sortDir === 'asc' ? 1 : -1
  return (a, b) => {
    const primary = compareValues(a[sortBy], b[sortBy]) * dirMul
    if (primary !== 0) return primary
    if (tiebreakField) {
      const secondary = compareValues(a[tiebreakField], b[tiebreakField]) * dirMul
      if (secondary !== 0) return secondary
    }
    return compareValues(a.id, b.id) * dirMul
  }
}

const decodeCursor = (cursor: string | undefined): number => {
  if (cursor === undefined) return 0
  const index = Number(cursor)
  if (!Number.isInteger(index) || index < 0) {
    throw new RepoError(`invalid pagination cursor "${cursor}"`, 'invalid_input')
  }
  return index
}

const validateLimit = (limit: number | undefined): void => {
  if (limit === undefined) return
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RepoError(`limit must be a positive integer (got ${limit})`, 'invalid_input')
  }
}

const paginate = <T>(items: T[], limit?: number, cursor?: string): ListResult<T> => {
  validateLimit(limit)
  const start = decodeCursor(cursor)
  if (limit === undefined) return { items: items.slice(start) }
  const pageItems = items.slice(start, start + limit)
  const nextIndex = start + limit
  return {
    items: pageItems,
    nextCursor: nextIndex < items.length ? String(nextIndex) : undefined,
  }
}

interface CrudRepoConfig<T> {
  dateField: keyof T & string
  seccionField?: keyof T & string
  tiebreakField?: keyof T & string
  validate: (item: T) => void
}

const createCrudRepo = <T extends { id: EntityId }>(
  seed: T[],
  config: CrudRepoConfig<T>,
): CrudRepo<T> => {
  let store = [...seed]
  const { dateField, seccionField, tiebreakField, validate } = config

  const applyFilters = (query: ListQuery<T> | undefined): T[] => {
    const { dateFrom, dateTo, seccion } = query ?? {}
    return store.filter((item) => {
      if (dateFrom !== undefined && String(item[dateField]) < dateFrom) return false
      if (dateTo !== undefined && String(item[dateField]) > dateTo) return false
      if (seccionField && seccion !== undefined && item[seccionField] !== seccion) return false
      return true
    })
  }

  const sortItems = (items: T[], query: ListQuery<T> | undefined): T[] => {
    const sortBy = query?.sortBy ?? dateField
    const sortDir = query?.sortDir ?? 'desc'
    return items.toSorted(makeComparator<T>(sortBy, sortDir, tiebreakField))
  }

  return {
    async list(query) {
      const filtered = applyFilters(query)
      const sorted = sortItems(filtered, query)
      return paginate(sorted, query?.limit, query?.cursor)
    },
    async get(id) {
      const found = store.find((item) => item.id === id)
      return found ? { ...found } : undefined
    },
    async add(item) {
      validate(item)
      if (store.some((existing) => existing.id === item.id)) {
        throw new RepoError(`id "${item.id}" already exists`, 'invalid_input')
      }
      const fresh = { ...item }
      store = [...store, fresh]
      return { ...fresh }
    },
    async addMany(items) {
      items.forEach((item) => validate(item))
      const existingIds = new Set(store.map((item) => item.id))
      const seenInBatch = new Set<EntityId>()
      for (const item of items) {
        if (existingIds.has(item.id)) {
          throw new RepoError(`id "${item.id}" already exists`, 'invalid_input')
        }
        if (seenInBatch.has(item.id)) {
          throw new RepoError(`duplicate id "${item.id}" in addMany batch`, 'invalid_input')
        }
        seenInBatch.add(item.id)
      }
      const fresh = items.map((item) => ({ ...item }))
      store = [...store, ...fresh]
      return fresh.map((item) => ({ ...item }))
    },
    async update(id, patch) {
      const existing = store.find((item) => item.id === id)
      if (!existing) throw new RepoError(`Not found: ${id}`, 'not_found')
      const updated = { ...existing, ...patch, id } as T
      validate(updated)
      store = store.map((item) => (item.id === id ? updated : item))
      return { ...updated }
    },
    async remove(id) {
      if (!store.some((item) => item.id === id)) {
        throw new RepoError(`Not found: ${id}`, 'not_found')
      }
      store = store.filter((item) => item.id !== id)
    },
    async removeMany(ids) {
      const idsToRemove = new Set(ids)
      for (const id of idsToRemove) {
        if (!store.some((item) => item.id === id)) {
          throw new RepoError(`Not found: ${id}`, 'not_found')
        }
      }
      store = store.filter((item) => !idsToRemove.has(item.id))
    },
  }
}

export interface CreateFakeRepoOptions {
  today?: Date
}

export const createFakeRepo = ({ today = new Date() }: CreateFakeRepoOptions = {}): Repo => {
  let config: Config = { ...FAKE_CONFIG }

  const movimientos = createCrudRepo<Movimiento>(seedMovimientos(today), {
    dateField: 'fecha',
    seccionField: 'seccion',
    tiebreakField: 'createdAt',
    validate: validateMovimiento,
  })

  const activos = createCrudRepo<Activo>(seedActivos(today), {
    dateField: 'fechaActualizacion',
    seccionField: 'seccion',
    validate: validateActivo,
  })

  return {
    async ready() {
      if (config.schemaVersion !== FAKE_CONFIG.schemaVersion) {
        throw new RepoError('Unexpected fake config schemaVersion', 'schema_mismatch')
      }
    },
    movimientos,
    activos,
    async getConfig() {
      return structuredClone(config)
    },
    async updateConfig(patch) {
      if (patch.schemaVersion !== undefined) {
        throw new RepoError(
          'schemaVersion is not caller-writable via updateConfig',
          'invalid_input',
        )
      }
      config = { ...config, ...patch }
      return structuredClone(config)
    },
  }
}

const FAKE_REPO_SEED_DATE = parseISO('2026-08-18')

export const fakeRepo: Repo = createFakeRepo({ today: FAKE_REPO_SEED_DATE })
