import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/components/shared/useOverlay'

export interface YearMenuProps {
  years: number[]
  selectedYear: number
  onSelect: (year: number) => void
}

/**
 * Small inline popover, not a `BottomSheet`/`CenterModal` — this is a menu
 * anchored to its trigger button, not a modal that owns the whole screen, so
 * it only needs `useEscapeToClose` (the same lightweight hook
 * `DateChipPicker`'s month popover uses) plus outside-click-to-close, not
 * `useOverlay`'s full focus-trap/scroll-lock shell.
 */
export const YearMenu = ({ years, selectedYear, onSelect }: YearMenuProps) => {
  const { t } = useTranslation('history')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEscapeToClose({ open, onClose: () => setOpen(false) })

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1 rounded-lg bg-secondary px-2.5 text-sm font-bold text-foreground"
      >
        {selectedYear}
        <ChevronDown
          className={cn('size-3 text-fg-tertiary transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('year.ariaLabel')}
          className="absolute top-full right-0 z-10 mt-1 min-w-11 rounded-xl border border-border-subtle bg-popover p-1 shadow-lg"
        >
          {years.map((year) => {
            const selected = year === selectedYear
            return (
              <button
                key={year}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSelect(year)
                  setOpen(false)
                }}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between gap-2.5 rounded-lg px-3 text-sm font-bold whitespace-nowrap',
                  selected ? 'text-foreground' : 'text-fg-secondary',
                )}
              >
                {year}
                {selected && <Check className="size-3.5 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
