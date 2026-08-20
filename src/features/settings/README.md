# src/features/settings

The "Personalizar" screen (`specs.md` §10.24) — a route, `/settings`, not an
overlay, reached from `src/features/profile/PreferencesSection.tsx`'s three
writable rows. Wrapped in `RequireAuth` and code-split at the router level
(`src/routes/SettingsLazy.tsx`); not nested under `AppShell`, so it carries
no `BottomNav` and its own unmount is what closes the Profile sheet that
opened it (no explicit close callback needed).

- `SettingsScreen.tsx` — the route's content: back button + title, then the
  two sections below. Owns `dataStore.load()`/loading/error handling itself
  (Tier 2 skeleton, `InlineErrorState` + retry) rather than assuming
  `Config` is already resolved — usually true (Home is the index route) but
  not guaranteed for a direct/deep link.
- `CategoriesSection.tsx` — `Config.categorias` grouped by `Seccion`.
  Reuses `CategoryFormModal` (`specs.md` §10.22) for create/edit — never a
  second editor. Archive/restore/delete deliberately routed so the
  destructive action is never the only option and never a dead one: an
  active row only ever offers **Archive** (always safe, one tap — this _is_
  "the archive path offered instead of a bare no", not a fallback surfaced
  after a refused delete); an archived row offers **Delete** only when this
  screen can already see (via `movimientos`) that nothing references it —
  otherwise it shows a plain note reusing G1's own `tags:errors.categoryInUse`
  copy rather than a button that would always fail (the same "an inert
  control beats a dead one" rule `PreferencesSection`'s theme row already
  follows). The archived group starts collapsed; a user who archived
  something can still find it to restore it.
- `PreferencesEditor.tsx` — `primerDiaSemana` (`SegmentedControl`,
  domingo/lunes — the one preference that genuinely fits a pill toggle),
  `idioma` and `monedaPrincipal` (`OptionList`). Purely controlled: takes
  `preferencias` + `onChange(patch)`, no store import — `SettingsScreen`
  owns the actual `dataStore.updateConfig` write. "Seguir el dispositivo"
  writes `idioma: undefined` back (`OptionList`'s `LocaleChoice` type models
  it as its own member, not an overload of `undefined`).
- `OptionList.tsx` — a vertical single-select list (`role="radiogroup"`/
  `"radio"`, a trailing `Check`) for the two pickers `SegmentedControl`'s
  horizontal-pill shape doesn't fit (5–6 options). Same visual language
  `YearMenu.tsx`'s popover already uses for its own option rows, as static
  inline content instead of behind a trigger.

No theme control here (Prerequisite 3, `specs.md` §10.24) — `index.html`
hardcodes dark and the light palette is unreviewed; the design deliverable
that unblocks it is tracked in `docs/pendientes-usuario.md`. No number-format
overrides either (separators/decimals) — `Intl` already derives those from
the locale (`specs.md` §10.7); a manual override would be a second source of
truth for formatting.

Writes go through `dataStore` exclusively (`updateConfig` for preferences,
`upsertCategoria`/`archiveCategoria`/`deleteCategoria` for the list) —
`specs.md` §10.13 is the one write path, no new convention here.
