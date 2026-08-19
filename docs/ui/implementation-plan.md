# UI implementation plan

Source: Claude Design project `18d93152-c2e6-4bde-8eff-f944b1537ad8`
(`Moneta.dc.html`), read 2026-08-18. **The user actively keeps adding screens
to this design — re-pull before starting a screen you haven't built yet,
don't assume this snapshot is complete.** See "Design ↔ code sync" below for
the pull/push workflow.

Work **one screen (or one grouped unit) at a time**, in a short-lived
context. Each section below is self-contained: read only the section for the
screen you're building, not this whole file end to end.

All screens share one fake data source (`src/lib/repo.fake.ts`, **not
created yet** — the first screen-implementation session creates it: an
in-memory implementation of `src/lib/repo.ts`'s `Repo` interface, seeded with
realistic Spanish sample data matching `schema.ts`). Never invent a separate
mock JSON per screen — every screen reads the same fake repo, or numbers
between Home/History/Search will disagree with each other.

## Stub convention

A screen that shows something from a track that doesn't exist yet (Drive
sync status, real aggregation once it's genuinely unavailable, etc.) gets a
component named `Stub<Thing>` with a `// STUB(<owner>): <what the real impl
needs>` comment on its definition — greppable with `rg "// STUB\("`. Visually
complete, functionally fixed/fake. This unblocks the screen without
inventing real logic that belongs to another track.

## Not in scope for now (explicitly mocked in the design itself)

- **"Escaneo de factura" (receipt scan)** and **"Voice" (dictation)** — the
  design itself labels both `(mock)`. These are AI features with no backend
  decided (would need §6 review — an LLM API key can't be hidden client-side
  per `specs.md` §6/§7). Build their entry buttons as disabled/hidden for
  now; don't build the mock flows.
- **Auth "Account Chooser" screen** — this recreates Google's own native
  account picker. We never render a fake copy of Google's UI: with GIS
  (`initTokenClient`), Google renders the real chooser in its own popup.
  Reference only; do not implement as a custom screen.

## Foundational / shared components (build these first)

Everything below depends on these. Suggested order:

1. **`BottomSheet`** — the sliding-sheet shell (drag handle, rounded top
   corners `rounded-t-5xl`, backdrop, `animate-sheet-up`). Used by: Filter
   sheet, Movement sheet, Profile sheet, Tag picker, Add sheet. Highest
   reuse — build first.
2. **`CenterModal`** — the centered popup shell (backdrop, `animate-pop-in`).
   Used by: Delete confirm, Info tooltip, Custom tag modal, Group editor.
3. **`IconAvatar`** — colored rounded-square icon badge (tint background +
   icon color, size prop). Used almost everywhere a row has a leading icon.
4. **`MovimientoRow`** (the "movimientos slide") — icon avatar + title +
   meta (date/when, optional "Estimado" pending badge) + amount (colored by
   sign). Used by: Home (`transactions`), History (`detailMovements`),
   Search (`searchResults`). Build against `Movimiento` + a small view-model
   mapper (icon/tint/color come from category, not from the schema
   directly — define that mapping once, here, not per screen).
5. **`TagChip`** — icon + name pill, selected/unselected. Used by: Add
   sheet, Edit sheet, Filter sheet, Tag picker, Group editor.
6. **`DateChipPicker`** — button showing a date label that expands an inline
   month calendar grid. Identical pattern in: Add sheet, Edit sheet, Filter
   sheet (range variant).
7. **`SegmentedControl`** — pill-group toggle. Reused (with different
   options) for: history scope, expense/income type, tag breakdown tabs,
   number-format options.
8. **`Toggle`** (on/off switch) and **`InfoButton`** (the small "?" that
   opens an info tooltip) — small, low-risk, build whenever first needed.

## Screens

### Home (dashboard) — `src/routes/Home.tsx` (extend existing)

- Greeting header + notification bell (bell has no backend yet →
  `StubNotifications`, badge dot only).
- Search entry → routes to Search screen.
- Calendar strip + balance card: week-day strip, balance total (hide/show
  toggle), income/expense mini-totals. **Real** aggregation from
  `repo.fake` `Movimiento[]` — this is pure computation (specs.md §4,
  "views are derived"), build it as a real `src/lib/movimientoStats.ts` (or
  similar), not a stub, even before the real repo exists.
- Weekly bar chart — real, same aggregation source.
- "Áreas" (Groups) banner → routes to Groups list (own unit below).
- Recent movimientos → `MovimientoRow` list, real fake data.
- Bottom nav + FAB (opens Add sheet).

### History — full-screen overlay from bottom nav

