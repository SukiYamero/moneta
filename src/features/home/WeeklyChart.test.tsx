import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { i18next } from '@/lib/i18n'
import type { SeriesBucket } from '@/lib/movimientoStats'

// jsdom has no ResizeObserver, so recharts' ResponsiveContainer always
// measures 0x0 and never renders the underlying SVG (Bar/Cell) — asserting
// against the real recharts output would be a false-negative-proof test
// that only ever exercises the code path where nothing renders. Stand-ins
// that forward the props Home actually sets let this test prove the real
// thing under review: which color each day resolves to, and whether the
// animation flag is actually wired to `usePrefersReducedMotion`.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  BarChart: ({ data, children }: { data: SeriesBucket[]; children: ReactNode }) => (
    <div data-testid="bar-chart" data-bucket-count={data.length}>
      {children}
    </div>
  ),
  Bar: ({ isAnimationActive, children }: { isAnimationActive: boolean; children: ReactNode }) => (
    <div data-testid="bar" data-animated={String(isAnimationActive)}>
      {children}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill} />,
}))

const { WeeklyChart } = await import('@/features/home/WeeklyChart')

const TODAY = '2026-08-19'
const WEEK_ISOS = [
  '2026-08-17',
  '2026-08-18',
  '2026-08-19',
  '2026-08-20',
  '2026-08-21',
  '2026-08-22',
  '2026-08-23',
]

const week = (overrides: Record<string, number> = {}): SeriesBucket[] =>
  WEEK_ISOS.map((bucketStart) => ({
    bucketStart,
    ingresos: 0,
    gastos: overrides[bucketStart] ?? 0,
  }))

const stubMatchMedia = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WeeklyChart', () => {
  it('renders exactly seven buckets for a week with no movements at all', () => {
    render(<WeeklyChart chart={week()} totalGastos={0} moneda="COP" todayIso={TODAY} />)

    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-bucket-count', '7')
    expect(screen.getAllByTestId('cell')).toHaveLength(7)
  })

  it('colors every zero day as the near-invisible "zero" tint, including today', () => {
    render(<WeeklyChart chart={week()} totalGastos={0} moneda="COP" todayIso={TODAY} />)

    const cells = screen.getAllByTestId('cell')
    // Today (index 2, 2026-08-19) is zero-value but still "today" —
    // barStatus must prioritize the today check over the zero check.
    expect(cells[2]).toHaveAttribute('data-fill', 'var(--primary)')
    for (const [i, cell] of cells.entries()) {
      if (i === 2) continue
      expect(cell).toHaveAttribute('data-fill', 'var(--color-border-subtle)')
    }
  })

  it('renders a single enormous outlier without dropping or miscoloring any bucket', () => {
    const chart = week({ '2026-08-20': 999_999_999 })
    render(<WeeklyChart chart={chart} totalGastos={999_999_999} moneda="COP" todayIso={TODAY} />)

    const cells = screen.getAllByTestId('cell')
    expect(cells).toHaveLength(7)
    // index 3 = 2026-08-20, the outlier: non-today, non-zero -> "value" tint.
    expect(cells[3]).toHaveAttribute('data-fill', 'var(--color-fg-disabled)')
    expect(cells[2]).toHaveAttribute('data-fill', 'var(--primary)')
    expect(screen.getAllByText(/\$\s*999\.999\.999,00/).length).toBeGreaterThan(0)
  })

  it.each([
    [false, 'true'],
    [true, 'false'],
  ] as const)('prefers-reduced-motion=%s -> isAnimationActive=%s', (prefersReduced, expectedAnimated) => {
    stubMatchMedia(prefersReduced)
    render(<WeeklyChart chart={week()} totalGastos={0} moneda="COP" todayIso={TODAY} />)

    expect(screen.getByTestId('bar')).toHaveAttribute('data-animated', expectedAnimated)
  })

  // Switching locale must change currency formatting AND day labels
  // together — a half-translated chart is worse than an all-Spanish one.
  it('renders money and day labels together in the locale passed by the caller', async () => {
    await i18next.changeLanguage('en')
    render(<WeeklyChart chart={week()} totalGastos={1999} moneda="USD" todayIso={TODAY} />)

    expect(screen.getByText('$1,999.00')).toBeInTheDocument()
    // 2026-08-17 (the first bucket) is a Monday: "L" in Spanish, "M" in English.
    expect(screen.getAllByText('M', { exact: true }).length).toBeGreaterThan(0)
    expect(screen.queryByText('L', { exact: true })).not.toBeInTheDocument()

    await i18next.changeLanguage('es')
  })
})
