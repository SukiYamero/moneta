import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('passes isAnimationActive=true when the user has no reduced-motion preference', () => {
    stubMatchMedia(false)
    render(<WeeklyChart chart={week()} totalGastos={0} moneda="COP" todayIso={TODAY} />)

    expect(screen.getByTestId('bar')).toHaveAttribute('data-animated', 'true')
  })

  it('passes isAnimationActive=false when the user prefers reduced motion', () => {
    stubMatchMedia(true)
    render(<WeeklyChart chart={week()} totalGastos={0} moneda="COP" todayIso={TODAY} />)

    expect(screen.getByTestId('bar')).toHaveAttribute('data-animated', 'false')
  })
})
