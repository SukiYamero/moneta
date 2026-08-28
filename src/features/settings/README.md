# src/features/settings

The "Personalizar" screen — routed at `/settings` (not an overlay), reached
from `src/features/profile/PreferencesSection.tsx`. Wrapped in `RequireAuth`,
code-split via `src/routes/SettingsLazy.tsx`. Not nested under `AppShell`, so
it has no `BottomNav`; its own unmount closes the Profile sheet that opened it.

- `SettingsScreen.tsx` — the route's content: `ScreenHeader` (back + title),
  then the two sections below. Owns its own `dataStore.load()`/loading/error
  handling (skeleton, `InlineErrorState` + retry) rather than assuming
  `Config` is already resolved. Each section is wrapped in its own
  `<section aria-labelledby>` with a visually hidden `<h2>` (via
  `ProfileSectionHeading`).
- `CategoriesSection.tsx` — `Config.categorias`, top-level categories with
  their children indented underneath (an orphan whose parent is missing or
  archived renders top-level). Reuses `CategoryFormModal` for create/edit. An
  active row offers **Archive**; an archived row offers **Delete** only when
  no `movimiento` references it, otherwise a note explaining why
  (`tags:errors.categoryInUse`) instead of a button that would always fail.
  The archived group starts collapsed.
- `PreferencesEditor.tsx` — `tema` (`OptionList`), `primerDiaSemana`
  (`SegmentedControl`, domingo/lunes), `idioma` and `monedaPrincipal`
  (`OptionList`). Purely controlled: takes `preferencias` + `onChange(patch)`,
  no store import — `SettingsScreen` owns the `dataStore.updateConfig` write.
  "Seguir el dispositivo" writes `idioma: undefined`. The `0|1` ↔
  `'sunday'|'monday'` mapping comes from `src/lib/weekStart.ts`
  (`WEEK_START_KEY`/`WEEK_START_VALUE`), shared with
  `src/features/profile/PreferencesSection.tsx`.
- `OptionList.tsx` — a vertical single-select list (`role="radiogroup"`/
  `"radio"`, trailing `Check`) for pickers with too many options for
  `SegmentedControl`'s pill shape. Keyboard navigation (roving `tabIndex`,
  arrow keys) comes from `src/components/shared/useRovingRadioGroup.ts`,
  shared with `SegmentedControl`.

Writes go through `dataStore` exclusively — `updateConfig` for preferences,
`upsertCategoria`/`archiveCategoria`/`deleteCategoria` for the category list.
No number-format overrides here: `Intl` derives separators/decimals from the locale.
