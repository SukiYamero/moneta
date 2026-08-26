# Wave 4.1

**Goal.** Fix the four things every app open touches: the loading sequence, the theme, the PIN screens, and moving between profiles.

**Why.** Raised after using the merged Wave 4 build and doing the design work — small, visible, user-driven fixes sequenced ahead of the bigger hardening pass because they're what a user actually sees on every open.

- **Track AD** (§10.29 + §10.21) — the cold-start surface: one loading moment instead of two, a returning user greeted by name instead of the first-run pitch. Deletes the full-screen `BootScreen` loader outright; the app's own skeleton covers the pre-content span instead.
- **Track AE** (§10.30) — the light theme.
- **Track AF** (§10.2.1) — the PIN screens, polished to match the design; a guest gets biometrics or nothing, never a PIN.
- **Track AH** (§10.33) — makes guest mode persist across a cold start, so the guest biometric lock Track AF shipped actually gates reopening the app instead of only the already-running session.
- **Track AG** (§10.31 + §10.32) — the profile switcher (no PIN prompt on switching — the PIN gates opening the app, not moving between profiles already past it) and the guest-adoption prompt (asks a signing-in guest, once, whether to bring their local movements into the account).
