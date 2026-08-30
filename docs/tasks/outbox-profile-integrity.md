# Outbox profile integrity, and the push debounce value

`dataStore.ts`'s `runMutation` captures its target database synchronously
before `write()` runs, and threads it explicitly into `enqueueOperation` —
closing a race where a profile switch or fast logout+relogin could enqueue a
write into the wrong profile's outbox. `outbox.ts`'s dirty flag now tracks
"did this write land in the currently-bound table," by reference, rather than
"was no database argument passed" — the earlier check broke once a caller
could legitimately pass the active profile's database explicitly.

`PUSH_DEBOUNCE_MS` moved from 8000ms to 6000ms.

Rules and implementation: `specs.md` §10.26, §10.31.
