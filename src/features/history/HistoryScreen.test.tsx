import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { fakeRepo } from '@/lib/repo.fake'
import { bindActiveProfile } from '@/lib/repoProvider'
import type { ProfileDb } from '@/lib/db'
import { breakdownBy, filterByRange, periodRange, totals } from '@/lib/movimientoStats'
import { formatMonto, formatMontoWithSign } from '@/components/shared/movimientoView'
import { i18next } from '@/lib/i18n'
import { useMovimientoSheetStore } from '@/features/movimientos'

// A UTC-midnight date string parses as the previous calendar day under a
// negative-UTC-offset TZ, so this reads the seed's real date rather than hardcoding one.
let seedTodayIso: string

// Testing Library's default text normalizer collapses whitespace on the DOM side only, never the query string.
const money = (text: string): string => text.replaceAll(' ', ' ')

describe('HistoryScreen', () => {
  beforeEach(async () => {
    bindActiveProfile({ profile: {} as never, database: {} as ProfileDb, repo: fakeRepo })
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

  it.each([
    ['Semana', 30],
    ['Mes', 6],
    ['Año', 1],
  ] as const)('shows the empty state for a %s with no movements', async (scopeLabel, steps) => {
    const user = userEvent.setup()
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')
    await user.click(screen.getByRole('radio', { name: scopeLabel }))

    for (let i = 0; i < steps; i++) {
      await user.click(screen.getByRole('button', { name: /periodo siguiente/i }))
    }

    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument()
    expect(screen.getByText('No hay registros en este periodo')).toBeInTheDocument()
  })

  it.each([
    ['dia', 'Día'],
    ['semana', 'Semana'],
    ['mes', 'Mes'],
    ['anio', 'Año'],
  ] as const)(
    "the %s scope's balance card matches an independent movimientoStats computation for the same range",
    async (periodo, scopeLabel) => {
      const user = userEvent.setup()
      render(<HistoryScreen />)
      await screen.findByText('Café de la mañana')

      await user.click(screen.getByRole('radio', { name: scopeLabel }))

      const movimientos = (await fakeRepo.movimientos.list()).items
      const config = await fakeRepo.getConfig()
      const range = periodRange(periodo, seedTodayIso, config.preferencias.primerDiaSemana)
      const moneda = config.preferencias.monedaPrincipal
      const expected = totals(filterByRange(movimientos, range), moneda)

      expect(
        await screen.findAllByText(money(formatMontoWithSign(expected.ingresos, moneda, 'es-CO'))),
      ).not.toHaveLength(0)
      expect(
        screen.getAllByText(money(formatMontoWithSign(-expected.gastos, moneda, 'es-CO'))),
      ).not.toHaveLength(0)
    },
  )

  it('breakdown tabs switch between gasto/ingreso shares via breakdownBy, not a local computation', async () => {
    const user = userEvent.setup()
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')
    await user.click(screen.getByRole('radio', { name: 'Mes' }))

    const movimientos = (await fakeRepo.movimientos.list()).items
    const config = await fakeRepo.getConfig()
    const range = periodRange('mes', seedTodayIso, config.preferencias.primerDiaSemana)
    const periodMovimientos = filterByRange(movimientos, range)
    const ingresoBreakdown = breakdownBy(
      periodMovimientos,
      'ingreso',
      config.preferencias.monedaPrincipal,
    )
    const topIngreso = ingresoBreakdown[0]
    expect(topIngreso).toBeDefined()

    await user.click(await screen.findByRole('radio', { name: 'Ingresos' }))

    const topIngresoName = config.categorias.find((c) => c.id === topIngreso!.key)?.nombre
    expect(topIngresoName).toBeDefined()
    expect(await screen.findByText(topIngresoName!)).toBeInTheDocument()
    expect(screen.queryByText(topIngreso!.key)).not.toBeInTheDocument()
    expect(
      screen.getByText(
        money(formatMonto(topIngreso!.total, config.preferencias.monedaPrincipal, 'es-CO')),
      ),
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

  it('renders the period month name and totals together in the locale passed by the caller', async () => {
    const user = userEvent.setup()
    await i18next.changeLanguage('en')
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')

    await user.click(screen.getByRole('radio', { name: 'Month' }))

    const movimientos = (await fakeRepo.movimientos.list()).items
    const config = await fakeRepo.getConfig()
    const range = periodRange('mes', seedTodayIso, config.preferencias.primerDiaSemana)
    const moneda = config.preferencias.monedaPrincipal
    const expected = totals(filterByRange(movimientos, range), moneda)

    expect(screen.getByText(new RegExp(`^[A-Z][a-z]+ \\d{4}$`))).toBeInTheDocument()
    expect(
      await screen.findAllByText(money(formatMontoWithSign(expected.ingresos, moneda, 'en-CO'))),
    ).not.toHaveLength(0)

    await i18next.changeLanguage('es')
  })

  it('tapping a row opens the movement sheet for that id', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
    render(<HistoryScreen />)
    const row = await screen.findByRole('button', { name: /café de la mañana/i })

    await user.click(row)

    const movimientos = (await fakeRepo.movimientos.list()).items
    const clicked = movimientos.find((m) => m.nota === 'Café de la mañana')!
    expect(useMovimientoSheetStore.getState().viewId).toBe(clicked.id)
  })
})
