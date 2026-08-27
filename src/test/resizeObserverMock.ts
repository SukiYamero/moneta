export class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}

  disconnect() {
    MockResizeObserver.instances = MockResizeObserver.instances.filter((i) => i !== this)
  }

  trigger(height: number) {
    const entry = { contentRect: { height } } as ResizeObserverEntry
    this.callback([entry], this as unknown as ResizeObserver)
  }
}

export const triggerAllResizeObservers = (height: number) => {
  for (const instance of MockResizeObserver.instances) instance.trigger(height)
}
