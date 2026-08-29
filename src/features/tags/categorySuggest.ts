import type { Categoria } from '@/lib/schema'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { ICON_AVATAR_TINTS } from '@/components/shared/tintClasses'
import { normalizeForSearch } from '@/features/search/searchMatch'
import { CATEGORY_ICON_KEYS, type CategoryIconKey } from '@/components/shared/categoryIcons'

interface CategoryConcept {
  icon: CategoryIconKey
  tint: IconAvatarTint
  keywords: string[]
}

export const CATEGORY_CONCEPTS: readonly CategoryConcept[] = [
  {
    icon: 'briefcase',
    tint: 'emerald',
    keywords: ['sueldo', 'salario', 'salary', 'nomina', 'nómina', 'payroll', 'salário'],
  },
  {
    icon: 'laptop',
    tint: 'blue',
    keywords: [
      'freelance',
      'independiente',
      'consultoria',
      'consultoría',
      'consulting',
      'proyecto',
    ],
  },
  {
    icon: 'trending-up',
    tint: 'emerald',
    keywords: ['ventas', 'venta', 'sales', 'vendas', 'negocio', 'business'],
  },
  {
    icon: 'landmark',
    tint: 'rose',
    keywords: ['impuestos', 'impuesto', 'taxes', 'tax', 'impostos', 'dian', 'declaracion'],
  },
  {
    icon: 'receipt',
    tint: 'blue',
    keywords: [
      'servicios',
      'servicio',
      'utilities',
      'utility',
      'contas',
      'luz',
      'electricidad',
      'agua',
      'gas',
      'electricity',
    ],
  },
  {
    icon: 'wallet',
    tint: 'amber',
    keywords: ['caja', 'menor', 'efectivo', 'pettycash', 'cash', 'caixinha'],
  },
  {
    icon: 'utensils',
    tint: 'amber',
    keywords: ['comida', 'almuerzo', 'cena', 'food', 'meal', 'restaurante', 'restaurant'],
  },
  {
    icon: 'shopping-cart',
    tint: 'amber',
    keywords: [
      'supermercado',
      'mercado',
      'groceries',
      'grocery',
      'super',
      'mercearia',
      'compras del hogar',
    ],
  },
  {
    icon: 'coffee',
    tint: 'amber',
    keywords: ['cafe', 'café', 'coffee', 'cafeteria', 'cafetería'],
  },
  {
    icon: 'car',
    tint: 'blue',
    keywords: ['transporte', 'transport', 'uber', 'taxi', 'carro', 'auto', 'car'],
  },
  {
    icon: 'bus',
    tint: 'blue',
    keywords: ['bus', 'autobus', 'autobús', 'colectivo', 'onibus', 'ônibus', 'metro', 'subte'],
  },
  {
    icon: 'bike',
    tint: 'blue',
    keywords: ['bicicleta', 'bici', 'bike', 'bicycle'],
  },
  {
    icon: 'fuel',
    tint: 'blue',
    keywords: ['gasolina', 'combustible', 'fuel', 'nafta', 'combustivel'],
  },
  {
    icon: 'plane',
    tint: 'purple',
    keywords: ['viaje', 'viajes', 'travel', 'vuelo', 'flight', 'viagem', 'vacaciones', 'vacation'],
  },
  {
    icon: 'shopping-bag',
    tint: 'purple',
    keywords: ['compras', 'shopping', 'ropa', 'clothes', 'clothing', 'roupa', 'moda', 'fashion'],
  },
  {
    icon: 'party-popper',
    tint: 'rose',
    keywords: [
      'ocio',
      'diversion',
      'diversión',
      'fun',
      'entertainment',
      'fiesta',
      'party',
      'festa',
    ],
  },
  {
    icon: 'gamepad',
    tint: 'rose',
    keywords: ['juegos', 'videojuegos', 'games', 'gaming', 'jogos'],
  },
  {
    icon: 'music',
    tint: 'rose',
    keywords: ['musica', 'música', 'music', 'spotify', 'streaming'],
  },
  {
    icon: 'heart-pulse',
    tint: 'emerald',
    keywords: [
      'salud',
      'health',
      'medico',
      'médico',
      'doctor',
      'saude',
      'saúde',
      'clinica',
      'clínica',
    ],
  },
  {
    icon: 'pill',
    tint: 'emerald',
    keywords: ['farmacia', 'medicina', 'medicine', 'pharmacy', 'remedio', 'remédio'],
  },
  {
    icon: 'dumbbell',
    tint: 'rose',
    keywords: [
      'gimnasio',
      'gym',
      'academia',
      'fitness',
      'entrenamiento',
      'musculacion',
      'musculación',
      'crossfit',
      'pilates',
      'yoga',
    ],
  },
  {
    icon: 'house',
    tint: 'emerald',
    keywords: ['hogar', 'casa', 'home', 'renta', 'alquiler', 'rent', 'aluguel', 'arriendo'],
  },
  {
    icon: 'wrench',
    tint: 'blue',
    keywords: ['mantenimiento', 'reparacion', 'reparación', 'maintenance', 'repair', 'manutencao'],
  },
  {
    icon: 'wifi',
    tint: 'blue',
    keywords: ['internet', 'wifi', 'banda ancha', 'broadband'],
  },
  {
    icon: 'smartphone',
    tint: 'blue',
    keywords: ['celular', 'telefono', 'teléfono', 'phone', 'movil', 'móvil'],
  },
  {
    icon: 'credit-card',
    tint: 'purple',
    keywords: ['tarjeta', 'credito', 'crédito', 'card', 'credit', 'cartao', 'cartão'],
  },
  {
    icon: 'piggy-bank',
    tint: 'emerald',
    keywords: ['ahorro', 'ahorros', 'savings', 'save', 'poupanca', 'poupança'],
  },
  {
    icon: 'banknote',
    tint: 'emerald',
    keywords: ['inversion', 'inversión', 'investment', 'investimento', 'acciones', 'stocks'],
  },
  {
    icon: 'graduation-cap',
    tint: 'blue',
    keywords: [
      'estudio',
      'estudios',
      'education',
      'educacion',
      'educación',
      'curso',
      'course',
      'universidad',
    ],
  },
  {
    icon: 'book',
    tint: 'blue',
    keywords: ['libros', 'libro', 'books', 'book', 'livros', 'livro'],
  },
  {
    icon: 'gift',
    tint: 'purple',
    keywords: ['regalo', 'regalos', 'gift', 'gifts', 'presente', 'presentes'],
  },
  {
    icon: 'baby',
    tint: 'rose',
    keywords: ['bebe', 'bebé', 'baby', 'hijo', 'hijos', 'niños', 'ninos', 'children', 'filhos'],
  },
  {
    icon: 'paw',
    tint: 'amber',
    keywords: ['mascota', 'mascotas', 'pet', 'pets', 'perro', 'gato', 'dog', 'cat', 'animal'],
  },
  {
    icon: 'scissors',
    tint: 'purple',
    keywords: ['peluqueria', 'peluquería', 'salon', 'salón', 'belleza', 'beauty', 'cabeleireiro'],
  },
  {
    icon: 'hand-coins',
    tint: 'rose',
    keywords: [
      'deuda',
      'deudas',
      'prestamo',
      'préstamo',
      'loan',
      'debt',
      'financiamiento',
      'emprestimo',
      'empréstimo',
    ],
  },
  {
    icon: 'percent',
    tint: 'rose',
    keywords: [
      'comision',
      'comisión',
      'interes',
      'interés',
      'fee',
      'fees',
      'interest',
      'taxa',
      'cargo',
    ],
  },
  {
    icon: 'calculator',
    tint: 'blue',
    keywords: [
      'contador',
      'contabilidad',
      'contabilidade',
      'accounting',
      'accountant',
      'asesoria',
      'asesoría',
    ],
  },
  {
    icon: 'handshake',
    tint: 'emerald',
    keywords: [
      'donacion',
      'donación',
      'caridad',
      'charity',
      'donation',
      'donativo',
      'ong',
      'doacao',
      'doação',
    ],
  },
  {
    icon: 'shield',
    tint: 'blue',
    keywords: [
      'seguro',
      'seguros',
      'insurance',
      'poliza',
      'póliza',
      'aseguradora',
      'apolice',
      'apólice',
    ],
  },
  {
    icon: 'building-2',
    tint: 'emerald',
    keywords: ['expensas', 'condominio', 'hoa', 'administracion', 'administración'],
  },
  {
    icon: 'washing-machine',
    tint: 'blue',
    keywords: ['lavanderia', 'lavandería', 'laundry', 'tintoreria', 'tintorería'],
  },
  {
    icon: 'spray-can',
    tint: 'blue',
    keywords: ['limpieza', 'cleaning', 'aseo', 'limpeza'],
  },
  {
    icon: 'hammer',
    tint: 'blue',
    keywords: ['herramientas', 'herramienta', 'tools', 'ferramentas', 'taller', 'workshop'],
  },
  {
    icon: 'sofa',
    tint: 'amber',
    keywords: [
      'muebles',
      'mueble',
      'furniture',
      'sofa',
      'sofá',
      'moveis',
      'móveis',
      'decoracion',
      'decoración',
    ],
  },
  {
    icon: 'truck',
    tint: 'amber',
    keywords: ['delivery', 'domicilio', 'entrega', 'reparto', 'rappi', 'ifood'],
  },
  {
    icon: 'package',
    tint: 'blue',
    keywords: [
      'paquete',
      'paquetes',
      'envio',
      'envío',
      'correo',
      'courier',
      'shipping',
      'parcel',
      'parcels',
      'encomenda',
    ],
  },
  {
    icon: 'parking',
    tint: 'blue',
    keywords: ['estacionamiento', 'parking', 'aparcamiento', 'parqueo', 'estacionamento'],
  },
  {
    icon: 'train',
    tint: 'blue',
    keywords: ['tren', 'train', 'ferrocarril', 'trem', 'ferrovia'],
  },
  {
    icon: 'hotel',
    tint: 'purple',
    keywords: ['hotel', 'hoteles', 'hospedaje', 'alojamiento', 'hospedagem', 'lodging'],
  },
  {
    icon: 'luggage',
    tint: 'purple',
    keywords: ['equipaje', 'maleta', 'maletas', 'luggage', 'bagagem', 'mala'],
  },
  {
    icon: 'tv',
    tint: 'purple',
    keywords: [
      'electronica',
      'electrónica',
      'electronics',
      'television',
      'televisor',
      'eletronica',
      'eletronicos',
      'electrodomestico',
      'electrodoméstico',
    ],
  },
  {
    icon: 'shirt',
    tint: 'purple',
    keywords: [
      'camisa',
      'camiseta',
      'blusa',
      'pantalon',
      'pantalón',
      'vestido',
      'prenda',
      'prendas',
    ],
  },
  {
    icon: 'gem',
    tint: 'purple',
    keywords: [
      'joyeria',
      'joyería',
      'jewelry',
      'joias',
      'jóias',
      'accesorios',
      'accesorio',
      'accessories',
    ],
  },
  {
    icon: 'stethoscope',
    tint: 'emerald',
    keywords: ['consulta', 'chequeo', 'checkup', 'exame', 'diagnostico', 'diagnóstico'],
  },
  {
    icon: 'glasses',
    tint: 'emerald',
    keywords: ['optica', 'óptica', 'lentes', 'anteojos', 'gafas', 'glasses', 'oculos', 'óculos'],
  },
  {
    icon: 'bandage',
    tint: 'rose',
    keywords: [
      'emergencia',
      'urgencia',
      'accidente',
      'emergency',
      'injury',
      'lesion',
      'lesión',
      'ferimento',
    ],
  },
  {
    icon: 'school',
    tint: 'blue',
    keywords: [
      'colegio',
      'escuela',
      'matricula',
      'matrícula',
      'school',
      'escola',
      'guarderia',
      'guardería',
      'jardin',
      'jardín',
    ],
  },
  {
    icon: 'film',
    tint: 'rose',
    keywords: [
      'netflix',
      'pelicula',
      'película',
      'cine',
      'cinema',
      'movie',
      'movies',
      'filme',
      'serie',
      'series',
    ],
  },
  {
    icon: 'ticket',
    tint: 'rose',
    keywords: [
      'suscripcion',
      'suscripción',
      'subscription',
      'membresia',
      'membresía',
      'assinatura',
      'mensalidade',
      'entrada',
      'entradas',
      'concierto',
    ],
  },
  {
    icon: 'trophy',
    tint: 'rose',
    keywords: ['deporte', 'deportes', 'sport', 'sports', 'futbol', 'fútbol', 'esporte', 'esportes'],
  },
  {
    icon: 'palette',
    tint: 'purple',
    keywords: ['pintura', 'arte', 'manualidades', 'hobby', 'hobbies', 'artesanato'],
  },
  {
    icon: 'pizza',
    tint: 'amber',
    keywords: ['pizza', 'hamburguesa', 'fastfood'],
  },
  {
    icon: 'beer',
    tint: 'amber',
    keywords: ['bar', 'cerveza', 'bebidas', 'drinks', 'cerveja', 'trago', 'tragos'],
  },
  {
    icon: 'cake',
    tint: 'amber',
    keywords: [
      'panaderia',
      'panadería',
      'postre',
      'postres',
      'pasteleria',
      'pastelería',
      'bakery',
      'dessert',
      'padaria',
    ],
  },
  {
    icon: 'chef-hat',
    tint: 'amber',
    keywords: ['catering', 'chef', 'cocina', 'culinary', 'gastronomia', 'gastronomía'],
  },
  {
    icon: 'apple',
    tint: 'amber',
    keywords: ['frutas', 'fruta', 'verduras', 'verdura', 'feria', 'verduleria', 'verdulería'],
  },
  {
    icon: 'briefcase-business',
    tint: 'blue',
    keywords: ['oficina', 'office', 'papeleria', 'papelería', 'suprimentos'],
  },
  {
    icon: 'file-text',
    tint: 'blue',
    keywords: ['tramite', 'trámite', 'notaria', 'notaría', 'legal', 'abogado', 'advogado'],
  },
  {
    icon: 'flower-2',
    tint: 'emerald',
    keywords: [
      'jardineria',
      'jardinería',
      'jardim',
      'garden',
      'gardening',
      'plantas',
      'jardinagem',
    ],
  },
  {
    icon: 'sparkles',
    tint: 'purple',
    keywords: [
      'varios',
      'miscelaneo',
      'miscelánea',
      'misc',
      'otros',
      'other',
      'diversos',
      'outros',
    ],
  },
]

