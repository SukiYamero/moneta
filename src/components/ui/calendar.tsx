import type { ComponentProps } from 'react'
import { DayPicker, getDefaultClassNames, type DayButtonProps } from 'react-day-picker'
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const chevronIcons = {
  left: ChevronLeftIcon,
  right: ChevronRightIcon,
  up: ChevronDownIcon,
  down: ChevronDownIcon,
} as const satisfies Record<'left' | 'right' | 'up' | 'down', typeof ChevronLeftIcon>

const yearsAgo = (years: number) => {
  const today = new Date()
  return new Date(today.getFullYear() - years, 0, 1)
}

const yearsAhead = (years: number) => {
  const today = new Date()
  return new Date(today.getFullYear() + years, 11, 31)
}

const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  formatters,
  labels,
  startMonth = yearsAgo(15),
  endMonth = yearsAhead(1),
  ...props
}: ComponentProps<typeof DayPicker>) => {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      startMonth={startMonth}
      endMonth={endMonth}
      className={cn(
        'group/calendar bg-surface-sunken p-3.5 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(11)]',
        className,
      )}
      locale={locale}
      formatters={{
        formatWeekdayName: (weekday, _options, dateLib) => dateLib!.format(weekday, 'EEEEE'),
        ...formatters,
      }}
      labels={{
        labelDayButton: (date, _modifiers, _options, dateLib) => dateLib!.format(date, 'PPPP'),
        ...labels,
      }}
      classNames={{
        root: cn('relative w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-2.5', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-(--cell-size) rounded-md p-0 text-fg-faint select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-(--cell-size) rounded-md p-0 text-fg-faint select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn('flex items-center justify-center gap-1.5', defaultClassNames.dropdowns),
        dropdown_root: cn(
          'relative inline-flex h-(--cell-size) min-w-11 items-center justify-center rounded-md transition-shadow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 data-[disabled=true]:opacity-50',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          'absolute inset-0 z-10 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed',
          defaultClassNames.dropdown,
        ),
        months_dropdown: defaultClassNames.months_dropdown,
        years_dropdown: defaultClassNames.years_dropdown,
        caption_label: cn(
          'flex items-center gap-1 text-ms font-bold capitalize select-none',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 rounded-(--cell-radius) text-2xs font-bold text-fg-faint select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-1 flex w-full', defaultClassNames.week),
        day: cn(
          'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none',
          defaultClassNames.day,
        ),
        today: cn('rounded-(--cell-radius)', defaultClassNames.today),
        outside: cn('text-fg-disabled aria-selected:text-fg-disabled', defaultClassNames.outside),
        disabled: cn('text-fg-disabled opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(rootClassName)} {...rootProps} />
        ),
        Chevron: ({
          className: chevronClassName,
          orientation = 'left',
          size: _size,
          ...chevronProps
        }) => {
          const Icon = chevronIcons[orientation]
          return <Icon className={cn('size-3.5', chevronClassName)} {...chevronProps} />
        },
        DayButton: CalendarDayButton,
      }}
      {...props}
    />
  )
}

const CalendarDayButton = ({ className, day: _day, modifiers, ...props }: DayButtonProps) => {
  const defaultClassNames = getDefaultClassNames()

  return (
    <button
      type="button"
      data-selected={modifiers.selected}
      data-today={modifiers.today}
      className={cn(
        'flex aspect-square size-auto w-full min-w-(--cell-size) items-center justify-center rounded-(--cell-radius) border-0 text-ms font-semibold transition-colors duration-200 ease-ios',
        'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground',
        'not-data-[selected=true]:hover:bg-muted',
        'data-[today=true]:not-data-[selected=true]:ring-1 data-[today=true]:not-data-[selected=true]:ring-inset data-[today=true]:not-data-[selected=true]:ring-primary',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  )
}

export { Calendar }
