import { useSyncExternalStore } from 'react'

// `pointer: coarse` is the primary-input-mechanism signal, not a width
// breakpoint — it's true on a phone or tablet (no mouse/trackpad as the
// primary pointer) and false on a desktop/laptop window, however narrow or
// tall that window is made. Combined with `orientation: landscape` this
// gates touch devices only, tablets included, with no width ceiling to
// misclassify either a narrow desktop window or a large tablet.
const LANDSCAPE_QUERY = '(orientation: landscape) and (pointer: coarse)'

// jsdom (the test environment) has no matchMedia — same guard shape as
// src/features/home/usePrefersReducedMotion.ts, degrading to "not
// landscape" rather than throwing.
const supportsMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

const subscribe = (callback: () => void): (() => void) => {
  if (!supportsMatchMedia()) return () => {}
  const mediaQueryList = window.matchMedia(LANDSCAPE_QUERY)
  mediaQueryList.addEventListener('change', callback)
  return () => mediaQueryList.removeEventListener('change', callback)
}

const getSnapshot = (): boolean =>
  supportsMatchMedia() ? window.matchMedia(LANDSCAPE_QUERY).matches : false

/**
 * Whether the viewport is currently wider than it is tall on a touch
 * device — the only cross-context signal available for "keep the app in
 * portrait" (specs.md §10.53) that actually works everywhere, and the one
 * that also has to leave a mouse-driven desktop window alone regardless of
 * how it's sized (`pointer: coarse` above). The Web App Manifest's
 * `orientation: 'portrait'` (vite.config.ts) is honored once the PWA is
 * installed (Android and a Play Store TWA wrapping it, both the same
 * Chrome/WebView engine); the Screen Orientation API's `lock()` only works
 * inside that same installed/fullscreen context on Chromium and isn't
 * implemented by iOS Safari at all, installed or not. A bare mobile
 * browser tab therefore has no real lock available on either platform —
 * this hook is what `LandscapeGuard` uses to detect and guard against
 * landscape there instead of silently doing nothing.
 */
export const useIsLandscape = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false)
