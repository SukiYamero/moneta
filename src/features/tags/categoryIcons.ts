import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  Music,
  PartyPopper,
  PawPrint,
  Pill,
  PiggyBank,
  Plane,
  Receipt,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
} from 'lucide-react'

/**
 * The curated icon allowlist a `Categoria.icono` may resolve to (specs.md
 * §10.22 Decision 2) — the grid `CategoryFormModal` renders, and the only
 * set a stored key may resolve against. Keyed by a stable string, never a
 * component reference: `icono` is serialized to JSON (Drive), so the key is
 * the contract, not the `LucideIcon` value behind it — swapping the icon
 * library later would only mean re-pointing this one table.
 */
export const CATEGORY_ICONS = {
  briefcase: Briefcase,
  'trending-up': TrendingUp,
  laptop: Laptop,
  receipt: Receipt,
  landmark: Landmark,
  wallet: Wallet,
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  'credit-card': CreditCard,
  utensils: UtensilsCrossed,
  coffee: Coffee,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  car: Car,
  bus: Bus,
  bike: Bike,
  fuel: Fuel,
  plane: Plane,
  house: House,
  wrench: Wrench,
  wifi: Wifi,
  smartphone: Smartphone,
  'party-popper': PartyPopper,
  gamepad: Gamepad2,
  music: Music,
  'heart-pulse': HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  gift: Gift,
  scissors: Scissors,
  'graduation-cap': GraduationCap,
  book: BookOpen,
  baby: Baby,
  paw: PawPrint,
  sparkles: Sparkles,
} as const satisfies Record<string, LucideIcon>

export type CategoryIconKey = keyof typeof CATEGORY_ICONS

/** Stable, deterministic order for the icon grid — insertion order of `CATEGORY_ICONS`. */
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[]
