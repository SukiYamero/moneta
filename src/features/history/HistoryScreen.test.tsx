import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { fakeRepo } from '@/lib/repo.fake'
import { breakdownBy, filterByRange, periodRange, totals } from '@/lib/movimientoStats'
import { formatMonto } from '@/components/shared/movimientoView'

// The fake repo's seed data is pinned to a fixed clock (repo.fake.ts,
// independent of the system clock), so pinning the system clock here to the
// same moment is what makes "today"'s dia scope show real seed data.
// Read the seed's own "day 0" fecha rather than assuming a literal date
// string: `repo.fake.ts` derives it via `format(subDays(seedDate, 0), ...)`,
// a *local*-calendar-day format of a UTC-midnight instant, which lands on
// the previous calendar day under any negative-UTC-offset TZ (see
// docs/wave-2/track-e4.md) — asserting against the real value keeps this
// suite correct under any TZ instead of baking in that same assumption.
let seedTodayIso: string

// `getByText`'s default normalizer collapses whitespace runs (including
// Intl's U+00A0 between currency symbol and amount) to a plain space on the
// DOM side only, never on the query string — so a query built from
// `formatMonto` (which contains a raw NBSP) needs the same collapse or it
// can never match.
const money = (text: string): string => text.replaceAll(' ', ' ')

describe('HistoryScreen', () => {
  beforeEach(async () => {
    const movimientos = (await fakeRepo.movimientos.list()).items
    seedTodayIso = movimientos.find((m) => m.nota === 'Café de la mañana')!.fecha
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${seedTodayIso}T12:00:00`))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('has an accessible "Historial" heading', async () => {
    render(<HistoryScreen />)
    expect(await screen.findByRole('heading', { name: /historial/i })).toBeInTheDocument()
  })

  it('defaults to día scope on today, showing that day’s real movements', async () => {
    render(<HistoryScreen />)
    expect(await screen.findByText('Café de la mañana')).toBeInTheDocument()
  })

  it('shows the empty state for a day with no movements', async () => {
    const user = userEvent.setup()
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')

    await user.click(screen.getByRole('button', { name: /periodo siguiente/i }))

    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument()
    expect(screen.getByText('No hay registros en este periodo')).toBeInTheDocument()
  })

  it('mes scope totals match movimientoStats for the same month — the cross-screen guarantee', async () => {
    const user = userEvent.setup()
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')

    await user.click(screen.getByRole('radio', { name: 'Mes' }))

    const movimientos = (await fakeRepo.movimientos.list()).items
    const config = await fakeRepo.getConfig()
    const range = periodRange('mes', seedTodayIso, config.preferencias.primerDiaSemana)
    const expected = totals(filterByRange(movimientos, range))
    const moneda = config.preferencias.monedaPrincipal

    expect(
      await screen.findByText(money(`+${formatMonto(expected.ingresos, moneda)}`)),
    ).toBeInTheDocument()
    expect(screen.getByText(money(`-${formatMonto(expected.gastos, moneda)}`))).toBeInTheDocument()
  })

  it('breakdown tabs switch between gasto/ingreso shares via breakdownBy, not a local computation', async () => {
    const user = userEvent.setup()
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')
    await user.click(screen.getByRole('radio', { name: 'Mes' }))

    const movimientos = (await fakeRepo.movimientos.list()).items
    const config = await fakeRepo.getConfig()
    const range = periodRange('mes', seedTodayIso, config.preferencias.primerDiaSemana)
    const periodMovimientos = filterByRange(movimientos, range)
    const ingresoBreakdown = breakdownBy(periodMovimientos, 'categoria', 'ingreso')
    const topIngreso = ingresoBreakdown[0]
    expect(topIngreso).toBeDefined()

    await user.click(await screen.findByRole('radio', { name: 'Ingresos' }))

    expect(await screen.findByText(topIngreso!.key)).toBeInTheDocument()
    expect(
      screen.getByText(money(formatMonto(topIngreso!.total, config.preferencias.monedaPrincipal))),
    ).toBeInTheDocument()
  })

  it('year menu opens on the trigger and lists the current data year as selected', async () => {
    const user = userEvent.setup()
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')

    await user.click(screen.getByRole('button', { name: '2026' }))
    const menu = screen.getByRole('listbox', { name: /elegir año/i })
    expect(within(menu).getByRole('option', { name: '2026' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
