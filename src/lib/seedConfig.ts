import { detectLocale, detectRegion } from '@/lib/i18n/detectLocale'
import { monedaForRegion } from '@/lib/i18n/regionCurrency'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { CONFIG_SEMILLA, type Config } from '@/lib/schema'

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
  categorias: CONFIG_SEMILLA.categorias.map((categoria) => ({
    ...categoria,
    nombre: SEED_CATEGORY_NAMES[locale][categoria.id] ?? categoria.nombre,
  })),
  preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: monedaForRegion(region) },
})
