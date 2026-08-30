# Single-tab guard

The app is only usable in one tab at a time, on one browser storage
partition. A second tab of the same origin sees a full-screen "already open"
state with a retry action instead of running a second live instance
alongside the first — built on the Web Locks API, feature-detected so a
browser without it runs unaffected.

Rules and implementation: `specs.md` §10.55.
