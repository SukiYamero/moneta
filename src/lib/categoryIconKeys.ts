// The plain, stable-ordered list of allowed icon keys — no lucide-react
// dependency, no component. Lives here (not in
// src/components/shared/categoryIcons.ts) so schema.ts (Categoria.icono) can
// import the key type without depending on that module's lucide-react
// import; categoryIcons.ts re-exports both and pairs each key with its
// actual `LucideIcon`, with a `satisfies` check keeping the two lists
// honest against each other at compile time rather than by hand (specs.md
// §11, 2026-08-20).
export const CATEGORY_ICON_KEYS = [
  'briefcase',
  'trending-up',
  'laptop',
  'receipt',
  'landmark',
  'wallet',
  'banknote',
  'piggy-bank',
  'credit-card',
  'utensils',
  'coffee',
  'shopping-cart',
  'shopping-bag',
  'car',
  'bus',
  'bike',
  'fuel',
  'plane',
  'house',
  'wrench',
  'wifi',
  'smartphone',
  'party-popper',
  'gamepad',
  'music',
  'heart-pulse',
  'pill',
  'dumbbell',
  'gift',
  'scissors',
  'graduation-cap',
  'book',
  'baby',
  'paw',
  'sparkles',
] as const

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number]
