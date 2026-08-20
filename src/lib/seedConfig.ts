import { detectLocale, detectRegion } from '@/lib/i18n/detectLocale'
import { monedaForRegion } from '@/lib/i18n/regionCurrency'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { CONFIG_SEMILLA, type Config } from '@/lib/schema'

// specs.md §10.22 Decision 6 / §10.25 addendum, §11 2026-08-20: the seed
// taxonomy's names key off the active i18next language, not the device
// region — region already owns `monedaPrincipal` (money is a property of
// where you are), and copying that wiring here would silently re-couple two
// axes §10.7 made independent (the names of your categories are a property
// of what language you read). Ids are the `CONFIG_SEMILLA` ones and never
// change across locales — a `Movimiento` references a category by id.
// `es` matches `CONFIG_SEMILLA`'s own Spanish exactly, so the CO-region
// baseline test stays byte-identical without a special case.
const SEED_SECTION_NAMES: Record<SupportedLocale, Record<string, string>> = {
  es: { sec_personal: 'Personal', sec_trabajo: 'Trabajo', sec_emprendimiento: 'Emprendimiento' },
  'es-AR': {
    sec_personal: 'Personal',
    sec_trabajo: 'Trabajo',
    sec_emprendimiento: 'Emprendimiento',
  },
  en: { sec_personal: 'Personal', sec_trabajo: 'Work', sec_emprendimiento: 'Business' },
  'pt-BR': { sec_personal: 'Pessoal', sec_trabajo: 'Trabalho', sec_emprendimiento: 'Negócio' },
}

const SEED_CATEGORY_NAMES: Record<SupportedLocale, Record<string, string>> = {
  es: {
    cat_sueldo: 'Sueldo',
    cat_servicios: 'Servicios',
    cat_ventas: 'Ventas',
    cat_impuestos: 'Impuestos',
    cat_caja_menor: 'Caja menor',
  },
  'es-AR': {
    cat_sueldo: 'Sueldo',
    cat_servicios: 'Servicios',
    cat_ventas: 'Ventas',
    cat_impuestos: 'Impuestos',
    cat_caja_menor: 'Caja chica',
  },
  en: {
    cat_sueldo: 'Salary',
    cat_servicios: 'Bills',
    cat_ventas: 'Sales',
    cat_impuestos: 'Taxes',
    cat_caja_menor: 'Petty cash',
  },
  'pt-BR': {
    cat_sueldo: 'Salário',
    cat_servicios: 'Contas',
    cat_ventas: 'Vendas',
    cat_impuestos: 'Impostos',
    cat_caja_menor: 'Fundo de caixa',
  },
}

/**
 * First-run config seed: `monedaPrincipal` derived from the device region,
 * the section/category *names* derived from the active copy locale — two
 * independent axes (specs.md §10.7), each with its own parameter and its
 * own default. `CONFIG_SEMILLA` stays a static constant (specs.md §10.7
 * edge case: a region-dependent value computed at module-import time
 * reproduces the blank-page defect shape §11, 2026-08-19 records twice) —
 * this function is what varies per seeding call, not the constant it starts
 * from. Ids are never localized — a `Movimiento` references a category by
 * id, and these names are written into the user's own `Config` once, then
 * are their own data (§11, 2026-08-20): never re-resolved at render time.
 * Shared by both seeding paths (`repo.local.ts`, `bootstrap.ts`) so a fix to
 * one can't drift from the other. Only meant to be called when no `Config`
 * exists yet — a stored `Config` always wins; callers gate that, this
 * function doesn't need to.
 */
export const buildSeedConfig = (
  region: string = detectRegion(),
  locale: SupportedLocale = detectLocale(),
): Config => ({
  ...CONFIG_SEMILLA,
  secciones: CONFIG_SEMILLA.secciones.map((seccion) => ({
    ...seccion,
    nombre: SEED_SECTION_NAMES[locale][seccion.id] ?? seccion.nombre,
  })),
  categorias: CONFIG_SEMILLA.categorias.map((categoria) => ({
    ...categoria,
    nombre: SEED_CATEGORY_NAMES[locale][categoria.id] ?? categoria.nombre,
  })),
  preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: monedaForRegion(region) },
})
