import { useMemo, useState, type Ref } from 'react'
import { format, parseISO, startOfMonth, type Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/components/shared/useOverlay'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

export interface DateChipPickerProps {
  value: string
  onChange: (value: string) => void
  firstDayOfWeek?: 0 | 1
  locale: string
  dateFnsLocale: Locale
  className?: string
  ref?: Ref<HTMLDivElement>
}

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

  // Radix's own capture-phase Escape handling (popover.tsx) already stops the
  // event before it reaches this hook's bubble-phase listener and closes the
  // popover itself via `onOpenChange` — this call only registers the
  // calendar on the shared overlay stack so BottomNav stays hidden.
  useEscapeToClose({ open, onClose: () => setOpen(false) })

  const dayMonthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }),
    [locale],
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setViewMonth(startOfMonth(selected))
    setOpen(nextOpen)
  }

  const handleSelect = (day: Date | undefined) => {
    if (!day) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('inline-flex flex-col items-stretch', className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
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
        </PopoverTrigger>
        <PopoverContent
          role="group"
          aria-label={t('groupLabel')}
          align="center"
          sideOffset={8}
          className="w-auto p-0"
        >
          <Calendar
            mode="single"
            required={false}
            selected={selected}
            onSelect={handleSelect}
            month={viewMonth}
            onMonthChange={setViewMonth}
            weekStartsOn={firstDayOfWeek}
            locale={dateFnsLocale}
            labels={{
              labelPrevious: () => t('prevMonth'),
              labelNext: () => t('nextMonth'),
              labelMonthDropdown: () => t('monthDropdown'),
              labelYearDropdown: () => t('yearDropdown'),
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
