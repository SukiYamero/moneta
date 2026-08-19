import { create } from 'zustand'

export type ToastVariant = 'success' | 'error'

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  /** How many times this exact (variant, message) pair has been re-raised while still on screen. */
  count: number
}

interface ToastStoreState {
  items: ToastItem[]
}

/** A 4th arrival drops the oldest immediately — a retry loop must not paper the screen (specs.md §10.6). */
const STACK_CAP = 3

const DURATION_MS: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
}

/**
 * Plain zustand store, exported directly (not wrapped) so it can be driven
 * imperatively via `.getState()`/`.setState()` from anywhere — the same
 * pattern `useLockStore`/`useAuthStore` already use — while `Toaster` still
 * subscribes to it as an ordinary hook.
 */
export const useToastStore = create<ToastStoreState>(() => ({ items: [] }))

// Timeout handles live outside zustand state on purpose: they aren't
// serializable data the UI renders from, just bookkeeping for each card's
// own independent countdown ("each keeps its own timer", specs.md §10.6).
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

/** Dismisses a toast immediately — called by its own timer, or by the card's swipe/close affordance. */
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

// This module holds no domain state and reads no store (specs.md §10.6) —
// it doesn't know a lock exists. Suppression is a plain boolean flag driven
// from outside (AppLock, today) rather than an import of lockStore, so the
// dependency points policy → surface, not the other way round, and nothing
// that merely raises a toast drags in WebCrypto/Dexie transitively.
// Starts suppressed: before whatever owns the flag has run its first
// effect, there's no reason to assume it's safe to show anything.
let suppressed = true

/**
 * Turning suppression on drops whatever is currently in the stack, not just
 * future arrivals — a toast already showing (or still timing out
 * off-screen) when suppression engages must not resurface once it's lifted,
 * the same "dropped, not queued" guarantee raiseToast enforces on the way
 * in (specs.md §10.6).
 */
export const setToastsSuppressed = (value: boolean): void => {
  suppressed = value
  if (!value) return
  clearAllTimers()
  useToastStore.setState({ items: [] })
}

const raiseToast = (variant: ToastVariant, message: string): void => {
  if (suppressed) return

  const { items } = useToastStore.getState()
  const duplicate = items.find((item) => item.variant === variant && item.message === message)

  if (duplicate) {
    // A re-raised identical (variant, message) pair is the same
    // notification happening again, not a distinct later arrival — the
    // "a later arrival never resets an earlier one" rule protects
    // *distinct* toasts from each other, so restarting this one card's own
    // clock is the intended reading, not a violation of it.
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
    const nextItems = [...state.items, { id, variant, message, count: 1 }]
    if (nextItems.length <= STACK_CAP) return { items: nextItems }
    const oldest = nextItems[0]
    if (oldest) clearTimer(oldest.id)
    return { items: nextItems.slice(1) }
  })
  scheduleDismiss(id, variant)
}

/**
 * The whole public surface: plain functions, callable from anywhere (a
 * store, an event handler, a component) with no provider and no React
 * context. Callers pass already-localized copy (`t('…')`) — this module
 * never looks up copy itself and must never be handed a raw `error.message`
 * (docs/error-handling.md §5/§7).
 */
export const toast = {
  success: (message: string): void => raiseToast('success', message),
  error: (message: string): void => raiseToast('error', message),
}
