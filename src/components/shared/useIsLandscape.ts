import { useMediaQuery } from '@/components/shared/useMediaQuery'

// `pointer: coarse` matches the primary input mechanism, not viewport width,
// so a narrow desktop window never satisfies it.
const LANDSCAPE_QUERY = '(orientation: landscape) and (pointer: coarse)'

// A bare mobile browser tab has no orientation lock: the manifest's applies
// only to an installed PWA, and iOS Safari has no Screen Orientation lock().
export const useIsLandscape = (): boolean => useMediaQuery(LANDSCAPE_QUERY)
