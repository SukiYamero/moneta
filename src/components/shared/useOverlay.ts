import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'

export interface UseOverlayOptions<T extends HTMLElement> {
  open: boolean
  onClose: () => void
  initialFocus?: RefObject<HTMLElement | null>
  ref?: Ref<T>
}

export type OverlayLabelProps =
  | { labelledBy: string; ariaLabel?: never }
  | { ariaLabel: string; labelledBy?: never }

export type OverlayShellProps<T extends HTMLElement = HTMLDivElement> = UseOverlayOptions<T> & {
  children: ReactNode
  className?: string
} & OverlayLabelProps

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export const OVERLAY_PANEL_CLASS = 'outline-hidden'

interface OverlayHandle {
  readonly seq: number
}

export const OVERLAY_BODY_DIM_BACKGROUND = 'var(--overlay-dim)'

let nextSeq = 0
let stack: OverlayHandle[] = []
let scrollLockCount = 0
let previousBodyOverflow = ''
let previousBodyBackground = ''

type StackListener = () => void
const stackListeners = new Set<StackListener>()

const notifyStackListeners = () => {
  for (const listener of stackListeners) listener()
}

const pushOverlay = (handle: OverlayHandle) => {
  stack = [...stack, handle].toSorted((a, b) => a.seq - b.seq)
  notifyStackListeners()
}

const popOverlay = (handle: OverlayHandle) => {
  stack = stack.filter((entry) => entry !== handle)
  notifyStackListeners()
}

const isTopOverlay = (handle: OverlayHandle) => {
  return stack.length > 0 && stack.at(-1) === handle
}

const acquireScrollLock = () => {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    previousBodyBackground = document.body.style.backgroundColor
    document.body.style.backgroundColor = OVERLAY_BODY_DIM_BACKGROUND
  }
  scrollLockCount += 1
}

const releaseScrollLock = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
    document.body.style.backgroundColor = previousBodyBackground
  }
}

export const useOverlay = <T extends HTMLElement>({
  open,
  onClose,
  initialFocus,
  ref,
}: UseOverlayOptions<T>) => {
  const panelRef = useRef<T | null>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const seqRef = useRef<number | null>(null)
  if (seqRef.current === null) seqRef.current = nextSeq++

  const setPanelRef = useCallback(
    (node: T | null) => {
      panelRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: T | null }).current = node
    },
    [ref],
  )

  useLayoutEffect(() => {
    if (!open) return

    const handle: OverlayHandle = { seq: seqRef.current! }
    pushOverlay(handle)
    acquireScrollLock()

    const triggerElement = document.activeElement as HTMLElement | null

    // iOS Safari only raises the software keyboard for a `.focus()` call made
    // synchronously within the task that still carries user activation; a
    // passive `useEffect` runs after that task has ended.
    if (isTopOverlay(handle)) {
      const panel = panelRef.current
      const target =
        initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel
      target?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(handle)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      popOverlay(handle)
      releaseScrollLock()
      triggerElement?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return setPanelRef
}

export const useHasOpenOverlay = (): boolean =>
  useSyncExternalStore(
    (onStoreChange) => {
      stackListeners.add(onStoreChange)
      return () => stackListeners.delete(onStoreChange)
    },
    () => stack.length > 0,
  )

export interface UseEscapeToCloseOptions {
  open: boolean
  onClose: () => void
}

export const useEscapeToClose = ({ open, onClose }: UseEscapeToCloseOptions) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const seqRef = useRef<number | null>(null)
  if (seqRef.current === null) seqRef.current = nextSeq++

  useEffect(() => {
    if (!open) return

    const handle: OverlayHandle = { seq: seqRef.current! }
    pushOverlay(handle)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(handle)) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      popOverlay(handle)
    }
  }, [open])
}

// On touch, a click can retarget to whatever element ends up under the
// finger if content in-flow above it shrinks between pointerdown and the
// click — so dismissal must check where the pointerdown itself landed.
export const useBackdropDismiss = <T extends HTMLElement>(open: boolean, onClose: () => void) => {
  const backdropRef = useRef<T | null>(null)
  const gestureStartedOnBackdropRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      gestureStartedOnBackdropRef.current = event.target === backdropRef.current
    }
    // pointercancel never produces a following click.
    const handlePointerCancel = () => {
      gestureStartedOnBackdropRef.current = false
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [open])

  const handleBackdropClick = () => {
    if (gestureStartedOnBackdropRef.current) onCloseRef.current()
  }

  return { backdropRef, onClick: handleBackdropClick }
}
