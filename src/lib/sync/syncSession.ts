import { DRIVE_SCOPES, requestAccessToken } from '@/lib/auth'
import { accountKeyOf, useAuthStore } from '@/lib/authStore'
import { i18next } from '@/lib/i18n'
import { isSupportedLocale, type SupportedLocale } from '@/lib/i18n/resources'
import { useOutboxStore } from '@/lib/outbox'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import {
  pull,
  push,
  startSyncTriggers,
  useSyncStore,
  type SyncContext,
  type SyncTriggerHandle,
} from '@/lib/sync/engine'
import { toast } from '@/lib/toastStore'

const TOKEN_REFRESH_SKEW_MS = 60_000

const currentLocale = (): SupportedLocale => {
  const lng = i18next.resolvedLanguage ?? i18next.language
  return isSupportedLocale(lng) ? lng : 'es'
}

const reacquireDriveToken = async (): Promise<string | null> => {
  try {
    const session = await requestAccessToken('', DRIVE_SCOPES)
    useAuthStore.setState({ session })
    return session.accessToken
  } catch (e) {
    console.warn(
      'sync: could not silently refresh the Drive-scoped token, will retry on the next trigger',
      e,
    )
    return null
  }
}

export const getSyncContext = async (): Promise<SyncContext | null> => {
  const { status, drive, session, user } = useAuthStore.getState()
  if (status !== 'authenticated' || drive === null || session === null) return null

  const binding = getActiveProfileBinding()
  if (!binding) return null
  if (binding.profile.accountKey !== accountKeyOf(user)) return null

  const token =
    Date.now() >= session.expiresAt - TOKEN_REFRESH_SKEW_MS
      ? await reacquireDriveToken()
      : session.accessToken
  if (!token) return null

  return { token, profile: binding.profile, locale: currentLocale() }
}

let handle: SyncTriggerHandle | null = null

export const startSyncSession = (): void => {
  if (handle) return
  handle = startSyncTriggers(getSyncContext)
}

export const stopSyncSession = (): void => {
  handle?.stop()
  handle = null
}

export const runInitialSync = async (): Promise<void> => {
  const ctx = await getSyncContext()
  if (!ctx) return
  await pull(ctx.token, ctx.profile, ctx.locale).catch((e: unknown) =>
    console.warn('sync: initial pull failed, will retry on the next trigger', e),
  )
  if (useOutboxStore.getState().dirty) {
    await push(ctx.token, ctx.profile).catch((e: unknown) =>
      console.warn('sync: initial push failed, will retry on the next trigger', e),
    )
  }
}

export const __resetSyncSessionForTests = (): void => {
  handle?.stop()
  handle = null
}

const isEligible = (state: { status: string; drive: unknown }): boolean =>
  state.status === 'authenticated' && state.drive !== null

useAuthStore.subscribe((state, prev) => {
  if (isEligible(state) === isEligible(prev)) return
  if (isEligible(state)) startSyncSession()
  else stopSyncSession()
})

useSyncStore.subscribe((state, prev) => {
  if (state.lastPullSummary === prev.lastPullSummary) return
  const revived = state.lastPullSummary?.revivedMovIds.length ?? 0
  if (revived === 0) return
  toast.success(revived === 1 ? 'sync:notices.revived_one' : 'sync:notices.revived_other', {
    count: revived,
  })
})
