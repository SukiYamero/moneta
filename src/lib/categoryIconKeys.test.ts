import { describe, expect, it } from 'vitest'
import { CATEGORY_ICON_KEYS } from '@/lib/categoryIconKeys'

const FROZEN_FIRST_35 = [
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
]

describe('CATEGORY_ICON_KEYS', () => {
  it('never reorders, renames or removes the original 35 keys (append-only, stored data)', () => {
    expect(CATEGORY_ICON_KEYS.slice(0, 35)).toEqual(FROZEN_FIRST_35)
  })

  it('has grown to roughly double the original allowlist', () => {
    expect(CATEGORY_ICON_KEYS.length).toBeGreaterThanOrEqual(65)
    expect(CATEGORY_ICON_KEYS.length).toBeLessThanOrEqual(75)
  })

  it('has no duplicate keys', () => {
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length)
  })
})
