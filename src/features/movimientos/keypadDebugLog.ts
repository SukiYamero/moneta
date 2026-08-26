const DEBUG_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debugKeypad') === '1'

const describeNode = (node: EventTarget | null, wrapper: HTMLElement | null): string => {
  if (!(node instanceof Element)) return String(node)
  const classes = node.className
    ? `.${String(node.className).trim().split(/\s+/).slice(0, 2).join('.')}`
    : ''
  const inside = wrapper?.contains(node) ? 'INSIDE' : 'outside'
  return `${node.tagName}${classes}<${inside}>`
}

export const logKeypadState = (label: string, wrapper: HTMLElement | null): void => {
  if (!DEBUG_ENABLED) return
  console.debug('[KP]', label, `active=${describeNode(document.activeElement, wrapper)}`)
}

export const armKeypadDebugLog = (wrapperRef: { current: HTMLElement | null }): (() => void) => {
  if (!DEBUG_ENABLED) return () => {}

  const log = (type: string, target: EventTarget | null, related?: EventTarget | null) => {
    const relatedPart =
      related !== undefined ? ` related=${describeNode(related, wrapperRef.current)}` : ''
    console.debug('[KP]', type, `${describeNode(target, wrapperRef.current)}${relatedPart}`)
  }

  const listeners: [string, (event: Event) => void][] = [
    ['pointerdown', (e) => log('pointerdown', e.target)],
    ['pointerup', (e) => log('pointerup', e.target)],
    ['pointercancel', (e) => log('pointercancel', e.target)],
    ['touchstart', (e) => log('touchstart', e.target)],
    ['touchend', (e) => log('touchend', e.target)],
    ['focusin', (e) => log('focusin', e.target, (e as FocusEvent).relatedTarget)],
    ['focusout', (e) => log('focusout', e.target, (e as FocusEvent).relatedTarget)],
  ]

  for (const [type, handler] of listeners) document.addEventListener(type, handler)
  return () => {
    for (const [type, handler] of listeners) document.removeEventListener(type, handler)
  }
}
