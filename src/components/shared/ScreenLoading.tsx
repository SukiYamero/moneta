import { Coins, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface ScreenLoadingProps {
  className?: string
}

export const ScreenLoading = ({ className }: ScreenLoadingProps = {}) => {
  const { t } = useTranslation('common')

  return (
    <div
      className={cn(
        'flex min-h-full flex-col items-center justify-center gap-6 bg-background px-8 text-center text-foreground',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-[5.25rem] items-center justify-center rounded-4xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))]"
      >
        <Coins className="size-10 text-primary-foreground" strokeWidth={2.25} />
      </div>
      <div
        role="status"
        className="flex items-center gap-2.5 text-sm font-semibold text-fg-secondary"
      >
        <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
        <span>{t('loading')}</span>
      </div>
    </div>
  )
}
