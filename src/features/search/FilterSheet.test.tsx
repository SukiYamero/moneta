import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { es } from 'date-fns/locale'
import type { Categoria } from '@/lib/schema'
import { FilterSheet } from '@/features/search/FilterSheet'
import type { UseSearchFiltersResult } from '@/features/search/useSearchFilters'

const categories: Categoria[] = [
  { id: 'cat_comida', nombre: 'Comida', seccionId: 'sec_personal', tipo: 'gasto' },
  { id: 'cat_sueldo', nombre: 'Sueldo', seccionId: 'sec_personal', tipo: 'ingreso' },
  { id: 'cat_custom', nombre: 'Etiqueta inventada', seccionId: 'sec_personal', tipo: 'gasto' },
]

const makeFilters = (overrides: Partial<UseSearchFiltersResult> = {}): UseSearchFiltersResult => ({
  query: '',
  setQuery: vi.fn(),
  clearSearch: vi.fn(),
  debouncedQuery: '',
  rangePreset: 'all',
  setRangePreset: vi.fn(),
  customFrom: '2026-08-19',
  setCustomFrom: vi.fn(),
  customTo: '2026-08-19',
  setCustomTo: vi.fn(),
  typeFilter: 'all',
  setTypeFilter: vi.fn(),
  selectedTags: [],
  toggleTag: vi.fn(),
  dateRange: null,
  isFilterActive: false,
  clearFilters: vi.fn(),
  ...overrides,
})

describe('FilterSheet tag chips', () => {
  it("tints a selected known-category chip with that category's tint, not a uniform primary color", () => {
    render(
      <FilterSheet
        open
        onClose={vi.fn()}
        filters={makeFilters({ selectedTags: ['Comida'] })}
        categories={categories}
        firstDayOfWeek={1}
        locale="es-CO"
        dateFnsLocale={es}
        resultCount={0}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const chip = within(dialog).getByRole('button', { name: 'Comida' })
    // Comida -> 'amber' in movimientoView's CATEGORY_TINT -> chart-3.
    expect(chip.firstElementChild).toHaveClass('border-chart-3/40', 'bg-chart-3/15', 'text-chart-3')
    expect(chip.querySelector('svg')).toHaveClass('text-chart-3')
    // never the old uniform-primary selected treatment.
    expect(chip.firstElementChild).not.toHaveClass('border-primary/40')
  })

  it('falls back to the type-based tint for a selected chip with no CATEGORY_TINT entry', () => {
    render(
      <FilterSheet
        open
        onClose={vi.fn()}
        filters={makeFilters({ selectedTags: ['Etiqueta inventada'] })}
        categories={categories}
        firstDayOfWeek={1}
        locale="es-CO"
        dateFnsLocale={es}
        resultCount={0}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const chip = within(dialog).getByRole('button', { name: 'Etiqueta inventada' })
    // unmapped category, tipo: 'gasto' -> FALLBACK_TINT.gasto -> 'neutral'.
    expect(chip.firstElementChild).toHaveClass(
      'border-border-strong',
      'bg-muted',
      'text-foreground',
    )
  })

  it('always tints the icon by category, even when the chip is unselected', () => {
    render(
      <FilterSheet
        open
        onClose={vi.fn()}
        filters={makeFilters()}
        categories={categories}
        firstDayOfWeek={1}
        locale="es-CO"
        dateFnsLocale={es}
        resultCount={0}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const chip = within(dialog).getByRole('button', { name: 'Sueldo' })
    // Sueldo -> 'emerald' -> chart-1, unselected pill stays neutral.
    expect(chip.querySelector('svg')).toHaveClass('text-chart-1')
    expect(chip.firstElementChild).toHaveClass(
      'border-border-subtle',
      'bg-secondary',
      'text-fg-secondary',
    )
  })
})
