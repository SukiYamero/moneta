# src/features/profile

The profile/account sheet — the access point for identity, profiles, security and data, opened from the Profile slot in `BottomNav` (open state owned by `src/routes/AppShell.tsx`). Mostly a door onto other features' own state, not a feature with data of its own.

- `ProfileSheet.tsx` — the `BottomSheet` shell (`open`/`onClose` props), composing the five sections below in order.
- `IdentitySection.tsx` — the Google account (name/email from `authStore.user`) with a sign-out button, or an "Invitado" state with the sign-in row. Sign-out goes through `useSignOutConfirm.ts`, not straight to `authStore.logout()`.
- `useSignOutConfirm.ts` — decides whether sign-out needs a `ConfirmDialog`: with Drive connected or nothing unsynced it signs out directly; otherwise it confirms first, naming the count of movements that exist only on this device (`src/lib/outbox.ts`'s `listPendingOperations()`).
- `ProfilesSection.tsx` + `useProfiles.ts` — the device-scoped profile list (`src/lib/profiles`) with the active one marked, and the switcher: tapping a row rebinds the app via `profiles/switchProfile.ts`'s `switchToProfile()`. A profile whose database is gone offers removal via a `ConfirmDialog`.
- `SyncSection.tsx` + `useSyncWatermark.ts` — the Drive status row (last sync / pending / syncing / up-to-date / offline / wrong account). Renders nothing for a guest or an unconnected account. The live indicator comes from `sync/status.ts`'s `deriveSyncIndicator()`; the watermark is re-read from the profile registry whenever sync phase returns to `'idle'`.
- `SecuritySection.tsx` — entry point for the PIN lock. An authenticated account gets a row that opens `LockSettings` (`src/features/lock/`); a guest gets a toggle for the session-less biometric lock, shown only when the platform has biometric capability.
- `DataSection.tsx` — calls `exportMovimientosToCsv()` (`src/lib/export`) and routes any failure to a toast via `src/lib/errorCopy.ts`. Also carries a "delete stored data" control that is currently a disabled stub (no `onClick` wired).
- `PreferencesSection.tsx` — four rows (`tema`, `monedaPrincipal`, `primerDiaSemana`, `idioma`), each a real `Link` into `/settings` carrying the current value; the controls themselves live in `src/features/settings/`. Reads `LOCALE_LABEL` (`src/lib/i18n/localeLabels.ts`) and `WEEK_START_KEY` (`src/lib/weekStart.ts`), the same shared label tables `/settings`'s `PreferencesEditor.tsx` writes through.
- `ProfileSectionHeading.tsx` — the small heading style every section above shares.
- `index.ts` — public barrel: `ProfileSheet` only.

Reads `authStore`, `src/lib/profiles`, `src/lib/outbox` (read-only), `useDataStore`'s `config`, and `useLocaleFormatting()`/`i18next` directly. Writes nothing to `Repo`/`Config` itself — state changes here are `authStore.login`/`logout` plus whatever `LockSettings` owns.
