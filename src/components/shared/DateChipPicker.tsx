import { useEffect, useRef, useState, type Ref } from 'react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
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
  className?: string
  ref?: Ref<HTMLDivElement>
}

const WEEKDAY_SLOTS = [0, 1, 2, 3, 4, 5, 6]

/** A chip showing the selected date that expands into an inline month grid (Add/Edit/Filter sheets). */
export const DateChipPicker = ({
  value,
  onChange,
  firstDayOfWeek = 1,
  className,
  ref,
}: DateChipPickerProps) => {
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
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weekdayLabels = WEEKDAY_SLOTS.map((offset) =>
    format(addDays(gridStart, offset), 'EEEEE', { locale: es }),
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
          {format(selected, "d 'de' MMMM", { locale: es })}
          <ChevronDown
            className={cn('size-2.5 text-fg-faint transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div
          role="group"
          aria-label="Selector de fecha"
          className="mt-3 rounded-lg border border-border-subtle bg-surface-sunken p-3.5"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label="Mes anterior"
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <span className="flex size-7 items-center justify-center rounded-sm bg-muted">
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </span>
            </button>
            <span className="text-ms font-bold capitalize">
              {format(viewMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Mes siguiente"
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
                  aria-label={format(day, 'PPPP', { locale: es })}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-sm text-ms font-semibold',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : inMonth
                        ? 'text-foreground hover:bg-muted'
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
