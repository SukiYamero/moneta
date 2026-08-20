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
import type { CategoryIconKey } from '@/lib/categoryIconKeys'

export { CATEGORY_ICON_KEYS, type CategoryIconKey } from '@/lib/categoryIconKeys'

/**
 * The curated icon allowlist a `Categoria.icono` may resolve to (specs.md
 * §10.22 Decision 2) — the grid `CategoryFormModal` renders, and the only
 * set a stored key may resolve against. Keyed by a stable string, never a
 * component reference: `icono` is serialized to JSON (Drive), so the key is
 * the contract, not the `LucideIcon` value behind it — swapping the icon
 * library later would only mean re-pointing this one table.
 *
 * Lives in `components/shared/` (not `features/tags/`, where §10.22 first
 * placed it) for the same reason `tintClasses.ts` does: this table is
 * consumed by `movimientoView.ts`'s `getMovimientoVisual`, which every
 * movement-rendering screen goes through — a shared, foundational module
 * cannot depend on one feature's folder without inverting the layering
 * `ARCHITECTURE.md` describes (`components/shared/` built on by features,
 * never the reverse). `src/features/tags/**` imports this table rather than
 * owning it. The key union itself lives one layer further down, in
 * `@/lib/categoryIconKeys` — `schema.ts` depends on it there, not here — and
 * `satisfies` below still forces this table and that list to name exactly
 * the same keys. (specs.md §11, 2026-08-20.)
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
} as const satisfies Record<CategoryIconKey, LucideIcon>
