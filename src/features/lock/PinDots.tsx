import { cn } from '@/lib/utils'

export interface PinDotsProps {
  length: number
  filled: number
  error?: boolean
}

export const PinDots = ({ length, filled, error }: PinDotsProps) => {
  return (
    <div className="flex items-center gap-3" role="presentation">
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'size-3 rounded-full border-2 transition-colors',
            error
              ? 'border-destructive bg-destructive'
              : i < filled
                ? 'border-primary bg-primary'
                : 'border-border-strong bg-transparent',
          )}
        />
      ))}
    </div>
  )
}
