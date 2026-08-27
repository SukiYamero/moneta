import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { enUS, es } from 'date-fns/locale'
import { MemoryRouter } from 'react-router'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { BottomNav } from '@/components/shared/BottomNav'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { i18next } from '@/lib/i18n'

describe('DateChipPicker', () => {
  it('shows the selected date as a formatted chip and starts collapsed', () => {
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    expect(screen.getByText('10 de agosto')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it('opens the calendar on chip tap, calls onChange with the tapped day in ISO format, and collapses', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DateChipPicker value="2026-08-10" onChange={onChange} locale="es-CO" dateFnsLocale={es} />,
    )

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    expect(screen.getByRole('group', { name: 'Selector de fecha' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'sábado, 15 de agosto de 2026' }))

    expect(onChange).toHaveBeenCalledWith('2026-08-15')
    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it.each([
    ['2026-02-10', 5],
    ['2026-08-10', 6],
  ])(
    "renders exactly the %s month's real week count (%i rows), never a padded sixth",
    async (value, expectedRows) => {
      const user = userEvent.setup()
      render(<DateChipPicker value={value} onChange={() => {}} locale="es-CO" dateFnsLocale={es} />)

      await user.click(screen.getByRole('button', { name: /de/ }))

      expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(expectedRows)
    },
  )

  it('gives every day button a 44px floor tied to the calendar-wide --cell-size token', async () => {
    const user = userEvent.setup()
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))

    expect(document.querySelector('[data-slot="calendar"]')).toHaveClass(
      '[--cell-size:--spacing(11)]',
    )
    expect(screen.getByRole('button', { name: 'sábado, 15 de agosto de 2026' })).toHaveClass(
      'min-w-(--cell-size)',
    )
  })

  it('closes only the calendar on Escape, leaves the sheet open, and returns focus to the chip', async () => {
    const user = userEvent.setup()
    const onSheetClose = vi.fn()
    render(
      <BottomSheet open onClose={onSheetClose} ariaLabel="Sheet de prueba">
        <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />
      </BottomSheet>,
    )

    const chip = screen.getByRole('button', { name: /10 de agosto/ })
    await user.click(chip)
    expect(screen.getByRole('group', { name: 'Selector de fecha' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
    expect(onSheetClose).not.toHaveBeenCalled()
    expect(chip).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onSheetClose).toHaveBeenCalledOnce()
  })

  it('hides BottomNav while the calendar is open and restores it once it closes', async () => {
    const user = userEvent.setup()
    const Harness = () => {
      const [date, setDate] = useState('2026-08-10')
      return (
        <MemoryRouter initialEntries={['/']}>
          <DateChipPicker value={date} onChange={setDate} locale="es-CO" dateFnsLocale={es} />
          <BottomNav
            profileOpen={false}
            onOpenProfile={() => {}}
            addOpen={false}
            onOpenAdd={() => {}}
          />
        </MemoryRouter>
      )
    }
    render(<Harness />)
    const nav = screen.getByRole('navigation')
    expect(nav.className).not.toMatch(/opacity-0/)

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    await vi.waitFor(() => expect(nav.className).toMatch(/opacity-0/))

    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(nav.className).not.toMatch(/opacity-0/))
  })

  it.each([
    [
      'es-CO',
      es,
      1 as const,
      /10 de agosto/,
      'lunes',
      'l',
      'agosto 2026',
      'sábado, 15 de agosto de 2026',
    ],
    [
      'en-US',
      enUS,
      0 as const,
      /August 10/,
      'Sunday',
      'S',
      'August 2026',
      'Saturday, August 15th, 2026',
    ],
  ])(
    'follows the %s locale for weekday initials, first day of week, month caption and day names',
    async (
      locale,
      dateFnsLocale,
      firstDayOfWeek,
      chipName,
      expectedFirstWeekdayName,
      expectedFirstWeekdayInitial,
      expectedCaption,
      expectedDayName,
    ) => {
      const user = userEvent.setup()
      render(
        <DateChipPicker
          value="2026-08-10"
          onChange={() => {}}
          firstDayOfWeek={firstDayOfWeek}
          locale={locale}
          dateFnsLocale={dateFnsLocale}
        />,
      )

      await user.click(screen.getByRole('button', { name: chipName }))

      const firstWeekday = screen.getAllByRole('columnheader', { hidden: true })[0]
      expect(firstWeekday).toHaveAccessibleName(expectedFirstWeekdayName)
      expect(firstWeekday).toHaveTextContent(expectedFirstWeekdayInitial)
      expect(screen.getByText(expectedCaption)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: expectedDayName })).toBeInTheDocument()
    },
  )

  describe('month and year dropdowns', () => {
    it('moving either dropdown moves the calendar to that month/year', async () => {
      const user = userEvent.setup()
      render(
        <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
      )

      await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
      expect(screen.getByRole('status')).toHaveTextContent('agosto 2026')

      await user.selectOptions(screen.getByRole('combobox', { name: 'Elegir mes' }), 'diciembre')
      expect(screen.getByRole('status')).toHaveTextContent('diciembre 2026')

      await user.selectOptions(screen.getByRole('combobox', { name: 'Elegir año' }), '2027')
      expect(screen.getByRole('status')).toHaveTextContent('diciembre 2027')
    })

    it.each([
      ['es-CO', es, /10 de agosto/, 'agosto'],
      ['en-US', enUS, /August 10/, 'August'],
    ])(
      'lists month options localized off the %s dateFnsLocale, never hardcoded English',
      async (locale, dateFnsLocale, chipName, augustLabel) => {
        const user = userEvent.setup()
        render(
          <DateChipPicker
            value="2026-08-10"
            onChange={() => {}}
            locale={locale}
            dateFnsLocale={dateFnsLocale}
          />,
        )

        await user.click(screen.getByRole('button', { name: chipName }))

        const monthSelect = screen.getByRole('combobox', { name: 'Elegir mes' })
        expect(within(monthSelect).getByRole('option', { name: augustLabel })).toBeInTheDocument()
      },
    )

    it('bounds the year select to 15 years back and 1 year ahead of today, not the library default 100 years', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-08-10T12:00:00'))
      try {
        const user = userEvent.setup()
        render(
          <DateChipPicker
            value="2026-08-10"
            onChange={() => {}}
            locale="es-CO"
            dateFnsLocale={es}
          />,
        )

        await user.click(screen.getByRole('button', { name: /10 de agosto/ }))

        const yearSelect = screen.getByRole('combobox', { name: 'Elegir año' })
        const years = within(yearSelect)
          .getAllByRole('option')
          .map((option) => option.textContent)

        expect(years).toEqual(Array.from({ length: 17 }, (_, i) => String(2011 + i)))
      } finally {
        vi.useRealTimers()
      }
    })

    it.each([
      ['es', 'Elegir mes', 'Elegir año'],
      ['en', 'Choose month', 'Choose year'],
      ['pt-BR', 'Escolher mês', 'Escolher ano'],
    ])(
      'gives the month and year selects a localized accessible name for %s',
      async (language, monthLabel, yearLabel) => {
        await i18next.changeLanguage(language)
        const user = userEvent.setup()
        render(
          <DateChipPicker
            value="2026-08-10"
            onChange={() => {}}
            locale="es-CO"
            dateFnsLocale={es}
          />,
        )

        await user.click(screen.getByRole('button', { name: /10 de agosto/ }))

        expect(screen.getByRole('combobox', { name: monthLabel })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: yearLabel })).toBeInTheDocument()

        await i18next.changeLanguage('es')
      },
    )

    it('keeps a focus-visible ring and the 44px hit area on the dropdowns now that the bordered frame is gone', async () => {
      const user = userEvent.setup()
      render(
        <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
      )

      await user.click(screen.getByRole('button', { name: /10 de agosto/ }))

      const monthRoot = screen.getByRole('combobox', { name: 'Elegir mes' }).parentElement
      expect(monthRoot).toHaveClass(
        'has-[:focus-visible]:ring-2',
        'has-[:focus-visible]:ring-ring/50',
        'h-(--cell-size)',
        'min-w-11',
        'data-[disabled=true]:opacity-50',
      )
      expect(monthRoot?.className).not.toMatch(/\bborder\b/)
      expect(monthRoot?.className).not.toMatch(/bg-background/)
    })
  })
})
