import { useEffect, useState } from 'react'

/**
 * Shared with `BottomSheet`/`CenterModal`, which clamp their panel to this
 * fraction of the corrected height — one export so the two shells (and
 * their `max-h-[88dvh]` fallback classes, which must keep matching this
 * number even though Tailwind's arbitrary-value syntax can't reference a
 * JS constant) can't silently drift apart the way two separately-declared
 * `0.88`s already had (specs.md §10.49).
 */
export const OVERLAY_MAX_HEIGHT_FRACTION = 0.88

/**
 * `document.documentElement.clientHeight` is spec'd to always be an
 * integer; `visualViewport.height`/`offsetTop` are `double`s that come out
 * fractional at plenty of ordinary, keyboard-free browser/page zoom levels
 * (Chrome's own devicePixelRatio scaling among them). Comparing the two
 * with strict equality would then spuriously read "keyboard shrunk it" on
 * a zoomed page with no keyboard and no pan at all — this tolerance keeps
 * that comparison meaningful.
 */
const VIEWPORT_MATCH_TOLERANCE_PX = 1

/**
 * How far the overlay backdrop extends beyond the layout viewport's own
 * edges, in each axis — insurance against `position: fixed`'s rendered box
 * narrowing under a real device's keyboard-driven pan in a way this repo
 * cannot reproduce or measure (no iOS device here). A plain `inset-0`
 * backdrop already spans exactly the layout viewport per spec, which
 * should contain any visible pan/shrink the keyboard causes — but that
 * reasoning has already been wrong twice for this exact symptom (specs.md
 * §10.49 nested the backdrop inside the clamped wrapper and it shrank with
 * it; §10.52 un-nested it but left it exactly viewport-sized). Overscanning
 * by half a viewport in every direction makes the backdrop uncoverable by
 * any pan/shrink up to that margin without depending on which exact
 * geometry model is right — half a screen is comfortably more than any
 * real keyboard height (~35-40% of screen) or the pan it causes.
 */
export const OVERLAY_BACKDROP_OVERSCAN_BLOCK = '-50dvh'
export const OVERLAY_BACKDROP_OVERSCAN_INLINE = '-50dvw'

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
        Math.abs(viewport.offsetTop) < VIEWPORT_MATCH_TOLERANCE_PX &&
        Math.abs(viewport.height - document.documentElement.clientHeight) <
          VIEWPORT_MATCH_TOLERANCE_PX
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
