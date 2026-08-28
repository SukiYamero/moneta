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

export const CATEGORIAS_SEMILLA = [
  { id: 'cat_comida', nombre: 'Comida', icono: 'utensils', color: 'amber' },
  {
    id: 'cat_supermercado',
    nombre: 'Supermercado',
    padreId: 'cat_comida',
    icono: 'shopping-cart',
    color: 'amber',
  },
  {
    id: 'cat_restaurante',
    nombre: 'Restaurante',
    padreId: 'cat_comida',
    icono: 'chef-hat',
    color: 'amber',
  },
  { id: 'cat_cafe', nombre: 'Café', padreId: 'cat_comida', icono: 'coffee', color: 'amber' },
  {
    id: 'cat_domicilios',
    nombre: 'Domicilios',
    padreId: 'cat_comida',
    icono: 'package',
    color: 'amber',
  },

  { id: 'cat_transporte', nombre: 'Transporte', icono: 'car', color: 'blue' },
  {
    id: 'cat_gasolina',
    nombre: 'Gasolina',
    padreId: 'cat_transporte',
    icono: 'fuel',
    color: 'blue',
  },
  { id: 'cat_taxi', nombre: 'Taxi', padreId: 'cat_transporte', icono: 'car', color: 'blue' },
  {
    id: 'cat_transporte_publico',
    nombre: 'Transporte público',
    padreId: 'cat_transporte',
    icono: 'bus',
    color: 'blue',
  },
  {
    id: 'cat_parqueadero',
    nombre: 'Parqueadero',
    padreId: 'cat_transporte',
    icono: 'parking',
    color: 'blue',
  },

  { id: 'cat_hogar', nombre: 'Hogar', icono: 'house', color: 'purple' },
  {
    id: 'cat_arriendo',
    nombre: 'Arriendo',
    padreId: 'cat_hogar',
    icono: 'building-2',
    color: 'purple',
  },
  {
    id: 'cat_servicios',
    nombre: 'Servicios',
    padreId: 'cat_hogar',
    icono: 'receipt',
    color: 'purple',
  },
  {
    id: 'cat_internet',
    nombre: 'Internet',
    padreId: 'cat_hogar',
    icono: 'wifi',
    color: 'purple',
  },
  {
    id: 'cat_reparaciones',
    nombre: 'Reparaciones',
    padreId: 'cat_hogar',
    icono: 'hammer',
    color: 'purple',
  },

  { id: 'cat_compras', nombre: 'Compras', icono: 'shopping-bag', color: 'rose' },
  { id: 'cat_ropa', nombre: 'Ropa', padreId: 'cat_compras', icono: 'shirt', color: 'rose' },
  {
    id: 'cat_electronica',
    nombre: 'Electrónica',
    padreId: 'cat_compras',
    icono: 'laptop',
    color: 'rose',
  },
  { id: 'cat_muebles', nombre: 'Muebles', padreId: 'cat_compras', icono: 'sofa', color: 'rose' },
  {
    id: 'cat_varios',
    nombre: 'Varios',
    padreId: 'cat_compras',
    icono: 'package',
    color: 'rose',
  },

  { id: 'cat_salud', nombre: 'Salud', icono: 'heart-pulse', color: 'success' },
  {
    id: 'cat_medico',
    nombre: 'Médico',
    padreId: 'cat_salud',
    icono: 'stethoscope',
    color: 'success',
  },
  {
    id: 'cat_farmacia',
    nombre: 'Farmacia',
    padreId: 'cat_salud',
    icono: 'pill',
    color: 'success',
  },
  {
    id: 'cat_gimnasio',
    nombre: 'Gimnasio',
    padreId: 'cat_salud',
    icono: 'dumbbell',
    color: 'success',
  },
  {
    id: 'cat_seguro',
    nombre: 'Seguro',
    padreId: 'cat_salud',
    icono: 'shield',
    color: 'success',
  },

  { id: 'cat_ocio', nombre: 'Ocio', icono: 'ticket', color: 'info' },
  { id: 'cat_cine', nombre: 'Cine', padreId: 'cat_ocio', icono: 'film', color: 'info' },
  {
    id: 'cat_streaming',
    nombre: 'Streaming',
    padreId: 'cat_ocio',
    icono: 'tv',
    color: 'info',
  },
  {
    id: 'cat_salidas',
    nombre: 'Salidas',
    padreId: 'cat_ocio',
    icono: 'party-popper',
    color: 'info',
  },
  { id: 'cat_juegos', nombre: 'Juegos', padreId: 'cat_ocio', icono: 'gamepad', color: 'info' },

  { id: 'cat_educacion', nombre: 'Educación', icono: 'graduation-cap', color: 'amber' },
  {
    id: 'cat_cursos',
    nombre: 'Cursos',
    padreId: 'cat_educacion',
    icono: 'school',
    color: 'amber',
  },
  { id: 'cat_libros', nombre: 'Libros', padreId: 'cat_educacion', icono: 'book', color: 'amber' },
  {
    id: 'cat_colegio',
    nombre: 'Colegio',
    padreId: 'cat_educacion',
    icono: 'building-2',
    color: 'amber',
  },

  {
    id: 'cat_cuidado_personal',
    nombre: 'Cuidado personal',
    icono: 'sparkles',
    color: 'blue',
  },
  {
    id: 'cat_peluqueria',
    nombre: 'Peluquería',
    padreId: 'cat_cuidado_personal',
    icono: 'scissors',
    color: 'blue',
  },
  {
    id: 'cat_belleza',
    nombre: 'Belleza',
    padreId: 'cat_cuidado_personal',
    icono: 'palette',
    color: 'blue',
  },
  {
    id: 'cat_lavanderia',
    nombre: 'Lavandería',
    padreId: 'cat_cuidado_personal',
    icono: 'washing-machine',
    color: 'blue',
  },

  { id: 'cat_mascotas', nombre: 'Mascotas', icono: 'paw', color: 'purple' },
  {
    id: 'cat_comida_mascota',
    nombre: 'Comida de mascota',
    padreId: 'cat_mascotas',
    icono: 'shopping-cart',
    color: 'purple',
  },
  {
    id: 'cat_veterinario',
    nombre: 'Veterinario',
    padreId: 'cat_mascotas',
    icono: 'stethoscope',
    color: 'purple',
  },
  {
    id: 'cat_accesorios_mascota',
    nombre: 'Accesorios',
    padreId: 'cat_mascotas',
    icono: 'shopping-bag',
    color: 'purple',
  },

  { id: 'cat_viajes', nombre: 'Viajes', icono: 'luggage', color: 'rose' },
  { id: 'cat_vuelos', nombre: 'Vuelos', padreId: 'cat_viajes', icono: 'plane', color: 'rose' },
  {
    id: 'cat_hospedaje',
    nombre: 'Hospedaje',
    padreId: 'cat_viajes',
    icono: 'hotel',
    color: 'rose',
  },
  { id: 'cat_paseos', nombre: 'Paseos', padreId: 'cat_viajes', icono: 'ticket', color: 'rose' },

  { id: 'cat_finanzas', nombre: 'Finanzas', icono: 'calculator', color: 'danger' },
  {
    id: 'cat_impuestos',
    nombre: 'Impuestos',
    padreId: 'cat_finanzas',
    icono: 'landmark',
    color: 'danger',
  },
  {
    id: 'cat_comisiones',
    nombre: 'Comisiones',
    padreId: 'cat_finanzas',
    icono: 'percent',
    color: 'danger',
  },
  {
    id: 'cat_ahorro',
    nombre: 'Ahorro',
    padreId: 'cat_finanzas',
    icono: 'piggy-bank',
    color: 'danger',
  },
  {
    id: 'cat_deuda',
    nombre: 'Deuda',
    padreId: 'cat_finanzas',
    icono: 'credit-card',
    color: 'danger',
  },
  {
    id: 'cat_caja_menor',
    nombre: 'Caja menor',
    padreId: 'cat_finanzas',
    icono: 'wallet',
    color: 'danger',
  },

  { id: 'cat_ingresos', nombre: 'Ingresos', icono: 'banknote', color: 'emerald' },
  {
    id: 'cat_sueldo',
    nombre: 'Sueldo',
    padreId: 'cat_ingresos',
    icono: 'briefcase',
    color: 'emerald',
  },
  {
    id: 'cat_freelance',
    nombre: 'Freelance',
    padreId: 'cat_ingresos',
    icono: 'laptop',
    color: 'emerald',
  },
  {
    id: 'cat_ventas',
    nombre: 'Ventas',
    padreId: 'cat_ingresos',
    icono: 'trending-up',
    color: 'emerald',
  },
  {
    id: 'cat_regalo',
    nombre: 'Regalo',
    padreId: 'cat_ingresos',
    icono: 'gift',
    color: 'emerald',
  },
  {
    id: 'cat_reembolso',
    nombre: 'Reembolso',
    padreId: 'cat_ingresos',
    icono: 'hand-coins',
    color: 'emerald',
  },
] as const satisfies readonly Categoria[]

export type CategoriaSeedId = (typeof CATEGORIAS_SEMILLA)[number]['id']

export const CONFIG_SEMILLA: Config = {
  schemaVersion: SCHEMA_VERSION,
  categorias: [...CATEGORIAS_SEMILLA],
  preferencias: {
    tema: 'sistema',
    monedaPrincipal: 'COP',
    primerDiaSemana: 1,
  },
}
