import { describe, expect, it } from 'vitest'
import { periodRange } from '@/lib/movimientoStats'
import { getPeriodLabel } from '@/features/history/historyPeriodLabel'

const strings = { today: 'Hoy', week: 'Semana', summary: 'Resumen' }
const TODAY = new Date('2026-08-19T12:00:00.000Z')

describe('getPeriodLabel', () => {
  it('titles the current day "Hoy"', () => {
    const range = periodRange('dia', '2026-08-19', 1)
    expect(getPeriodLabel('dia', range, TODAY, strings).title).toBe('Hoy')
  })

  it('titles a non-today day with the weekday name', () => {
    const range = periodRange('dia', '2026-08-15', 1)
    const label = getPeriodLabel('dia', range, TODAY, strings)
    expect(label.title.toLowerCase()).toContain('15')
    expect(label.title).not.toBe('Hoy')
  })

  it('labels a week with its day range and the "week" string in the subtitle', () => {
    const range = periodRange('semana', '2026-08-19', 1)
    const label = getPeriodLabel('semana', range, TODAY, strings)
    expect(label.subtitle).toContain('Semana')
  })

  it('labels a month with its full month name and "summary" as the subtitle', () => {
    const range = periodRange('mes', '2026-08-19', 1)
    const label = getPeriodLabel('mes', range, TODAY, strings)
    expect(label.title.toLowerCase()).toContain('agosto')
    expect(label.subtitle).toBe('Resumen')
  })

  it('labels a year with its 4-digit number and "summary" as the subtitle', () => {
    const range = periodRange('anio', '2026-08-19', 1)
    const label = getPeriodLabel('anio', range, TODAY, strings)
    expect(label.title).toBe('2026')
    expect(label.subtitle).toBe('Resumen')
  })
})
