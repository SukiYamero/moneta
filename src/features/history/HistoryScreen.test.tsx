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
    // specs.md §10.25: getRepo() now throws unless the boot sequence has
    // bound a profile — this suite exercises the real dataStore.load()
    // against the real fakeRepo (unlike the other screens' tests, which
    // mock repoProvider outright), so it needs to establish that binding
    // itself. profile/database are never read on this path.
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

  // The seed's latest movement is 120 days out from "today" (repo.fake.ts);
  // each scope steps far enough past that to guarantee a genuinely empty
  // period — a day, a week, a month and a year are four distinct rendering
  // paths (HistoryScreen.tsx's empty branch is scope-agnostic, but nothing
  // upstream of it should be assumed to be without checking each one).
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

  // The guarantee this track exists to produce: every figure on screen
  // traces to movimientoStats called with the screen's own scope/anchor —
  // never a second aggregation path living inside the component. Checked
  // for all four Periodo values, each computed independently in the test
  // rather than read back out of the component, so a local shortcut in
  // HistoryScreen would make this fail. (Home has no month-scoped total to
  // compare against — its balance card is all-time — so this is the
  // guarantee against movimientoStats itself, not a cross-screen diff.)
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
      const expected = totals(filterByRange(movimientos, range))
      const moneda = config.preferencias.monedaPrincipal

      // getAllByText, not getByText: when ingresos is 0 the balance figure
      // and the gasto mini-total render the identical "$ -X" text, which is
      // correct (balance == -gastos) rather than a bug to avoid — a single
      // occurrence is still enough to prove the number reached the screen.
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
    const ingresoBreakdown = breakdownBy(periodMovimientos, 'categoria', 'ingreso')
    const topIngreso = ingresoBreakdown[0]
    expect(topIngreso).toBeDefined()

    await user.click(await screen.findByRole('radio', { name: 'Ingresos' }))

    // `topIngreso.key` is a category id (specs.md §10.22) — the screen must
    // render its resolved *name*, never the raw id.
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

  // The Done-when guarantee (docs/wave-2/track-m.md): switching locale must
  // change the period's month name AND the currency formatting together —
  // a translated header still showing es-CO-formatted totals would be a
  // half-translated screen, worse than the original all-Spanish bug.
  it('renders the period month name and totals together in the locale passed by the caller', async () => {
    const user = userEvent.setup()
    await i18next.changeLanguage('en')
    render(<HistoryScreen />)
    await screen.findByText('Café de la mañana')

    await user.click(screen.getByRole('radio', { name: 'Month' }))

    const movimientos = (await fakeRepo.movimientos.list()).items
    const config = await fakeRepo.getConfig()
    const range = periodRange('mes', seedTodayIso, config.preferencias.primerDiaSemana)
    const expected = totals(filterByRange(movimientos, range))
    const moneda = config.preferencias.monedaPrincipal

    expect(screen.getByText(new RegExp(`^[A-Z][a-z]+ \\d{4}$`))).toBeInTheDocument()
    // Device region is stubbed to CO (src/test/setup.ts); it's independent
    // of the copy locale, so switching copy to `en` formats as en-CO here,
    // not en-US (specs.md §10.7).
    expect(
      await screen.findAllByText(money(formatMontoWithSign(expected.ingresos, moneda, 'en-CO'))),
    ).not.toHaveLength(0)

    await i18next.changeLanguage('es')
  })

  it('tapping a row opens the movement sheet for that id (specs.md §10.23)', async () => {
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
