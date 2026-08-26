# Wave 4

**Goal.** Turn the app from a read-only shell into one that produces and keeps real data: assign a category, create/edit/delete a movement, sync it to Drive, and make settings actually take effect.

**Why.** Wave 3 built the plumbing, but two things still blocked real use: there was no way to assign a category to a movement, and `repoProvider.getRepo()` still returned the fake, in-memory repo.

- **Track Z** (§10.19) — the Drive sync engine: file format, merge/replay rule, transport, flush triggers, sharding/compaction. Built and unit-tested against a contract suite with no UI caller yet.
- **Track G1** (§10.22) — the category picker. A movement can't be created without a category, so this blocks the create sheet rather than running beside it.
- **Track F** (§10.23) — the movement sheet: create, view, edit and delete a `Movimiento`.
- **The `repoProvider` flip** (§10.25) — swaps the fake repo for the real one now that creating a movement and assigning a category both work; ships together with the honest empty state so a user never lands on a correct but unexplained blank screen.
- **Track G2** (§10.24) — the "Personalizar" settings screen: every preference the app already stored becomes genuinely editable, and the category list becomes manageable.
- **Track AB** (§10.26) — wires the sync engine into the running app, and fixes a data-loss race in `push()` that was unreachable until the engine had a caller.
- **Track AC** (§10.27 + review debt) — one currency at a time: aggregate functions take the currency to total as a required argument instead of a default that silently mixes currencies.
