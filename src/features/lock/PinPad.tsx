import { useTranslation } from 'react-i18next'
import { NumericKeypad } from '@/components/shared/NumericKeypad'

export const PIN_LENGTH = 4

export interface PinPadProps {
  value: string
  onChange: (next: string) => void
  maxLength?: number
  disabled?: boolean
}

export const PinPad = ({ value, onChange, maxLength = PIN_LENGTH, disabled }: PinPadProps) => {
  const { t } = useTranslation('lock')

  return (
    <NumericKeypad
      disabled={disabled}
      digitsDisabled={value.length >= maxLength}
      deleteDisabled={value.length === 0}
      deleteAriaLabel={t('screen.deleteCta')}
      onDigit={(digit) => onChange(`${value}${digit}`)}
      onDelete={() => onChange(value.slice(0, -1))}
    />
  )
}
