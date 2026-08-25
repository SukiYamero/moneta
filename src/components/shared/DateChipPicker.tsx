import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  type Locale,
} from 'date-fns'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/components/shared/useOverlay'

export interface DateChipPickerProps {
  /** ISO `yyyy-mm-dd`, per schema.ts. */
  value: string
  onChange: (value: string) => void
  /**
   * Mirrors `Config.preferencias.primerDiaSemana`. This component stays
   * repo-agnostic (pure/presentational, per AGENTS.md) — the calling screen
   * reads the preference via the repo and passes it down.
   */
  firstDayOfWeek?: 0 | 1
  /**
   * BCP-47 locale for the chip's day+month label. Built with
   * `Intl.DateTimeFormat` rather than date-fns: date-fns' `'d MMMM'`-style
   * patterns only localize the month name, not the connector word between
   * day and month (Spanish/Portuguese "10 de agosto" vs English "August
   * 10") — a literal `"d 'de' MMMM"` pattern under an `enUS` `dateFnsLocale`
   * renders the mixed-language "10 de August" (docs/wave-2/track-m.md).
   * `Intl.DateTimeFormat`'s `{ day, month }` options localize the whole
   * phrase correctly. Same no-default rule as `MovimientoRow`'s `locale`.
   */
  locale: string
  /**
   * date-fns `Locale` for the popover's month/weekday names, where the
   * pattern has no embedded literal words (`'MMMM yyyy'`, `'EEEEE'`) so
   * date-fns' own localization is correct. Same no-default rule as
   * `MovimientoRow`'s `dateFnsLocale` (docs/wave-2/track-m.md): the calling
   * screen reads the active locale (`useLocaleFormatting()`) and passes it
   * down so this component stays i18n-agnostic.
   */
  dateFnsLocale: Locale
  className?: string
  ref?: Ref<HTMLDivElement>
}

const WEEKDAY_SLOTS = [0, 1, 2, 3, 4, 5, 6]

// A fixed 6-week (42-cell) grid, not the 4-6 weeks a month's real span
// needs: the same convention Apple Calendar and Google Calendar's month
// view use, because 6 is the maximum any month can ever require (a 31-day
// month starting on the week's last couple of days spans 6 rows) — so it's
// the only constant that never has to truncate a real day, and the grid's
// height stops changing when the user pages between months.
const WEEK_ROWS = 6

/** A chip showing the selected date that expands into an inline month grid (Add/Edit/Filter sheets). */
export const DateChipPicker = ({
  value,
  onChange,
  firstDayOfWeek = 1,
  locale,
  dateFnsLocale,
  className,
  ref,
}: DateChipPickerProps) => {
  const { t } = useTranslation('dateChipPicker')
  const selected = parseISO(value)
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Shares the overlay stack with BottomSheet/CenterModal so this popover
  // correctly outranks an ancestor sheet: Escape closes the picker first,
  // not the sheet behind it.
  useEscapeToClose({ open, onClose: () => setOpen(false) })

  const weekStartsOn = firstDayOfWeek
  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn })
  const days = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, WEEK_ROWS * 7 - 1) })
  const weekdayLabels = WEEKDAY_SLOTS.map((offset) =>
    format(addDays(gridStart, offset), 'EEEEE', { locale: dateFnsLocale }),
  )
  // Constructing an Intl.DateTimeFormat is the same non-trivial cost
  // movimientoView.ts's Intl.NumberFormat cache exists to avoid — memoized
  // per locale here rather than a module-level Map (the pure-module cache
  // pattern) because this instance is scoped to one component's props, not
  // shared across unrelated call sites.
  const dayMonthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }),
    [locale],
  )

  const handleToggle = () => {
    setViewMonth(startOfMonth(selected))
    setOpen((o) => !o)
  }

  const handleSelect = (day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div
      ref={(node) => {
        containerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as { current: HTMLDivElement | null }).current = node
      }}
      className={cn('inline-flex flex-col items-stretch', className)}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center self-center"
      >
        <span className="flex h-9 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-sunken px-3.5 text-ms font-bold text-fg-secondary">
          <CalendarDays className="size-3.5 text-fg-faint" aria-hidden="true" />
          {dayMonthFormatter.format(selected)}
          <ChevronDown
            className={cn(
              'size-2.5 text-fg-faint transition-transform duration-200 ease-ios',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div
          role="group"
          aria-label={t('groupLabel')}
          className="mt-3 animate-pop-in rounded-xl border border-border-subtle bg-surface-sunken p-3.5"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label={t('prevMonth')}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </span>
            </button>
            <span className="text-ms font-bold capitalize">
              {format(viewMonth, 'MMMM yyyy', { locale: dateFnsLocale })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label={t('nextMonth')}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </span>
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {weekdayLabels.map((label, index) => (
              <div key={index} className="text-center text-2xs font-bold text-fg-faint">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewMonth)
              const isSelected = isSameDay(day, selected)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  aria-pressed={isSelected}
                  aria-label={format(day, 'PPPP', { locale: dateFnsLocale })}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-sm text-ms font-semibold transition-colors duration-200 ease-ios',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : inMonth
                        ? [
                            'text-foreground hover:bg-muted',
                            isToday(day) && 'ring-1 ring-inset ring-primary',
                          ]
                        : 'text-fg-disabled',
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
