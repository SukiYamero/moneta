import type { CategoryIconKey } from '@/lib/categoryIconKeys'
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
import type { SupportedLocale } from '@/lib/i18n/resources'

export const SCHEMA_VERSION = 2

export type Moneda = 'COP' | 'USD' | 'MXN' | 'ARS' | 'BRL' | 'PEN'
export type TipoMovimiento = 'ingreso' | 'gasto'
export type Metodo = 'efectivo' | 'debito' | 'credito' | 'banco'

export type TipoActivo =
  | 'CDT'
  | 'FIC'
  | 'cuenta_alto_rendimiento'
  | 'acciones'
  | 'cripto'
  | 'bonos'
  | 'inmueble'
  | 'otro'

export interface Movimiento {
  id: string
  fecha: string
  categoria: string
  tipo: TipoMovimiento
  monto: number
  moneda: Moneda
  metodo?: Metodo
  nota?: string
  createdAt: string
  extra?: Record<string, unknown>
}

export interface Activo {
  id: string
  nombre: string
  tipo: TipoActivo
  capitalInvertido?: number
  valorActual: number
  moneda: Moneda
  fechaActualizacion: string
  nota?: string
  extra?: Record<string, unknown>
}

export interface Categoria {
  id: string
  nombre: string
  padreId?: string
  icono?: CategoryIconKey
  color?: IconAvatarTint
  archivado?: boolean
  presupuesto?: number
}

export interface Preferencias {
  tema: 'claro' | 'oscuro' | 'sistema'
  monedaPrincipal: Moneda
  primerDiaSemana: 0 | 1
  idioma?: SupportedLocale
}

export interface Config {
  schemaVersion: number
  categorias: Categoria[]
  preferencias: Preferencias
}

export type Periodo = 'dia' | 'semana' | 'mes' | 'anio'

export const CONFIG_SEMILLA: Config = {
  schemaVersion: SCHEMA_VERSION,
  categorias: [
    {
      id: 'cat_sueldo',
      nombre: 'Sueldo',
      icono: 'briefcase',
      color: 'emerald',
    },
    {
      id: 'cat_servicios',
      nombre: 'Servicios',
      icono: 'receipt',
      color: 'blue',
    },
    {
      id: 'cat_ventas',
      nombre: 'Ventas',
      icono: 'trending-up',
      color: 'emerald',
    },
    {
      id: 'cat_impuestos',
      nombre: 'Impuestos',
      icono: 'landmark',
      color: 'rose',
    },
    {
      id: 'cat_caja_menor',
      nombre: 'Caja menor',
      icono: 'wallet',
      color: 'amber',
    },
  ],
  preferencias: {
    tema: 'sistema',
    monedaPrincipal: 'COP',
    primerDiaSemana: 1,
  },
}
