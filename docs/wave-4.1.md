# Wave 4.1

**Goal.** Fix the four things every app open touches: the loading sequence, the theme, the PIN screens, and moving between profiles.

**Why.** Raised after using the merged Wave 4 build and doing the design work — small, visible, user-driven fixes sequenced ahead of the bigger hardening pass because they're what a user actually sees on every open.

- The cold-start surface: one loading moment instead of two, a returning user greeted by name instead of the first-run pitch. Deletes the full-screen `BootScreen` loader outright; the app's own skeleton covers the pre-content span instead (specs.md §10.29, §10.21).
- The light theme (specs.md §10.30).
- The PIN screens, polished to match the design; a guest gets biometrics or nothing, never a PIN (specs.md §10.2.1).
- Makes guest mode persist across a cold start, so the guest biometric lock actually gates reopening the app instead of only the already-running session (specs.md §10.33).
- The profile switcher (no PIN prompt on switching — the PIN gates opening the app, not moving between profiles already past it) and the guest-adoption prompt (asks a signing-in guest, once, whether to bring their local movements into the account) (specs.md §10.31, §10.32).
