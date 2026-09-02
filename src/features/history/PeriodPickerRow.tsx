import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { PeriodOption } from '@/features/history/historyPeriodOptions'

export interface PeriodPickerRowProps {
  options: PeriodOption[]
  onSelect: (iso: string) => void
  'aria-label': string
}

export const PeriodPickerRow = ({
  options,
  onSelect,
  'aria-label': ariaLabel,
}: PeriodPickerRowProps) => {
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // jsdom has no scrollIntoView implementation.
    selectedRef.current?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  return (
    <div
      role="listbox"
      aria-label={ariaLabel}
      className="flex touch-pan-x gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => (
        <button
          key={option.iso}
          type="button"
          role="option"
          aria-selected={option.selected}
          ref={option.selected ? selectedRef : undefined}
          onClick={() => onSelect(option.iso)}
          className={cn(
            'flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.75 rounded-xl px-2.5 text-sm font-bold',
            option.selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
        >
          {option.caption && (
            <span
              className={cn(
                'text-2xs font-semibold uppercase',
                option.selected ? 'text-primary-foreground/60' : 'text-fg-faint',
              )}
            >
              {option.caption}
            </span>
          )}
          <span className="capitalize">{option.label}</span>
          <span
            className={cn(
              'size-1 rounded-full',
              option.hasData && !option.selected ? 'bg-primary' : 'bg-transparent',
            )}
          />
        </button>
      ))}
    </div>
  )
}
