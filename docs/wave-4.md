# Wave 4

**Goal.** Turn the app from a read-only shell into one that produces and keeps real data: assign a category, create/edit/delete a movement, sync it to Drive, and make settings actually take effect.

**Why.** Wave 3 built the plumbing, but two things still blocked real use: there was no way to assign a category to a movement, and `repoProvider.getRepo()` still returned the fake, in-memory repo.

- The Drive sync engine — file format, merge/replay rule, transport, flush triggers, sharding/compaction. Built and unit-tested against a contract suite with no UI caller yet (specs.md §10.19).
- The category picker. A movement can't be created without a category, so this blocks the create sheet rather than running beside it (specs.md §10.22).
- The movement sheet: create, view, edit and delete a `Movimiento` (specs.md §10.23).
- The `repoProvider` flip — swaps the fake repo for the real one now that creating a movement and assigning a category both work; ships together with the honest empty state so a user never lands on a correct but unexplained blank screen (specs.md §10.25).
- The "Personalizar" settings screen: every preference the app already stored becomes genuinely editable, and the category list becomes manageable (specs.md §10.24).
- Wires the sync engine into the running app, and fixes a data-loss race in `push()` that was unreachable until the engine had a caller (specs.md §10.26).
- One currency at a time: aggregate functions take the currency to total as a required argument instead of a default that silently mixes currencies (specs.md §10.27).
