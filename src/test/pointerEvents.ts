import { act } from '@testing-library/react'

type TimestampedPointerEventType = 'pointerdown' | 'pointermove' | 'pointerup'

/** Dispatches a `PointerEvent` with an explicit `timeStamp`, for gesture tests that assert
 * against release velocity — jsdom's own event timestamps are too fast/jitter-prone to
 * reliably land on one side of a velocity threshold. */
export const dispatchTimestampedPointer = (
  target: Element,
  type: TimestampedPointerEventType,
  coords: { clientX: number } | { clientY: number },
  timeStamp: number,
  pointerId = 1,
) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    ...coords,
  })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}
