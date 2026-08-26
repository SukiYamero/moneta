import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHistoryPeriod } from '@/features/history/useHistoryPeriod'
import { periodRange } from '@/lib/movimientoStats'

const TODAY = new Date('2026-08-19T12:00:00.000Z')

describe('useHistoryPeriod', () => {
  it('defaults to dia scope, anchored on today', () => {
    const { result } = renderHook(() => useHistoryPeriod({ today: TODAY }))
    expect(result.current.scope).toBe('dia')
    expect(result.current.anchor).toBe('2026-08-19')
  })

  it('setScope changes scope without moving the anchor', () => {
    const { result } = renderHook(() => useHistoryPeriod({ today: TODAY }))
    act(() => result.current.setScope('mes'))
    expect(result.current.scope).toBe('mes')
    expect(result.current.anchor).toBe('2026-08-19')
  })

  it('selectAnchor jumps straight to the given date', () => {
    const { result } = renderHook(() => useHistoryPeriod({ today: TODAY }))
    act(() => result.current.selectAnchor('2026-03-05'))
    expect(result.current.anchor).toBe('2026-03-05')
  })

  it('step(1)/step(-1) move by one day in dia scope', () => {
    const { result } = renderHook(() => useHistoryPeriod({ today: TODAY }))
    act(() => result.current.step(1))
    expect(result.current.anchor).toBe('2026-08-20')
    act(() => result.current.step(-1))
    act(() => result.current.step(-1))
    expect(result.current.anchor).toBe('2026-08-18')
  })

  it('step crosses a month boundary correctly in mes scope', () => {
    const { result } = renderHook(() =>
      useHistoryPeriod({ today: new Date('2026-08-31T12:00:00.000Z') }),
    )
    act(() => result.current.setScope('mes'))
    act(() => result.current.step(1))
    const range = periodRange('mes', result.current.anchor, 1)
    expect(range).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('step crosses a year boundary correctly in anio scope', () => {
    const { result } = renderHook(() =>
      useHistoryPeriod({ today: new Date('2026-12-15T12:00:00.000Z') }),
    )
    act(() => result.current.setScope('anio'))
    act(() => result.current.step(1))
    const range = periodRange('anio', result.current.anchor, 1)
    expect(range).toEqual({ from: '2027-01-01', to: '2027-12-31' })
  })

  it('step by week honours both primerDiaSemana values without drifting', () => {
    const { result } = renderHook(() => useHistoryPeriod({ today: TODAY }))
    act(() => result.current.setScope('semana'))
    act(() => result.current.step(1))
    const rangeMonday = periodRange('semana', result.current.anchor, 1)
    const rangeSunday = periodRange('semana', result.current.anchor, 0)
    expect(rangeMonday.from <= rangeMonday.to).toBe(true)
    expect(rangeSunday.from <= rangeSunday.to).toBe(true)
    expect(rangeMonday.from > '2026-08-19').toBe(true)
    expect(rangeSunday.from > '2026-08-19').toBe(true)
  })

  it('selectYear replaces the year, keeping month/day', () => {
    const { result } = renderHook(() => useHistoryPeriod({ today: TODAY }))
    act(() => result.current.selectYear(2024))
    expect(result.current.anchor).toBe('2024-08-19')
  })

  it('selectYear clamps Feb 29 to Feb 28 when the target year is not a leap year', () => {
    const { result } = renderHook(() =>
      useHistoryPeriod({ today: new Date('2028-02-29T12:00:00.000Z') }),
    )
    expect(result.current.anchor).toBe('2028-02-29')
    act(() => result.current.selectYear(2029))
    expect(result.current.anchor).toBe('2029-02-28')
  })
})
