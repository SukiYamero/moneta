export class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  constructor() {
    MockResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}

  disconnect() {
    MockResizeObserver.instances = MockResizeObserver.instances.filter((i) => i !== this)
  }
}
