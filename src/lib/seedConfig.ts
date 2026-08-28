import { detectLocale, detectRegion } from '@/lib/i18n/detectLocale'
import { monedaForRegion } from '@/lib/i18n/regionCurrency'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { CATEGORIAS_SEMILLA, CONFIG_SEMILLA, type CategoriaSeedId, type Config } from '@/lib/schema'

export const SEED_CATEGORY_NAMES: Record<SupportedLocale, Record<CategoriaSeedId, string>> = {
  es: {
    cat_comida: 'Comida',
    cat_supermercado: 'Supermercado',
    cat_restaurante: 'Restaurante',
    cat_cafe: 'Café',
    cat_domicilios: 'Domicilios',

    cat_transporte: 'Transporte',
    cat_gasolina: 'Gasolina',
    cat_taxi: 'Taxi',
    cat_transporte_publico: 'Transporte público',
    cat_parqueadero: 'Parqueadero',

    cat_hogar: 'Hogar',
    cat_arriendo: 'Arriendo',
    cat_servicios: 'Servicios',
    cat_internet: 'Internet',
    cat_reparaciones: 'Reparaciones',

    cat_compras: 'Compras',
    cat_ropa: 'Ropa',
    cat_electronica: 'Electrónica',
    cat_muebles: 'Muebles',
    cat_varios: 'Varios',

    cat_salud: 'Salud',
    cat_medico: 'Médico',
    cat_farmacia: 'Farmacia',
    cat_gimnasio: 'Gimnasio',
    cat_seguro: 'Seguro',

    cat_ocio: 'Ocio',
    cat_cine: 'Cine',
    cat_streaming: 'Streaming',
    cat_salidas: 'Salidas',
    cat_juegos: 'Juegos',

    cat_educacion: 'Educación',
    cat_cursos: 'Cursos',
    cat_libros: 'Libros',
    cat_colegio: 'Colegio',

    cat_cuidado_personal: 'Cuidado personal',
    cat_peluqueria: 'Peluquería',
    cat_belleza: 'Belleza',
    cat_lavanderia: 'Lavandería',

    cat_mascotas: 'Mascotas',
    cat_comida_mascota: 'Comida de mascota',
    cat_veterinario: 'Veterinario',
    cat_accesorios_mascota: 'Accesorios',

    cat_viajes: 'Viajes',
    cat_vuelos: 'Vuelos',
    cat_hospedaje: 'Hospedaje',
    cat_paseos: 'Paseos',

    cat_finanzas: 'Finanzas',
    cat_impuestos: 'Impuestos',
    cat_comisiones: 'Comisiones',
    cat_ahorro: 'Ahorro',
    cat_deuda: 'Deuda',
    cat_caja_menor: 'Caja menor',

    cat_ingresos: 'Ingresos',
    cat_sueldo: 'Sueldo',
    cat_freelance: 'Freelance',
    cat_ventas: 'Ventas',
    cat_regalo: 'Regalo',
    cat_reembolso: 'Reembolso',
  },
  'es-AR': {
    cat_comida: 'Comida',
    cat_supermercado: 'Supermercado',
    cat_restaurante: 'Restaurante',
    cat_cafe: 'Café',
    cat_domicilios: 'Delivery',

    cat_transporte: 'Transporte',
    cat_gasolina: 'Nafta',
    cat_taxi: 'Taxi',
    cat_transporte_publico: 'Transporte público',
    cat_parqueadero: 'Estacionamiento',

    cat_hogar: 'Hogar',
    cat_arriendo: 'Alquiler',
    cat_servicios: 'Servicios',
    cat_internet: 'Internet',
    cat_reparaciones: 'Reparaciones',

    cat_compras: 'Compras',
    cat_ropa: 'Ropa',
    cat_electronica: 'Electrónica',
    cat_muebles: 'Muebles',
    cat_varios: 'Varios',

    cat_salud: 'Salud',
    cat_medico: 'Médico',
    cat_farmacia: 'Farmacia',
    cat_gimnasio: 'Gimnasio',
    cat_seguro: 'Seguro',

    cat_ocio: 'Ocio',
    cat_cine: 'Cine',
    cat_streaming: 'Streaming',
    cat_salidas: 'Salidas',
    cat_juegos: 'Juegos',

    cat_educacion: 'Educación',
    cat_cursos: 'Cursos',
    cat_libros: 'Libros',
    cat_colegio: 'Colegio',

    cat_cuidado_personal: 'Cuidado personal',
    cat_peluqueria: 'Peluquería',
    cat_belleza: 'Belleza',
    cat_lavanderia: 'Lavandería',

    cat_mascotas: 'Mascotas',
    cat_comida_mascota: 'Comida de mascota',
    cat_veterinario: 'Veterinario',
    cat_accesorios_mascota: 'Accesorios',

    cat_viajes: 'Viajes',
    cat_vuelos: 'Vuelos',
    cat_hospedaje: 'Hospedaje',
    cat_paseos: 'Paseos',

    cat_finanzas: 'Finanzas',
    cat_impuestos: 'Impuestos',
    cat_comisiones: 'Comisiones',
    cat_ahorro: 'Ahorro',
    cat_deuda: 'Deuda',
    cat_caja_menor: 'Caja chica',

    cat_ingresos: 'Ingresos',
    cat_sueldo: 'Sueldo',
    cat_freelance: 'Freelance',
    cat_ventas: 'Ventas',
    cat_regalo: 'Regalo',
    cat_reembolso: 'Reembolso',
  },
  en: {
    cat_comida: 'Food',
    cat_supermercado: 'Groceries',
    cat_restaurante: 'Restaurant',
    cat_cafe: 'Coffee',
    cat_domicilios: 'Delivery',

    cat_transporte: 'Transport',
    cat_gasolina: 'Gas',
    cat_taxi: 'Taxi',
    cat_transporte_publico: 'Public transit',
    cat_parqueadero: 'Parking',

    cat_hogar: 'Home',
    cat_arriendo: 'Rent',
    cat_servicios: 'Utilities',
    cat_internet: 'Internet',
    cat_reparaciones: 'Repairs',

    cat_compras: 'Shopping',
    cat_ropa: 'Clothing',
    cat_electronica: 'Electronics',
    cat_muebles: 'Furniture',
    cat_varios: 'Miscellaneous',

    cat_salud: 'Health',
    cat_medico: 'Doctor',
    cat_farmacia: 'Pharmacy',
    cat_gimnasio: 'Gym',
    cat_seguro: 'Insurance',

    cat_ocio: 'Leisure',
    cat_cine: 'Movies',
    cat_streaming: 'Streaming',
    cat_salidas: 'Going out',
    cat_juegos: 'Games',

    cat_educacion: 'Education',
    cat_cursos: 'Courses',
    cat_libros: 'Books',
    cat_colegio: 'School',

    cat_cuidado_personal: 'Personal care',
    cat_peluqueria: 'Hair salon',
    cat_belleza: 'Beauty',
    cat_lavanderia: 'Laundry',

    cat_mascotas: 'Pets',
    cat_comida_mascota: 'Pet food',
    cat_veterinario: 'Vet',
    cat_accesorios_mascota: 'Accessories',

    cat_viajes: 'Travel',
    cat_vuelos: 'Flights',
    cat_hospedaje: 'Lodging',
    cat_paseos: 'Sightseeing',

    cat_finanzas: 'Finance',
    cat_impuestos: 'Taxes',
    cat_comisiones: 'Fees',
    cat_ahorro: 'Savings',
    cat_deuda: 'Debt',
    cat_caja_menor: 'Petty cash',

    cat_ingresos: 'Income',
    cat_sueldo: 'Salary',
    cat_freelance: 'Freelance',
    cat_ventas: 'Sales',
    cat_regalo: 'Gift',
    cat_reembolso: 'Refund',
  },
  'pt-BR': {
    cat_comida: 'Alimentação',
    cat_supermercado: 'Supermercado',
    cat_restaurante: 'Restaurante',
    cat_cafe: 'Café',
    cat_domicilios: 'Delivery',

    cat_transporte: 'Transporte',
    cat_gasolina: 'Combustível',
    cat_taxi: 'Táxi',
    cat_transporte_publico: 'Transporte público',
    cat_parqueadero: 'Estacionamento',

    cat_hogar: 'Moradia',
    cat_arriendo: 'Aluguel',
    cat_servicios: 'Contas',
    cat_internet: 'Internet',
    cat_reparaciones: 'Reparos',

    cat_compras: 'Compras',
    cat_ropa: 'Roupas',
    cat_electronica: 'Eletrônicos',
    cat_muebles: 'Móveis',
    cat_varios: 'Diversos',

    cat_salud: 'Saúde',
    cat_medico: 'Médico',
    cat_farmacia: 'Farmácia',
    cat_gimnasio: 'Academia',
    cat_seguro: 'Seguro',

    cat_ocio: 'Lazer',
    cat_cine: 'Cinema',
    cat_streaming: 'Streaming',
    cat_salidas: 'Saídas',
    cat_juegos: 'Jogos',

    cat_educacion: 'Educação',
    cat_cursos: 'Cursos',
    cat_libros: 'Livros',
    cat_colegio: 'Escola',

    cat_cuidado_personal: 'Cuidados pessoais',
    cat_peluqueria: 'Cabeleireiro',
    cat_belleza: 'Beleza',
    cat_lavanderia: 'Lavanderia',

    cat_mascotas: 'Pets',
    cat_comida_mascota: 'Ração',
    cat_veterinario: 'Veterinário',
    cat_accesorios_mascota: 'Acessórios',

    cat_viajes: 'Viagens',
    cat_vuelos: 'Voos',
    cat_hospedaje: 'Hospedagem',
    cat_paseos: 'Passeios',

    cat_finanzas: 'Finanças',
    cat_impuestos: 'Impostos',
    cat_comisiones: 'Taxas',
    cat_ahorro: 'Poupança',
    cat_deuda: 'Dívidas',
    cat_caja_menor: 'Fundo de caixa',

    cat_ingresos: 'Receitas',
    cat_sueldo: 'Salário',
    cat_freelance: 'Freelance',
    cat_ventas: 'Vendas',
    cat_regalo: 'Presente',
    cat_reembolso: 'Reembolso',
  },
}

export const buildSeedConfig = (
  region: string = detectRegion(),
  locale: SupportedLocale = detectLocale(),
): Config => ({
  ...CONFIG_SEMILLA,
  categorias: CATEGORIAS_SEMILLA.map((categoria) => ({
    ...categoria,
    nombre: SEED_CATEGORY_NAMES[locale][categoria.id],
  })),
  preferencias: { ...CONFIG_SEMILLA.preferencias, monedaPrincipal: monedaForRegion(region) },
})
