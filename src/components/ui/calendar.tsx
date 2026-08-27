import type { ComponentProps } from 'react'
import { DayPicker, getDefaultClassNames, type DayButtonProps } from 'react-day-picker'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  formatters,
  labels,
  ...props
}: ComponentProps<typeof DayPicker>) => {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="label"
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
        root: cn('w-fit', defaultClassNames.root),
        months: cn('flex flex-col gap-4', defaultClassNames.months),
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
          'flex h-(--cell-size) w-full items-center justify-center text-ms font-bold capitalize',
          defaultClassNames.month_caption,
        ),
        caption_label: cn('font-bold select-none', defaultClassNames.caption_label),
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
        Chevron: ({ className: chevronClassName, orientation, ...chevronProps }) =>
          orientation === 'left' ? (
            <ChevronLeftIcon className={cn('size-3.5', chevronClassName)} {...chevronProps} />
          ) : (
            <ChevronRightIcon className={cn('size-3.5', chevronClassName)} {...chevronProps} />
          ),
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
