// Suggests an icon and color for a typed category name, offline and without
// translating anything (specs.md §10.22 Decision 7). Translating the query
// so it can be matched against a single-language keyword list was rejected —
// it needs a network call to a translation API, which breaks §6 (no
// backend), §3 (offline-first) and, decisively, sends the user's own
// category names to an outside service. The problem is inverted instead:
// each concept below carries one multilingual bag of keywords, so matching
// never needs to know which language was typed.
import type { Categoria } from '@/lib/schema'
import type { IconAvatarTint } from '@/components/shared/IconAvatar'
import { ICON_AVATAR_TINTS } from '@/components/shared/tintClasses'
import { normalizeForSearch } from '@/features/search/searchMatch'
import type { CategoryIconKey } from '@/components/shared/categoryIcons'

interface CategoryConcept {
  icon: CategoryIconKey
  tint: IconAvatarTint
  keywords: string[]
}

// ~30 everyday spending/income concepts, each with icon + tint + a bag of
// Spanish/English/Portuguese keywords in one list (not one list per locale)
// — "academia" resolves whether the UI is es or pt-BR, and a user who mixes
// languages is handled for free (specs.md §10.22).
const CATEGORY_CONCEPTS: readonly CategoryConcept[] = [
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
    keywords: ['comida', 'almuerzo', 'cena', 'food', 'meal', 'comida', 'restaurante', 'restaurant'],
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
    keywords: [
      'transporte',
      'transport',
      'uber',
      'taxi',
      'carro',
      'auto',
      'car',
      'gasolina',
      'nafta',
    ],
  },
  {
    icon: 'bus',
    tint: 'blue',
    keywords: ['bus', 'autobus', 'autobús', 'colectivo', 'onibus', 'ônibus', 'metro', 'subte'],
  },
  {
    icon: 'bike',
    tint: 'blue',
    keywords: ['bicicleta', 'bici', 'bike', 'bicycle', 'bicicleta'],
  },
  {
    icon: 'fuel',
    tint: 'blue',
    keywords: ['gasolina', 'combustible', 'fuel', 'gas', 'nafta', 'gasolina', 'combustivel'],
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
    keywords: ['musica', 'música', 'music', 'spotify', 'streaming', 'música'],
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
    keywords: ['celular', 'telefono', 'teléfono', 'phone', 'movil', 'móvil', 'celular'],
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
]

const CONCEPT_KEYWORD_INDEX: Map<string, CategoryConcept> = new Map(
  CATEGORY_CONCEPTS.flatMap((concept) =>
    concept.keywords.map((keyword) => [normalizeForSearch(keyword), concept] as const),
  ),
)

// Splits on anything that isn't a letter/number, matching on whole
// normalized words rather than bare substrings — "regalo" must not match
// inside an unrelated word (specs.md §10.22).
const wordsOf = (text: string): string[] =>
  normalizeForSearch(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)

export interface CategoryVisualSuggestion {
  /** `undefined` when no concept matched — the caller uses the tipo-based icon fallback (specs.md §10.8), never a guessed icon. */
  icono: CategoryIconKey | undefined
  color: IconAvatarTint
}

/** Deterministic tie-break: the tint with the fewest current uses, first by `ICON_AVATAR_TINTS` order among ties — never colorless. */
export const leastUsedTint = (categorias: readonly Pick<Categoria, 'color'>[]): IconAvatarTint => {
  const usage = new Map<IconAvatarTint, number>(ICON_AVATAR_TINTS.map((tint) => [tint, 0]))
  for (const { color } of categorias) {
    if (color) usage.set(color, (usage.get(color) ?? 0) + 1)
  }
  return ICON_AVATAR_TINTS.reduce((least, tint) =>
    (usage.get(tint) ?? 0) < (usage.get(least) ?? 0) ? tint : least,
  )
}

/**
 * Suggests an icon and color for a typed category name. A concept match's
 * color is always its own semantic tint, even when it collides with a color
 * already in use (user decision, specs.md §10.22 Decision 7) — reading
 * "Comida is amber, Salud is green" correctly is worth more than guaranteed
 * distinguishability past nine categories. Only the no-match case falls
 * back to `leastUsedTint`, which is also the only place that guarantees an
 * unrecognized category is never colorless.
 */
export const suggestCategoryVisual = (
  query: string,
  existingCategorias: readonly Pick<Categoria, 'color'>[],
): CategoryVisualSuggestion => {
  for (const word of wordsOf(query)) {
    const concept = CONCEPT_KEYWORD_INDEX.get(word)
    if (concept) return { icono: concept.icon, color: concept.tint }
  }
  return { icono: undefined, color: leastUsedTint(existingCategorias) }
}
