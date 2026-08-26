import type { CategoryIconKey } from '@/lib/categoryIconKeys'
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
import type { SupportedLocale } from '@/lib/i18n/resources'

export const SCHEMA_VERSION = 1

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
  seccion: string
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
  seccion?: string
  capitalInvertido?: number
  valorActual: number
  moneda: Moneda
  fechaActualizacion: string
  nota?: string
  extra?: Record<string, unknown>
}

export interface Seccion {
  id: string
  nombre: string
  orden: number
}

export interface Categoria {
  id: string
  nombre: string
  seccionId: string
  tipo: TipoMovimiento
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
  secciones: Seccion[]
  categorias: Categoria[]
  preferencias: Preferencias
}

export type Periodo = 'dia' | 'semana' | 'mes' | 'anio'

export const CONFIG_SEMILLA: Config = {
  schemaVersion: SCHEMA_VERSION,
  secciones: [
    { id: 'sec_personal', nombre: 'Personal', orden: 0 },
    { id: 'sec_trabajo', nombre: 'Trabajo', orden: 1 },
    { id: 'sec_emprendimiento', nombre: 'Emprendimiento', orden: 2 },
  ],
  categorias: [
    {
      id: 'cat_sueldo',
      nombre: 'Sueldo',
      seccionId: 'sec_personal',
      tipo: 'ingreso',
      icono: 'briefcase',
      color: 'emerald',
    },
    {
      id: 'cat_servicios',
      nombre: 'Servicios',
      seccionId: 'sec_personal',
      tipo: 'gasto',
      icono: 'receipt',
      color: 'blue',
    },
    {
      id: 'cat_ventas',
      nombre: 'Ventas',
      seccionId: 'sec_emprendimiento',
      tipo: 'ingreso',
      icono: 'trending-up',
      color: 'emerald',
    },
    {
      id: 'cat_impuestos',
      nombre: 'Impuestos',
      seccionId: 'sec_emprendimiento',
      tipo: 'gasto',
      icono: 'landmark',
      color: 'rose',
    },
    {
      id: 'cat_caja_menor',
      nombre: 'Caja menor',
      seccionId: 'sec_emprendimiento',
      tipo: 'gasto',
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
