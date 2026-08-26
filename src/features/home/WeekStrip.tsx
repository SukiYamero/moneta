import { cn } from '@/lib/utils'
import type { WeekStripDay } from '@/features/home/homeView'

export interface WeekStripProps {
  monthLabel: string
  days: WeekStripDay[]
}

export const WeekStrip = ({ monthLabel, days }: WeekStripProps) => {
  return (
    <div>
      <div className="mb-3.5 px-1 text-sm font-bold">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <div
            key={day.iso}
            className={cn(
              'flex flex-col items-center gap-1.75 rounded-2xl py-2',
              day.isToday && 'bg-primary',
            )}
          >
            <span
              className={cn(
                'text-2xs font-semibold tracking-wide uppercase',
                day.isToday ? 'text-primary-foreground' : 'text-fg-tertiary',
              )}
            >
              {day.dayLabel}
            </span>
            <span
              className={cn(
                'text-md font-bold',
                day.isToday ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {day.dayNumber}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'size-1.25 rounded-full',
                day.isToday
                  ? 'bg-primary-foreground'
                  : day.hasMovimientos
                    ? 'bg-primary'
                    : 'bg-transparent',
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
