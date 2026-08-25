import { useEffect, useState } from 'react'

export interface VisualViewportInset {
  /**
   * Distance in px from the layout viewport's top edge to the visual
   * viewport's visible top edge. Nonzero while iOS pans the page to bring a
   * focused input into view — the same pan that drags a `position: fixed`
   * overlay out of sight, since `fixed` is pinned to the layout viewport,
   * not the visual one.
   */
  top: number
  /**
   * The visual viewport's actual visible height in px. Shrinks below the
   * layout viewport's height while the software keyboard is up on iOS
   * Safari, which never shrinks the layout viewport itself — this is why
   * `dvh` doesn't react to the keyboard there (specs.md §10.49).
   */
  height: number
}

/**
 * Tracks `window.visualViewport` so an overlay can size and position itself
 * against the space the user can actually see, instead of the full layout
 * viewport `dvh` resolves against. `visualViewport` is the only signal that
 * is cross-browser correct for this: Android Chrome's default viewport mode
 * leaves the layout viewport alone too (specs.md §10.49), so this isn't an
 * iOS-only workaround.
 *
 * Returns `null` whenever there is nothing to correct for — the API is
 * unavailable (older WebKit, jsdom), `enabled` is false, or the visual
 * viewport currently matches the layout viewport exactly (keyboard closed,
 * no pan in progress) — so callers can fall back to their static CSS
 * (`dvh`) with no inline style at all in the common case.
 */
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
        viewport.offsetTop === 0 && viewport.height === document.documentElement.clientHeight
      setInset(matchesLayoutViewport ? null : { top: viewport.offsetTop, height: viewport.height })
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [enabled])

  return inset
}
