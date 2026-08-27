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

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

export const triggerAllResizeObservers = () => {
  for (const instance of MockResizeObserver.instances) instance.trigger()
}
