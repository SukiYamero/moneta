# Drag/swipe render perf — BottomSheet and Toast

`BottomSheet`'s drag-to-dismiss and `Toast`'s swipe-to-dismiss track the live
offset in a ref and mutate the panel/card's `transform`/`opacity`/
`transitionDuration` directly on the DOM node during the gesture, instead of
a `setState` call per `pointermove`. `pointercancel`/`lostpointercapture`
still reset unconditionally, and a multi-touch pointer is ignored via a
`pointerId` guard.

Rules and implementation: `specs.md` §10.5.1.
