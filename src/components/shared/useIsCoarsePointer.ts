import { useMediaQuery } from '@/components/shared/useMediaQuery'

const COARSE_POINTER_QUERY = '(pointer: coarse)'

/**
 * True on a phone or tablet — no mouse/trackpad as the primary pointer —
 * false on a desktop/laptop window however small. Gates
 * `MovimientoAmountInput`'s on-screen keypad: touch keeps it, desktop gets
 * the OS keyboard back (`AGENTS.md`).
 */
export const useIsCoarsePointer = (): boolean => useMediaQuery(COARSE_POINTER_QUERY)
