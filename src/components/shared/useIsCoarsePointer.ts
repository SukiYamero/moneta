import { useMediaQuery } from '@/components/shared/useMediaQuery'

const COARSE_POINTER_QUERY = '(pointer: coarse)'

export const useIsCoarsePointer = (): boolean => useMediaQuery(COARSE_POINTER_QUERY)
