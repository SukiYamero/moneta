import { useEffect, useRef, type Ref } from 'react'
import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

const DELETE_REPEAT_INITIAL_DELAY_MS = 450
const DELETE_REPEAT_INTERVAL_MS = 80

type PadKey =
  | { kind: 'digit'; digit: number }
  | { kind: 'blank' }
  | { kind: 'delete' }
  | { kind: 'decimal' }

const buildKeys = (hasDecimal: boolean): PadKey[] => [
  { kind: 'digit', digit: 1 },
  { kind: 'digit', digit: 2 },
  { kind: 'digit', digit: 3 },
  { kind: 'digit', digit: 4 },
  { kind: 'digit', digit: 5 },
  { kind: 'digit', digit: 6 },
  { kind: 'digit', digit: 7 },
  { kind: 'digit', digit: 8 },
  { kind: 'digit', digit: 9 },
  hasDecimal ? { kind: 'decimal' } : { kind: 'blank' },
  { kind: 'digit', digit: 0 },
  { kind: 'delete' },
]

export type NumericKeypadSize = 'default' | 'compact'

const KEY_SHAPE_CLASS =
  'flex items-center justify-center rounded-3xl transition-colors active:bg-border-hover aria-disabled:opacity-40'
const KEY_HEIGHT_CLASS: Record<NumericKeypadSize, string> = {
  default: 'min-h-15.5',
  compact: 'min-h-13.25',
}
const NUMERAL_KEY_CLASS = 'bg-border text-[1.5rem] font-semibold text-foreground'

export interface NumericKeypadProps {
  onDigit: (digit: number) => void
  onDelete: () => void
  onDecimal?: () => void
  decimalLabel?: string
  decimalAriaLabel?: string
  deleteAriaLabel: string
  digitsDisabled?: boolean
  decimalDisabled?: boolean
  deleteDisabled?: boolean
  disabled?: boolean
  deleteAutoRepeat?: boolean
  className?: string
  size?: NumericKeypadSize
  ref?: Ref<HTMLDivElement>
}

export const NumericKeypad = ({
  onDigit,
  onDelete,
  onDecimal,
  decimalLabel,
  decimalAriaLabel,
  deleteAriaLabel,
  digitsDisabled,
  decimalDisabled,
  deleteDisabled,
  disabled,
  deleteAutoRepeat,
  className,
  size = 'default',
  ref,
}: NumericKeypadProps) => {
  const keys = buildKeys(decimalLabel !== undefined)
  const keyShapeClass = cn(KEY_SHAPE_CLASS, KEY_HEIGHT_CLASS[size])

  const isDeleteDisabled = disabled || deleteDisabled
  const isDeleteDisabledRef = useRef(isDeleteDisabled)
  isDeleteDisabledRef.current = isDeleteDisabled
  const onDeleteRef = useRef(onDelete)
  onDeleteRef.current = onDelete

  const deleteRepeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const repeatEngagedRef = useRef(false)

  const stopDeleteRepeat = () => {
    if (deleteRepeatTimeoutRef.current !== null) {
      clearTimeout(deleteRepeatTimeoutRef.current)
      deleteRepeatTimeoutRef.current = null
    }
    if (deleteRepeatIntervalRef.current !== null) {
      clearInterval(deleteRepeatIntervalRef.current)
      deleteRepeatIntervalRef.current = null
    }
  }

  useEffect(() => stopDeleteRepeat, [])

  const handleDeletePointerDown = () => {
    if (!deleteAutoRepeat || isDeleteDisabledRef.current) return
    repeatEngagedRef.current = false
    deleteRepeatTimeoutRef.current = setTimeout(() => {
      if (isDeleteDisabledRef.current) return
      repeatEngagedRef.current = true
      onDeleteRef.current()
      deleteRepeatIntervalRef.current = setInterval(() => {
        if (isDeleteDisabledRef.current) {
          stopDeleteRepeat()
          return
        }
        onDeleteRef.current()
      }, DELETE_REPEAT_INTERVAL_MS)
    }, DELETE_REPEAT_INITIAL_DELAY_MS)
  }

  const handleDeleteClick = () => {
    if (isDeleteDisabled) return
    if (deleteAutoRepeat && repeatEngagedRef.current) {
      repeatEngagedRef.current = false
      return
    }
    onDelete()
  }

  return (
    <div
      ref={ref}
      className={cn('grid w-full grid-cols-3 gap-3', className)}
      // preventDefault on pointerdown cancels a button's default focus-shift
      // without canceling the click that still fires, per the Pointer Events spec.
      onPointerDown={(event) => event.preventDefault()}
    >
      {keys.map((key, i) => {
        if (key.kind === 'blank') return <div key={`blank-${i}`} aria-hidden="true" />

        if (key.kind === 'delete') {
          return (
            <button
              key="delete"
              type="button"
              aria-disabled={isDeleteDisabled}
              onPointerDown={handleDeletePointerDown}
              onPointerUp={stopDeleteRepeat}
              onPointerLeave={stopDeleteRepeat}
              onPointerCancel={stopDeleteRepeat}
              onClick={handleDeleteClick}
              aria-label={deleteAriaLabel}
              className={cn(keyShapeClass, 'bg-border-subtle text-foreground')}
            >
              <Delete aria-hidden="true" className="size-5.5 text-fg-tertiary" />
            </button>
          )
        }

        if (key.kind === 'decimal') {
          const isDisabled = disabled || decimalDisabled
          return (
            <button
              key="decimal"
              type="button"
              aria-disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onDecimal?.()
              }}
              aria-label={decimalAriaLabel}
              className={cn(keyShapeClass, NUMERAL_KEY_CLASS)}
            >
              {decimalLabel}
            </button>
          )
        }

        const isDisabled = disabled || digitsDisabled
        return (
          <button
            key={key.digit}
            type="button"
            aria-disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onDigit(key.digit)
            }}
            className={cn(keyShapeClass, NUMERAL_KEY_CLASS)}
          >
            {key.digit}
          </button>
        )
      })}
    </div>
  )
}
