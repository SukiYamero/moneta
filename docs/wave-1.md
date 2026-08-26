# Wave 1

**Goal.** Stand up the app's foundation: sign-in, a place to put the user's data, an optional lock, and a shared UI kit to build screens on.

**Why.** Nothing else can be built until identity, storage and a lock exist — every later wave assumes these are already there.

- Google sign-in + idempotent Drive bootstrap — creates the app's Drive folder and seed files on first login, reuses them on every login after (specs.md §10.1).
- PIN lock + biometric unlock — protects the cached Google token at rest; biometrics first, PIN fallback, 5 wrong attempts force re-login (specs.md §10.2).
- Real dexie-backed `Repo` implementation — CRUD for `Movimiento`/`Activo`/`Config` with a `schemaVersion` check.
- Shared UI kit (`BottomSheet`, `CenterModal`, `IconAvatar`, `MovimientoRow`, `TagChip`, `DateChipPicker`, `SegmentedControl`, `Toggle`, `InfoButton`) plus an in-memory fake `Repo` with seeded data, so screen work in later waves doesn't wait on real storage.
