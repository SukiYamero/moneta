import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface PagedGridProps<T> {
  items: readonly T[]
  columns: number
  rows: number
  page: number
  onPageChange: (page: number) => void
  renderItem: (item: T, index: number) => ReactNode
  itemKey: (item: T, index: number) => string
  ariaLabel: string
  className?: string
}

const SWIPE_COMMIT_THRESHOLD_PX = 40
const AXIS_LOCK_DISTANCE_PX = 4

type DragAxis = 'horizontal' | 'vertical' | null

export const PagedGrid = <T,>({
  items,
  columns,
  rows,
  page,
  onPageChange,
  renderItem,
  itemKey,
  ariaLabel,
  className,
}: PagedGridProps<T>) => {
  const { t } = useTranslation('common')
  const pageSize = columns * rows
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, Math.max(pageCount - 1, 0))
  const hasPrevPage = safePage > 0
  const hasNextPage = safePage < pageCount - 1

  const dragOffsetRef = useRef(0)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragAxis = useRef<DragAxis>(null)
  const pointerId = useRef<number | null>(null)
  const suppressNextClick = useRef(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const [minHeight, setMinHeight] = useState<number>()

  useEffect(() => {
    if (page === safePage) return
    onPageChange(safePage)
  }, [page, safePage, onPageChange])

  const pageItems = useMemo(() => {
    const start = safePage * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const prevItemsRef = useRef(items)

  useLayoutEffect(() => {
    const measured = trackRef.current?.getBoundingClientRect().height
    const itemsChanged = prevItemsRef.current !== items
    prevItemsRef.current = items
    if (!measured) return
    if (itemsChanged || minHeight === undefined || measured > minHeight) setMinHeight(measured)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems])

  const clampOffset = (raw: number) => {
    if (raw < 0 && !hasNextPage) return 0
    if (raw > 0 && !hasPrevPage) return 0
    return raw
  }

  const releaseCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current === null) return
    if (event.currentTarget.hasPointerCapture?.(pointerId.current)) {
      event.currentTarget.releasePointerCapture(pointerId.current)
    }
    pointerId.current = null
  }

  const applyDragStyle = (offset: number) => {
    const track = trackRef.current
    if (!track) return
    track.style.transform = offset ? `translateX(${offset}px)` : ''
  }

  const resetTrackStyle = () => {
    const track = trackRef.current
    if (!track) return
    track.style.transitionDuration = ''
    track.style.transform = ''
  }

  const resetDrag = () => {
    dragAxis.current = null
    dragOffsetRef.current = 0
    resetTrackStyle()
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return
    pointerId.current = event.pointerId
    dragStart.current = { x: event.clientX, y: event.clientY }
    dragAxis.current = null
    suppressNextClick.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return
    const dx = event.clientX - dragStart.current.x
    const dy = event.clientY - dragStart.current.y

    if (dragAxis.current === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_DISTANCE_PX) return
      dragAxis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      if (dragAxis.current === 'horizontal') {
        suppressNextClick.current = true
        if (trackRef.current) trackRef.current.style.transitionDuration = '0ms'
      }
    }

    if (dragAxis.current !== 'horizontal') return
    event.preventDefault()
    const offset = clampOffset(dx)
    dragOffsetRef.current = offset
    applyDragStyle(offset)
  }

  const commitOrSpring = (dx: number) => {
    if (dragAxis.current !== 'horizontal') return
    if (Math.abs(dx) < SWIPE_COMMIT_THRESHOLD_PX) return
    if (dx < 0 && hasNextPage) onPageChange(safePage + 1)
    else if (dx > 0 && hasPrevPage) onPageChange(safePage - 1)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return
    releaseCapture(event)
    commitOrSpring(dragOffsetRef.current)
    resetDrag()
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return
    releaseCapture(event)
    resetDrag()
  }

  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return
    pointerId.current = null
    resetDrag()
  }

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressNextClick.current) return
    suppressNextClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' && hasNextPage) {
      event.preventDefault()
      onPageChange(safePage + 1)
    } else if (event.key === 'ArrowLeft' && hasPrevPage) {
      event.preventDefault()
      onPageChange(safePage - 1)
    }
  }

  const trackStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    minHeight: minHeight ? `${minHeight}px` : undefined,
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative overflow-x-clip overflow-y-visible">
        <div
          ref={trackRef}
          role="group"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handleLostPointerCapture}
          onClickCapture={handleClickCapture}
          onKeyDown={handleKeyDown}
          style={trackStyle}
          className="grid touch-pan-y select-none gap-2 rounded-lg outline-none transition-transform duration-300 ease-[var(--ease-ios)] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {pageItems.map((item, index) => (
            <div key={itemKey(item, index)}>{renderItem(item, index)}</div>
          ))}
        </div>
        {hasNextPage && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-[linear-gradient(to_left,var(--color-card)_20%,transparent)]"
          />
        )}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }, (_, dotPage) => (
            <button
              key={dotPage}
              type="button"
              aria-label={t('pagination.pageAria', { page: dotPage + 1, count: pageCount })}
              aria-current={dotPage === safePage ? 'true' : undefined}
              onClick={() => onPageChange(dotPage)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  'rounded-full bg-fg-faint transition-[width]',
                  dotPage === safePage ? 'h-1.5 w-4.5 bg-foreground' : 'size-1.5',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