- Year menu, scope segmented (day/week/month/year), day/week/month pickers.
- Balance + "por etiqueta" breakdown card (progress bars per tag/category).
- Movements list = `MovimientoRow` (with pending badge variant), empty state.
- All real (fake repo + the shared aggregation module from Home).

### Search

- Search input, active filter chips, results = `MovimientoRow`, empty state.
- Opens **Filter sheet** (`BottomSheet`): date-range presets + calendar,
  type filter (`SegmentedControl`), tag filter (`TagChip`, multi-select).

### Movement sheet (view / edit) — one stateful unit

- View mode: `IconAvatar` + amount + title + meta, "Editar"/"Eliminar".
- Edit mode: `DateChipPicker`, amount input, `TagChip` picker (+ opens
  Custom tag modal), optional description, save.
- "Editar dictando" button → **out of scope** (voice, mocked in design).
- Delete → `CenterModal` confirm.
- Toast (generic, global — build once, used after save/delete/add).

### Add sheet (create movimiento) — `BottomSheet`

- Type toggle (gasto/ingreso), `DateChipPicker`, amount input (native
  numeric keyboard via `inputmode="decimal"`), `TagChip` category picker
  (+ Custom tag modal), optional description.
- Scan button → **out of scope** (mocked). Voice button → **out of scope**
  (mocked). Both render as disabled for now.
- On save: writes through the fake repo, list screens must reflect it
  immediately (shared repo instance, not a per-screen copy).

### Tag picker + Custom tag modal — shared unit

- Tag picker: searchable grid of all tags/categories (`TagChip`), "create
  from query" affordance.
- Custom tag modal (`CenterModal`): name input, icon grid, color grid, save.
  Writes to `Config.categorias` via `repo.updateConfig` (atomic, per
  `specs.md` §10.3 — categories are config, not a growing dataset).

### Profile sheet — `BottomSheet`

- Account row (name/email from real `authStore`, this one's not fake —
  it's already live data from the auth track).
- Drive status row → **`StubDriveStatus`**: `// STUB(trackB): read
authStore.connectDrive status once the Drive opt-in entry point lands`.
- Preferences (notifications/dark-theme toggles, currency) → these map to
  `Config.preferencias` (real, via fake repo `getConfig`/`updateConfig`).
  Dark-theme toggle: note only `.dark` is designed today (see
  `design-tokens.md`) — the toggle can exist and write the preference, but
  actually switching themes waits for a light design.
- Logout → wire to the real `authStore` logout, not a stub.

### Settings ("Personalizar") — full-screen, from Add sheet's gear icon

- Tag list (CRUD on `Config.categorias`) + "Nueva" → Custom tag modal.
- Number-format prefs (separators, currency, show-decimals toggle) + live
  preview. All `Config.preferencias`, real via fake repo.

### Groups ("Áreas") — list + detail + editor, one unit

- Groups list: cards with spend + delta vs previous period.
- Group detail: month-vs-prev comparison, breakdown by tag
  (`SegmentedControl` income/expense tabs).
- Group editor (`CenterModal`): name, icon, color, tag multi-select
  (`TagChip`), delete.
- **Note:** "grupos/áreas" (tags grouped into a theme) isn't in `schema.ts`
  yet — this needs its own spec addition (a `Grupo` type, or `extra` on
  `Categoria`) before real implementation. Build the UI against the fake
  repo with an ad hoc shape for now; don't invent the schema change here —
  flag it back to a `specs.md` §10 write-up when this unit is picked up.

### Auth: Welcome + Drive permission — real screens, not mocks

- **Welcome**: replaces/extends the current bare `LoginScreen.tsx`. "Sign in
  with Google" triggers the real `auth.ts` flow — this is live, not fake.
- **Drive permission**: this is the missing UI for `specs.md` §12's
  "Drive-sync opt-in UI" backlog item (Track B) — `authStore.connectDrive`
  already exists and has no caller. This screen IS that caller. High-value
  find: implementing this screen from the design directly closes a
  standing backlog item, not just a cosmetic pass.
- **Account chooser**: not built — see "Not in scope" above.

## Design ↔ code sync workflow

1. Before starting a screen, `DesignSync get_file` the current
   `Moneta.dc.html` fresh — don't work off a stale read from a prior
   session.
2. Implement that screen/unit only.
3. If implementation surfaces a visual adjustment the design should also
   have (an empty state that wasn't designed, a responsive edge case), push
   it back to the Claude Design project the same session via `DesignSync
write_files` — don't defer it, that's where drift creeps in.
4. Never sync data/logic/mock wiring back to the design project — only
   visual/structural markup. The fake repo, stubs, and state wiring are
   code-only.
