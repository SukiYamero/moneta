import { useEffect, useState } from 'react'

export const OVERLAY_MAX_HEIGHT_FRACTION = 0.88

// `visualViewport.height`/`offsetTop` are doubles and fractional at ordinary
// zoom levels, unlike the integer `documentElement.clientHeight`.
const VIEWPORT_MATCH_TOLERANCE_PX = 1

// A resize/scroll event can fire before the keyboard's own dismiss animation
// has actually finished settling; re-reading shortly after catches the value
// it eventually reports even when no further event arrives to trigger it.
const SETTLE_RECHECK_DELAY_MS = 200

export const OVERLAY_BACKDROP_OVERSCAN_BLOCK = '-50dvh'
export const OVERLAY_BACKDROP_OVERSCAN_INLINE = '-50dvw'

export const OVERLAY_FIXED_LAYER_OPACITY_CLASS = 'opacity-99'

export interface VisualViewportInset {
  // Nonzero while iOS pans the page to reveal a focused input; `position: fixed`
  // is pinned to the layout viewport, so the pan drags it out of sight.
  top: number
  // Shrinks while the iOS Safari keyboard is up; the layout viewport `dvh`
  // resolves against does not.
  height: number
}

// Android Chrome's default viewport mode leaves the layout viewport alone too,
// so this is not an iOS-only concern.
export const useVisualViewportInset = (enabled: boolean): VisualViewportInset | null => {
  const [inset, setInset] = useState<VisualViewportInset | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport) {
      setInset(null)
      return
    }

    const update = () => {
      const matchesLayoutViewport =
        Math.abs(viewport.offsetTop) < VIEWPORT_MATCH_TOLERANCE_PX &&
        Math.abs(viewport.height - document.documentElement.clientHeight) <
          VIEWPORT_MATCH_TOLERANCE_PX
      setInset(matchesLayoutViewport ? null : { top: viewport.offsetTop, height: viewport.height })
    }

    let recheckTimeoutId: ReturnType<typeof setTimeout>
    const handleViewportChange = () => {
      update()
      clearTimeout(recheckTimeoutId)
      recheckTimeoutId = setTimeout(update, SETTLE_RECHECK_DELAY_MS)
    }

    update()
    viewport.addEventListener('resize', handleViewportChange)
    viewport.addEventListener('scroll', handleViewportChange)
    return () => {
      clearTimeout(recheckTimeoutId)
      viewport.removeEventListener('resize', handleViewportChange)
      viewport.removeEventListener('scroll', handleViewportChange)
    }
  }, [enabled])

  return inset
}
