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
  exiting: boolean
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

// Requests dismissal — flags the toast so its own exit animation can play; the
// real removal only happens once that animation calls removeToast.
export const dismissToast = (id: string): void => {
  clearTimer(id)
  useToastStore.setState((state) => ({
    items: state.items.map((item) => (item.id === id ? { ...item, exiting: true } : item)),
  }))
}

// The actual removal from the stack, called by Toast once its exit animation finishes.
export const removeToast = (id: string): void => {
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
  const duplicate = items.find(
    (item) => !item.exiting && item.variant === variant && item.message === message,
  )

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
    const nextItems = [...state.items, { id, variant, message, count: 1, action, exiting: false }]
    const visible = nextItems.filter((item) => !item.exiting)
    if (visible.length <= STACK_CAP) return { items: nextItems }
    // Over the cap: the oldest visible toast exits through the same animated path as any
    // other dismissal (flagged here, actually removed by removeToast once it plays out).
    const oldest = visible[0]
    if (!oldest) return { items: nextItems }
    clearTimer(oldest.id)
    return {
      items: nextItems.map((item) => (item.id === oldest.id ? { ...item, exiting: true } : item)),
    }
  })
  scheduleDismiss(id, variant)
}

export const toast = {
  success: (key: ToastMessageKey, values?: Record<string, unknown>, action?: ToastAction): void =>
    raiseToast('success', key, values, action),
  error: (key: ToastMessageKey, values?: Record<string, unknown>, action?: ToastAction): void =>
    raiseToast('error', key, values, action),
}
