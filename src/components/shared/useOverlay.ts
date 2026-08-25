import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'

export interface UseOverlayOptions<T extends HTMLElement> {
  open: boolean
  onClose: () => void
  /** Focus this element on open instead of the panel's first focusable descendant (e.g. the amount input in the Add sheet). */
  initialFocus?: RefObject<HTMLElement | null>
  /** Forwarded consumer ref (React 19: ordinary prop), merged with the internal panel ref. */
  ref?: Ref<T>
}

/** Exactly one of `labelledBy` (references a visible heading) or `ariaLabel` (standalone string) must label the overlay. */
export type OverlayLabelProps =
  | { labelledBy: string; ariaLabel?: never }
  | { ariaLabel: string; labelledBy?: never }

/** Shared prop surface for the overlay shells (`BottomSheet`, `CenterModal`) built on top of `useOverlay`. */
export type OverlayShellProps<T extends HTMLElement = HTMLDivElement> = UseOverlayOptions<T> & {
  children: ReactNode
  className?: string
} & OverlayLabelProps

/** What counts as focusable for a panel's default initial focus and its Tab-trap — also the selector a form section uses to find its own first focusable control (`MovimientoFormFields`'s blocked-submit focus). */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * The overlay container itself is only ever focused programmatically
 * (`tabIndex={-1}`, never reached by Tab), but the global
 * `outline-ring/50` base style (src/styles/index.css) still paints its
 * `:focus-visible` ring on it once `useOverlay` calls `.focus()` — a
 * bright ring around the whole panel reads as a web modal, not a native
 * sheet (AGENTS.md § UI). Both BottomSheet and CenterModal apply this to
 * their panel so the fix lives in one place; focusable children keep
 * their own ring untouched.
 */
export const OVERLAY_PANEL_CLASS = 'outline-hidden'

/**
 * Module-level registry of every currently-open BottomSheet/CenterModal/
 * DateChipPicker-popover instance, ordered by nesting depth rather than
 * open/close timing. React renders parents before children, so an overlay
 * mounted deeper in the tree (e.g. the delete-confirm CenterModal nested
 * inside the Movement BottomSheet) always gets a higher `seq` than its
 * ancestor, regardless of which one's `open` flips true first or whether
 * both mount already open in the same commit. That makes "topmost" a
 * stable, race-free concept: only the entry with the highest `seq` among
 * the currently-open ones handles Escape/Tab-trap/initial-focus, so a
 * nested overlay always wins over the one it opened from.
 */
interface OverlayHandle {
  readonly seq: number
}

let nextSeq = 0
let stack: OverlayHandle[] = []
let scrollLockCount = 0
let previousBodyOverflow = ''

const pushOverlay = (handle: OverlayHandle) => {
  stack = [...stack, handle].toSorted((a, b) => a.seq - b.seq)
}

const popOverlay = (handle: OverlayHandle) => {
  stack = stack.filter((entry) => entry !== handle)
}

const isTopOverlay = (handle: OverlayHandle) => {
  return stack.length > 0 && stack.at(-1) === handle
}

const acquireScrollLock = () => {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount += 1
}

const releaseScrollLock = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
  }
}

/**
 * Shared a11y/behavior plumbing for BottomSheet and CenterModal: Escape to
 * close, Tab-trapped focus inside the panel, body scroll lock while open,
 * and focus restored to whatever triggered the overlay once it closes.
 *
 * Nesting-aware via the module-level stack above: only the topmost overlay
 * reacts to Escape/Tab, only the topmost claims initial focus, and the
 * scroll lock is refcounted against the stack so a nested modal closing
 * doesn't unlock the page while the sheet behind it is still open.
 */
export const useOverlay = <T extends HTMLElement>({
  open,
  onClose,
  initialFocus,
  ref,
}: UseOverlayOptions<T>) => {
  const panelRef = useRef<T | null>(null)

  // Keeping the latest onClose in a ref (instead of an effect dependency)
  // means an inline `onClose={() => setOpen(false)}` — the natural way
  // every consumer writes it — never forces the effect below to re-run on
  // an unrelated parent re-render, which used to steal focus back.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Assigned once per instance, at first render. React renders ancestors
  // before descendants, so a nested overlay's seq is always greater than
  // the overlay it's nested inside — see the stack comment above.
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

    // Focus synchronously, in the same commit (and so the same browser task)
    // as the click/tap that opened this overlay: iOS Safari only raises the
    // software keyboard for a `.focus()` call made inside the task that
    // still carries user activation. A passive `useEffect` — let alone one
    // that then deferred another frame via `requestAnimationFrame` — runs
    // after that task has already ended, so focus landed but no keyboard
    // followed. `useLayoutEffect` runs synchronously during the commit that
    // mounts this panel, and refs are attached during the mutation phase
    // that precedes layout effects, so `panelRef.current` is already the
    // mounted node here — no frame to wait out.
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
    // `onClose` and `initialFocus` are intentionally excluded: keeping this
    // effect scoped to [open] is the bug-1 fix — an inline
    // onClose={() => setOpen(false)} must never re-run the effect (and
    // re-steal focus) on an unrelated parent re-render. `onCloseRef` covers
    // onClose; `initialFocus` is a ref, whose object identity is stable by
    // React convention, so it needs no entry here either.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return setPanelRef
}

export interface UseEscapeToCloseOptions {
  open: boolean
  onClose: () => void
}

/**
 * Lightweight sibling of `useOverlay` for surfaces that aren't a full
 * portal/scroll-lock/focus-trap shell (e.g. `DateChipPicker`'s inline
 * month-grid popover): Escape-to-close only, participating in the same
 * nesting-aware stack so it correctly outranks an ancestor BottomSheet/
 * CenterModal — pressing Escape closes the popover first, not the sheet
 * behind it.
 */
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
