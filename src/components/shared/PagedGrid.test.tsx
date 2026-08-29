import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PagedGrid, type PagedGridProps } from '@/components/shared/PagedGrid'

interface GridItem {
  id: string
  label: string
}

const makeItems = (count: number): GridItem[] =>
  Array.from({ length: count }, (_, index) => ({ id: `item-${index}`, label: `Item ${index}` }))

type HarnessProps = Partial<PagedGridProps<GridItem>> &
  Pick<PagedGridProps<GridItem>, 'items' | 'page' | 'onPageChange'>

const Harness = ({
  items,
  columns = 3,
  rows = 3,
  page,
  onPageChange,
  ariaLabel = 'Categorías',
}: HarnessProps) => (
  <PagedGrid
    items={items}
    columns={columns}
    rows={rows}
    page={page}
    onPageChange={onPageChange}
    renderItem={(item) => <button type="button">{item.label}</button>}
    itemKey={(item) => item.id}
    ariaLabel={ariaLabel}
  />
)

const getTrack = (name = 'Categorías') => screen.getByRole('group', { name })

const dispatchPointer = (
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'lostpointercapture',
  init: { pointerId: number; clientX?: number; clientY?: number },
) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    ...init,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

describe('PagedGrid', () => {
  it('renders one page of items and one dot per page', () => {
    render(<Harness items={makeItems(20)} page={0} onPageChange={vi.fn()} />)

    const track = getTrack()
    expect(within(track).getAllByRole('button')).toHaveLength(9)
    expect(screen.getAllByRole('button', { name: /^Página \d de 3$/ })).toHaveLength(3)
  })

  it('sets the grid template through inline style, not a computed class', () => {
    render(<Harness items={makeItems(9)} page={0} onPageChange={vi.fn()} columns={3} rows={3} />)
    const track = getTrack()

    expect(track.style.gridTemplateColumns).toContain('repeat(3')
    expect(track.className).not.toMatch(/grid-cols-\d/)
  })

  it('renders no dots for a single page', () => {
    render(<Harness items={makeItems(5)} page={0} onPageChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^Página \d+ de/ })).not.toBeInTheDocument()
  })

  it('does not render items from a page other than the current one', () => {
    render(<Harness items={makeItems(20)} page={0} onPageChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Item 9' })).not.toBeInTheDocument()
  })

  it('commits to the next page on a 60px leftward drag', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)

    await user.pointer([
      { keys: '[MouseLeft>]', target: getTrack(), coords: { clientX: 0 } },
      { coords: { clientX: -60 } },
      '[/MouseLeft]',
    ])

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('springs back without paging on a 20px drag', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)

    await user.pointer([
      { keys: '[MouseLeft>]', target: getTrack(), coords: { clientX: 0 } },
      { coords: { clientX: -20 } },
      '[/MouseLeft]',
    ])

    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('commits to the previous page on a 60px rightward drag', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={1} onPageChange={onPageChange} />)

    await user.pointer([
      { keys: '[MouseLeft>]', target: getTrack(), coords: { clientX: 0 } },
      { coords: { clientX: 60 } },
      '[/MouseLeft]',
    ])

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(0)
  })

  it('abandons the gesture on a mostly-vertical drag, without preventing default or paging', () => {
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)
    const track = getTrack()

    dispatchPointer(track, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 })
    const moveEvent = dispatchPointer(track, 'pointermove', {
      pointerId: 1,
      clientX: 5,
      clientY: 60,
    })
    dispatchPointer(track, 'pointerup', { pointerId: 1, clientX: 5, clientY: 60 })

    expect(moveEvent.defaultPrevented).toBe(false)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('is inert at the last page against a further leftward drag', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={2} onPageChange={onPageChange} />)

    await user.pointer([
      { keys: '[MouseLeft>]', target: getTrack(), coords: { clientX: 0 } },
      { coords: { clientX: -80 } },
      '[/MouseLeft]',
    ])

    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('is inert at the first page against a further rightward drag', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)

    await user.pointer([
      { keys: '[MouseLeft>]', target: getTrack(), coords: { clientX: 0 } },
      { coords: { clientX: 80 } },
      '[/MouseLeft]',
    ])

    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('ignores a second concurrent pointer instead of interleaving two drags', () => {
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)
    const track = getTrack()

    dispatchPointer(track, 'pointerdown', { pointerId: 1, clientX: 0 })
    dispatchPointer(track, 'pointerdown', { pointerId: 2, clientX: 0 })
    dispatchPointer(track, 'pointermove', { pointerId: 2, clientX: -60 })
    dispatchPointer(track, 'pointerup', { pointerId: 2, clientX: -60 })
    dispatchPointer(track, 'pointermove', { pointerId: 1, clientX: -60 })
    dispatchPointer(track, 'pointerup', { pointerId: 1, clientX: -60 })

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('taps the third dot to jump straight to page 2', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Página 3 de 3' }))

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('gives every dot an accessible name identifying its page', () => {
    render(<Harness items={makeItems(20)} page={0} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Página 1 de 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 2 de 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 3 de 3' })).toBeInTheDocument()
  })

  it('marks the active dot with aria-current', () => {
    render(<Harness items={makeItems(20)} page={1} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Página 2 de 3' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Página 1 de 3' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('clamps to the last page and reports it when items shrink out from under the current page', () => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <Harness items={makeItems(20)} page={2} onPageChange={onPageChange} />,
    )

    rerender(<Harness items={makeItems(4)} page={2} onPageChange={onPageChange} />)

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(0)
  })

  it('renders the clamped page items in the same render as the shrink, never a stale empty frame', () => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <Harness items={makeItems(20)} page={2} onPageChange={onPageChange} />,
    )

    rerender(<Harness items={makeItems(4)} page={2} onPageChange={onPageChange} />)

    const track = getTrack()
    expect(within(track).getByRole('button', { name: 'Item 0' })).toBeInTheDocument()
  })

  it('pages forward with ArrowRight on the focused track', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)

    getTrack().focus()
    await user.keyboard('{ArrowRight}')

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('suppresses the ghost click a mouse drag leaves on the tile under the pointer', () => {
    const onPageChange = vi.fn()
    const onItemClick = vi.fn()
    render(
      <PagedGrid
        items={makeItems(20)}
        columns={3}
        rows={3}
        page={0}
        onPageChange={onPageChange}
        renderItem={(item) => (
          <button type="button" onClick={onItemClick}>
            {item.label}
          </button>
        )}
        itemKey={(item) => item.id}
        ariaLabel="Categorías"
      />,
    )
    const track = getTrack()

    dispatchPointer(track, 'pointerdown', { pointerId: 1, clientX: 0 })
    dispatchPointer(track, 'pointermove', { pointerId: 1, clientX: -60 })
    dispatchPointer(track, 'pointerup', { pointerId: 1, clientX: -60 })

    const tile = within(track).getAllByRole('button')[0]
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    act(() => {
      tile?.dispatchEvent(clickEvent)
    })

    expect(clickEvent.defaultPrevented).toBe(true)
    expect(onItemClick).not.toHaveBeenCalled()
  })

  it('does not suppress a plain tap that never crossed the axis-lock distance', async () => {
    const user = userEvent.setup()
    const onItemClick = vi.fn()
    render(
      <PagedGrid
        items={makeItems(20)}
        columns={3}
        rows={3}
        page={0}
        onPageChange={vi.fn()}
        renderItem={(item) => (
          <button type="button" onClick={onItemClick}>
            {item.label}
          </button>
        )}
        itemKey={(item) => item.id}
        ariaLabel="Categorías"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Item 0' }))

    expect(onItemClick).toHaveBeenCalledOnce()
  })

  it('does not page past the last page with ArrowRight', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={2} onPageChange={onPageChange} />)

    getTrack().focus()
    await user.keyboard('{ArrowRight}')

    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('reserves the tallest page height and never shrinks the track on a shorter page', () => {
    // jsdom lays out nothing, hence the stub: height tracks how many tiles are actually mounted.
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const rows = this.getAttribute('role') === 'group' ? Math.ceil(this.children.length / 3) : 0
      return { height: rows * 40 } as DOMRect
    })

    const items = makeItems(20)
    const { rerender } = render(<Harness items={items} page={0} onPageChange={vi.fn()} />)
    expect(getTrack().style.minHeight).toBe('120px')

    rerender(<Harness items={items} page={2} onPageChange={vi.fn()} />)
    expect(getTrack().style.minHeight).toBe('120px')

    spy.mockRestore()
  })

  it('re-baselines the reserved height when a new items list replaces the old one', () => {
    // jsdom lays out nothing, hence the stub: height tracks how many tiles are actually mounted.
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const rows = this.getAttribute('role') === 'group' ? Math.ceil(this.children.length / 3) : 0
      return { height: rows * 40 } as DOMRect
    })

    const { rerender } = render(<Harness items={makeItems(20)} page={0} onPageChange={vi.fn()} />)
    expect(getTrack().style.minHeight).toBe('120px')

    // A different list (e.g. drilling into a category with few children) must not
    // keep inheriting a taller list's reserved height.
    rerender(<Harness items={makeItems(2)} page={0} onPageChange={vi.fn()} />)
    expect(getTrack().style.minHeight).toBe('40px')

    spy.mockRestore()
  })

  it('a stale lostpointercapture from an already-finished gesture does not freeze the next swipe', () => {
    const onPageChange = vi.fn()
    render(<Harness items={makeItems(20)} page={0} onPageChange={onPageChange} />)
    const track = getTrack()

    dispatchPointer(track, 'pointerdown', { pointerId: 1, clientX: 0 })
    dispatchPointer(track, 'pointerup', { pointerId: 1, clientX: 0 })

    dispatchPointer(track, 'pointerdown', { pointerId: 2, clientX: 0 })
    dispatchPointer(track, 'pointermove', { pointerId: 2, clientX: -60 })
    dispatchPointer(track, 'lostpointercapture', { pointerId: 1 })
    dispatchPointer(track, 'pointerup', { pointerId: 2, clientX: -60 })

    expect(onPageChange).toHaveBeenCalledOnce()
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
