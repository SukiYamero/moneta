import { detectLocale, detectRegion } from '@/lib/i18n/detectLocale'
import { monedaForRegion } from '@/lib/i18n/regionCurrency'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { CONFIG_SEMILLA, type Config } from '@/lib/schema'

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
