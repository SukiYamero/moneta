import { describe, expect, it } from 'vitest'
import { WEEK_START_KEY, WEEK_START_VALUE } from '@/lib/weekStart'

describe('weekStart', () => {
  it('maps primerDiaSemana to its choice', () => {
    expect(WEEK_START_KEY[0]).toBe('sunday')
    expect(WEEK_START_KEY[1]).toBe('monday')
  })

  it('maps a choice back to primerDiaSemana, the exact inverse of WEEK_START_KEY', () => {
    expect(WEEK_START_VALUE.sunday).toBe(0)
    expect(WEEK_START_VALUE.monday).toBe(1)
    for (const day of [0, 1] as const) {
      expect(WEEK_START_VALUE[WEEK_START_KEY[day]]).toBe(day)
    }
  })
})
