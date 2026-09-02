# Drag/swipe render perf — PagedGrid

`PagedGrid`'s swipe-to-page tracks the live offset in a ref and mutates the
track's `transform`/`transitionDuration` directly on the DOM node during the
gesture, instead of a `setState` call per `pointermove` — the same fix shape
as `BottomSheet`/`Toast`.

Rules and implementation: `specs.md` §10.5.2, including the still-open
diagonal swipe/scroll conflict noted there and tracked in §11.