const buildConceptKeywordIndex = (): Map<string, CategoryConcept> => {
  const index = new Map<string, CategoryConcept>()
  for (const concept of CATEGORY_CONCEPTS) {
    for (const keyword of concept.keywords) {
      const normalized = normalizeForSearch(keyword)
      const existing = index.get(normalized)
      if (import.meta.env.DEV && existing && existing !== concept) {
        throw new Error(
          `categorySuggest: keyword "${keyword}" claimed by both "${existing.icon}" and "${concept.icon}"`,
        )
      }
      index.set(normalized, concept)
    }
  }
  return index
}

const CONCEPT_KEYWORD_INDEX: Map<string, CategoryConcept> = buildConceptKeywordIndex()

const wordsOf = (text: string): string[] =>
  normalizeForSearch(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)

const matchedConcepts = (query: string): CategoryConcept[] => {
  const matched: CategoryConcept[] = []
  const seen = new Set<CategoryConcept>()
  for (const word of wordsOf(query)) {
    const concept = CONCEPT_KEYWORD_INDEX.get(word)
    if (concept && !seen.has(concept)) {
      seen.add(concept)
      matched.push(concept)
    }
  }
  return matched
}

export interface CategoryVisualSuggestion {
  icono: CategoryIconKey | undefined
  color: IconAvatarTint
}

export const leastUsedTint = (categorias: readonly Pick<Categoria, 'color'>[]): IconAvatarTint => {
  const usage = new Map<IconAvatarTint, number>(ICON_AVATAR_TINTS.map((tint) => [tint, 0]))
  for (const { color } of categorias) {
    if (color) usage.set(color, (usage.get(color) ?? 0) + 1)
  }
  return ICON_AVATAR_TINTS.reduce((least, tint) =>
    (usage.get(tint) ?? 0) < (usage.get(least) ?? 0) ? tint : least,
  )
}

export const suggestCategoryVisual = (
  query: string,
  existingCategorias: readonly Pick<Categoria, 'color'>[],
): CategoryVisualSuggestion => {
  const [concept] = matchedConcepts(query)
  if (concept) return { icono: concept.icon, color: concept.tint }
  return { icono: undefined, color: leastUsedTint(existingCategorias) }
}

export const rankCategoryIcons = (query: string): CategoryIconKey[] => {
  const matchedIcons = matchedConcepts(query).map((concept) => concept.icon)
  const matchedIconSet = new Set(matchedIcons)
  const remaining = CATEGORY_ICON_KEYS.filter((key) => !matchedIconSet.has(key))
  return [...matchedIcons, ...remaining]
}
