import { Delete } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type PadKey = { kind: 'digit'; digit: number } | { kind: 'blank' } | { kind: 'delete' }

// 12 slots (3x4), matching the design export's own padKeys shape: digits
// 0-9, a blank cell for grid alignment, and delete — never a submit button,
// LockScreen/PinSetup both auto-advance once maxLength digits are entered.
const PAD_KEYS: PadKey[] = [
  { kind: 'digit', digit: 1 },
  { kind: 'digit', digit: 2 },
  { kind: 'digit', digit: 3 },
  { kind: 'digit', digit: 4 },
  { kind: 'digit', digit: 5 },
  { kind: 'digit', digit: 6 },
  { kind: 'digit', digit: 7 },
  { kind: 'digit', digit: 8 },
  { kind: 'digit', digit: 9 },
  { kind: 'blank' },
  { kind: 'digit', digit: 0 },
  { kind: 'delete' },
]

// Single source of truth for the PIN length, shared with `LockScreen`/`PinSetup`.
export const PIN_LENGTH = 4

export interface PinPadProps {
  value: string
  onChange: (next: string) => void
  maxLength?: number
  disabled?: boolean
}

/** Numeric keypad shared by `LockScreen` and `PinSetup` — the export's own 3x4 `padKeys` grid. */
export const PinPad = ({ value, onChange, maxLength = PIN_LENGTH, disabled }: PinPadProps) => {
  const { t } = useTranslation('lock')

  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {PAD_KEYS.map((key, i) => {
        if (key.kind === 'blank') return <div key={`blank-${i}`} aria-hidden="true" />
        if (key.kind === 'delete') {
          return (
            <button
              key="delete"
              type="button"
              disabled={disabled || value.length === 0}
              onClick={() => onChange(value.slice(0, -1))}
              aria-label={t('screen.deleteCta')}
              className="flex min-h-14 items-center justify-center rounded-2xl text-foreground transition-colors active:bg-muted disabled:opacity-40"
            >
              <Delete aria-hidden="true" className="size-5" />
            </button>
          )
        }
        return (
          <button
            key={key.digit}
            type="button"
            disabled={disabled || value.length >= maxLength}
            onClick={() => onChange(`${value}${key.digit}`)}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-card text-xl font-semibold text-foreground transition-colors active:bg-muted disabled:opacity-40"
          >
            {key.digit}
          </button>
        )
      })}
    </div>
  )
}
