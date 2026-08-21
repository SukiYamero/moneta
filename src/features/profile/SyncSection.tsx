import { Check, CloudOff, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { accountKeyOf, useAuthStore } from '@/lib/authStore'
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
 *
 * specs.md §10.31 §4: the switcher can bind a profile that isn't the
 * currently authenticated account's own (a Google profile signed out of,
 * or the local/guest one) — before the switcher existed the bound profile
 * and the authenticated account were always the same thing, so this row
 * could assume it. It can't anymore: "switching to a Google profile you
 * are not currently signed into shows its local data with sync off — this
 * must be said, not left to be inferred from a pill that never turns
 * green." `watermark` (the *bound* profile's own record) is compared
 * against the authenticated account, not just checked for existing.
 */
export const SyncSection = () => {
  const { t } = useTranslation('profile')
  const { t: tSync } = useTranslation('sync')
  const { dateFnsLocale } = useLocaleFormatting()
  const status = useAuthStore((s) => s.status)
  const drive = useAuthStore((s) => s.drive)
  const user = useAuthStore((s) => s.user)
  const online = useNetworkStore((s) => s.online)
  const phase = useSyncStore((s) => s.phase)
  const outboxDirty = useOutboxStore((s) => s.dirty)
  const watermark = useSyncWatermark()

  if (status !== 'authenticated' || drive === null) return null
  if (watermark && watermark.accountKey !== accountKeyOf(user)) {
    return (
      <section>
        <ProfileSectionHeading>{t('sync.heading')}</ProfileSectionHeading>
        <div className="flex items-center gap-3 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fg-disabled/15 text-fg-tertiary"
          >
            <CloudOff className="size-4" />
          </div>
          <p role="status" className="text-sm font-bold text-fg-secondary">
            {tSync('status.differentAccount')}
          </p>
        </div>
      </section>
    )
  }

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
