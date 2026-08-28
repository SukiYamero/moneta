import type { Activo, Config, Movimiento } from '@/lib/schema'

export type EntityId = string

export interface ListQuery<T> {
  dateFrom?: string
  dateTo?: string
  sortBy?: keyof T
  sortDir?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}

export interface ListResult<T> {
  items: T[]
  nextCursor?: string
}

export interface CrudRepo<T extends { id: EntityId }> {
  list(query?: ListQuery<T>): Promise<ListResult<T>>
  get(id: EntityId): Promise<T | undefined>
  add(item: T): Promise<T>
  addMany(items: T[]): Promise<T[]>
  update(id: EntityId, patch: Partial<Omit<T, 'id'>>): Promise<T>
  remove(id: EntityId): Promise<void>
  removeMany(ids: EntityId[]): Promise<void>
}

export type RepoErrorCode =
  | 'not_found'
  | 'schema_mismatch'
  | 'invalid_input'
  | 'network'
  | 'unknown'

export class RepoError extends Error {
  readonly code: RepoErrorCode

  constructor(message: string, code: RepoErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepoError'
    this.code = code
  }
}

export interface Repo {
  ready(): Promise<void>
  movimientos: CrudRepo<Movimiento>
  activos: CrudRepo<Activo>
  getConfig(): Promise<Config>
  updateConfig(patch: Partial<Config>): Promise<Config>
}
