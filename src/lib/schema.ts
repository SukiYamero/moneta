// schema.ts — modelo de datos de la app de finanzas
//
// Este archivo ES el esquema: el contrato estable que el resto de la app importa.
// Regla de oro: subí SCHEMA_VERSION solo ante cambios ESTRUCTURALES (renombrar,
// partir o borrar un campo). Agregar algo opcional o meterlo en `extra` no cuenta.

// Type-only imports (erased at compile time, verbatimModuleSyntax) from two
// lib-level leaves — never from a feature or component file, which would
// invert this module's own "the rest of the app imports schema.ts, not the
// other way around" rule (AGENTS.md). `@/components/shared/categoryIcons`
// pairs `CategoryIconKey` with its actual `LucideIcon`s and re-exports the
// type from here; `IconAvatar.tsx` does the same for `IconAvatarTint`
// (specs.md §10.22 Decision 2, corrected §11 2026-08-20).
import type { CategoryIconKey } from '@/lib/categoryIconKeys'
import type { IconAvatarTint } from '@/lib/iconAvatarTint'
import type { SupportedLocale } from '@/lib/i18n/resources'

export const SCHEMA_VERSION = 1

// --- tipos base / enums ---

export type Moneda = 'COP' | 'USD' | 'MXN' | 'ARS' | 'BRL' | 'PEN' // la moneda inicial se deriva de la región del dispositivo (src/lib/i18n/regionCurrency.ts); el campo ya soporta multimoneda
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

// ============================================================
// ALMACÉN 1 — movimientos (FLUJO: plata que entra y sale)
// Vive en una pestaña de la planilla del Drive. Caché en IndexedDB.
// ============================================================
export interface Movimiento {
  id: string // uuid generado por la app (no la posición de la fila)
  fecha: string // ISO "yyyy-mm-dd" — cuándo ocurrió
  seccion: string // id de Seccion (Personal, Trabajo, Emprendimiento…)
  categoria: string // id de Categoria (Sueldo, Impuestos, Servicios…) — el nombre se resuelve vía Config, nunca se guarda (specs.md §10.22)
  tipo: TipoMovimiento // da el signo: ingreso suma, gasto resta
  monto: number // SIEMPRE positivo; el signo lo pone `tipo`
  moneda: Moneda // "COP" por ahora
  metodo?: Metodo // opcional: efectivo | debito | credito | banco
  nota?: string // opcional, texto libre
  createdAt: string // ISO datetime — cuándo se registró (auditoría)
  extra?: Record<string, unknown> // red de seguridad: campos futuros sin migrar
}

// ============================================================
// ALMACÉN 2 — activos (SALDO: lo que tenés y vale X hoy)
// Vive en otra pestaña de la planilla del Drive. Caché en IndexedDB.
// ============================================================
export interface Activo {
  id: string
  nombre: string // "CDT Bancolombia", "Apartamento", "Acciones X"
  tipo: TipoActivo
  seccion?: string // opcional, para agrupar (Inversiones, Emprendimiento)
  capitalInvertido?: number // opcional, para calcular ganancia/ROI
  valorActual: number // cuánto vale hoy (lo actualiza el usuario)
  moneda: Moneda
  fechaActualizacion: string // ISO "yyyy-mm-dd"
  nota?: string
  extra?: Record<string, unknown>
}
// Derivado (NO se guarda, se calcula): ganancia = valorActual - (capitalInvertido ?? 0)

// ============================================================
// ALMACÉN 3 — taxonomía + ajustes (CONFIG editable)
// Vive en el appDataFolder de Google Drive: sincroniza entre dispositivos.
// ============================================================
export interface Seccion {
  id: string
  nombre: string
  orden: number
}

export interface Categoria {
  id: string
  nombre: string
  seccionId: string // a qué sección pertenece
  tipo: TipoMovimiento // tipo por defecto al elegir esta categoría
  icono?: CategoryIconKey // elegido o sugerido; ausente = fallback por tipo (specs.md §10.8/§10.22)
  color?: IconAvatarTint // elegido o sugerido; ausente = fallback por tipo (specs.md §10.8/§10.22)
  archivado?: boolean // oculta la categoría del picker sin borrar el historial que la referencia (specs.md §10.22 Decisión 5)
  presupuesto?: number // queda en el esquema; sin UI en la v1
}

export interface Preferencias {
  tema: 'claro' | 'oscuro' | 'sistema'
  monedaPrincipal: Moneda
  primerDiaSemana: 0 | 1 // 0 = domingo, 1 = lunes
  idioma?: SupportedLocale // ausente = seguir el idioma detectado del dispositivo (specs.md §10.24)
}

export interface Config {
  schemaVersion: number
  secciones: Seccion[]
  categorias: Categoria[]
  preferencias: Preferencias
}

// ============================================================
// Las VISTAS no se almacenan: se derivan agrupando `Movimiento[]`.
// (total del mes, desglose por sección, historial día/semana/mes/año)
// ============================================================
export type Periodo = 'dia' | 'semana' | 'mes' | 'anio'

// ============================================================
// Config semilla — punto de partida la primera vez que el usuario entra
// ============================================================
export const CONFIG_SEMILLA: Config = {
  schemaVersion: SCHEMA_VERSION,
  secciones: [
    { id: 'sec_personal', nombre: 'Personal', orden: 0 },
    { id: 'sec_trabajo', nombre: 'Trabajo', orden: 1 },
    { id: 'sec_emprendimiento', nombre: 'Emprendimiento', orden: 2 },
  ],
  // icono/color port the pairings that used to live in movimientoView.ts's
  // deleted per-category-name icon/tint lookup tables (specs.md §10.22 Decision 2) —
  // same visual result, now a property of the category instead of a
  // Spanish-name-keyed lookup.
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
