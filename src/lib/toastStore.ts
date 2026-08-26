import { create } from 'zustand'
import { i18next } from '@/lib/i18n'
import type es from '@/lib/i18n/locales/es.json'

export type ToastVariant = 'success' | 'error'

type LeafPath<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPath<T[K]>}` }[keyof T &
      string]

export type ToastMessageKey = {
  [NS in keyof typeof es]: `${NS}:${LeafPath<(typeof es)[NS]>}`
}[keyof typeof es]

export interface ToastAction {
  labelKey: ToastMessageKey
  onAction: () => void
}

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  count: number
  action?: ToastAction
}

interface ToastStoreState {
  items: ToastItem[]
}

const STACK_CAP = 3

const DURATION_MS: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
}

export const useToastStore = create<ToastStoreState>(() => ({ items: [] }))

const timers = new Map<string, ReturnType<typeof setTimeout>>()

const clearTimer = (id: string): void => {
  const handle = timers.get(id)
  if (handle === undefined) return
  clearTimeout(handle)
  timers.delete(id)
}

const clearAllTimers = (): void => {
  for (const handle of timers.values()) clearTimeout(handle)
  timers.clear()
}

export const dismissToast = (id: string): void => {
  clearTimer(id)
  useToastStore.setState((state) => ({ items: state.items.filter((item) => item.id !== id) }))
}

const scheduleDismiss = (id: string, variant: ToastVariant): void => {
  timers.set(
    id,
    setTimeout(() => dismissToast(id), DURATION_MS[variant]),
  )
}

let suppressed = true

export const setToastsSuppressed = (value: boolean): void => {
  suppressed = value
  if (!value) return
  clearAllTimers()
  useToastStore.setState({ items: [] })
}

const raiseToast = (
  variant: ToastVariant,
  key: ToastMessageKey,
  values: Record<string, unknown> | undefined,
  action: ToastAction | undefined,
): void => {
  if (suppressed) return

  const message = i18next.t(key, values)

  const { items } = useToastStore.getState()
  const duplicate = items.find((item) => item.variant === variant && item.message === message)

  if (duplicate) {
    clearTimer(duplicate.id)
    scheduleDismiss(duplicate.id, variant)
    useToastStore.setState((state) => ({
      items: state.items.map((item) =>
        item.id === duplicate.id ? { ...item, count: item.count + 1 } : item,
      ),
    }))
    return
  }

  const id = crypto.randomUUID()
  useToastStore.setState((state) => {
    const nextItems = [...state.items, { id, variant, message, count: 1, action }]
    if (nextItems.length <= STACK_CAP) return { items: nextItems }
    const oldest = nextItems[0]
    if (oldest) clearTimer(oldest.id)
    return { items: nextItems.slice(1) }
  })
  scheduleDismiss(id, variant)
}

export const toast = {
  success: (key: ToastMessageKey, values?: Record<string, unknown>, action?: ToastAction): void =>
    raiseToast('success', key, values, action),
  error: (key: ToastMessageKey, values?: Record<string, unknown>, action?: ToastAction): void =>
    raiseToast('error', key, values, action),
}
