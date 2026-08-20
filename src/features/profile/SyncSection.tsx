import { Check, CloudOff, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { useNetworkStore } from '@/lib/networkStore'
import { useOutboxStore } from '@/lib/outbox'
import { useSyncStore } from '@/lib/sync/engine'
import { deriveSyncIndicator, type SyncIndicator } from '@/lib/sync/status'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'
import { useSyncWatermark } from '@/features/profile/useSyncWatermark'
import type es from '@/lib/i18n/locales/es.json'

type StatusKey = `status.${keyof typeof es.sync.status}`

const STATUS_LABEL_KEY: Record<SyncIndicator, StatusKey> = {
  syncing: 'status.syncing',
  pending: 'status.pending',
  up_to_date: 'status.upToDate',
}

const STATUS_ICON: Record<'offline' | SyncIndicator, typeof Check> = {
  syncing: RefreshCw,
  pending: RefreshCw,
  up_to_date: Check,
  offline: CloudOff,
}

/**
 * The Drive status row (specs.md §10.26 §4, `docs/pendientes-usuario.md`
 * item 3): last sync, pending count, offline/failed — all derived, never a
 * stored `isSynced` (`sync/status.ts`'s own reasoning). Renders nothing for
 * a guest or a signed-in user who never connected Drive — "no status row
 * promising sync" is an edge case in its own right, not just an empty
 * state.
 */
export const SyncSection = () => {
  const { t } = useTranslation('profile')
  const { t: tSync } = useTranslation('sync')
  const { dateFnsLocale } = useLocaleFormatting()
  const status = useAuthStore((s) => s.status)
  const drive = useAuthStore((s) => s.drive)
  const online = useNetworkStore((s) => s.online)
  const phase = useSyncStore((s) => s.phase)
  const outboxDirty = useOutboxStore((s) => s.dirty)
  const watermark = useSyncWatermark()

  if (status !== 'authenticated' || drive === null) return null

  const indicator = deriveSyncIndicator({ isSyncing: phase !== 'idle', outboxDirty })
  const key: 'offline' | SyncIndicator = online ? indicator : 'offline'
  const Icon = STATUS_ICON[key]
  const lastAt = watermark?.lastPullAt ?? watermark?.lastPushAt

  return (
    <section>
      <ProfileSectionHeading>{t('sync.heading')}</ProfileSectionHeading>
      <div className="flex items-center gap-3 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
        <div
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Icon className={key === 'syncing' ? 'size-4 animate-spin' : 'size-4'} />
        </div>
        <div className="min-w-0 flex-1">
          <p role="status" className="text-sm font-bold">
            {tSync(online ? STATUS_LABEL_KEY[indicator] : 'status.offline')}
          </p>
          <p className="mt-0.5 text-ms font-medium text-fg-tertiary">
            {lastAt
              ? tSync('status.lastSync', {
                  when: formatDistanceToNow(new Date(lastAt), {
                    addSuffix: true,
                    locale: dateFnsLocale,
                  }),
                })
              : tSync('status.neverSynced')}
          </p>
        </div>
      </div>
    </section>
  )
}
