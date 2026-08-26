import { describe, expect, it } from 'vitest'
import { resolveDateRange } from '@/features/search/dateRangePresets'

const TODAY = new Date(2026, 7, 19) // 2026-08-19, a Wednesday — fixed so preset math isn't flaky
const NO_CUSTOM = { from: '2026-08-19', to: '2026-08-19' }

describe('resolveDateRange()', () => {
  it('"all" resolves to null — no date filter at all, not a sentinel range', () => {
    expect(resolveDateRange('all', NO_CUSTOM, TODAY)).toBeNull()
  })

  it.each([
    ['7d', { from: '2026-08-13', to: '2026-08-19' }],
    ['30d', { from: '2026-07-21', to: '2026-08-19' }],
    ['month', { from: '2026-08-01', to: '2026-08-31' }],
    ['year', { from: '2026-01-01', to: '2026-12-31' }],
  ] as const)('"%s" resolves to the expected inclusive range ending today', (preset, expected) => {
    expect(resolveDateRange(preset, NO_CUSTOM, TODAY)).toEqual(expected)
  })

  it('"custom" passes the range through unchanged when already ordered', () => {
    const custom = { from: '2026-06-01', to: '2026-06-10' }
    expect(resolveDateRange('custom', custom, TODAY)).toEqual(custom)
  })

  it('"custom" swaps from/to when the user tapped the later day first', () => {
    const custom = { from: '2026-06-10', to: '2026-06-01' }
    expect(resolveDateRange('custom', custom, TODAY)).toEqual({
      from: '2026-06-01',
      to: '2026-06-10',
    })
  })

  it('"custom" leaves a same-day range as-is', () => {
    const custom = { from: '2026-06-05', to: '2026-06-05' }
    expect(resolveDateRange('custom', custom, TODAY)).toEqual(custom)
  })
})
