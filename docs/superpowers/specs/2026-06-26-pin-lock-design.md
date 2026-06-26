# PIN lock + biometric unlock — design

> Feature spec for `pinLock.ts` (§8.5 of `specs.md`). Source of truth for the
> behaviour; `specs.md` §10.2 carries the short summary and §11 the decisions.

Date: 2026-06-26 · Status: approved (brainstorming) · Schema impact: none

## Goal

Let the user optionally protect the app on a device. Unlock prioritises
**biometrics** (FaceID / TouchID / fingerprint, surfaced through WebAuthn) and
falls back to a **mandatory 4-digit PIN**. The cached OAuth token is stored
encrypted at rest; either method decrypts it.

## User story

As a user, I enable the lock and set a 4-digit PIN; if my device supports it I
also turn on biometric unlock. When I open the app (cold start) or come back
after 7 minutes in the background, it asks for my biometric; if that fails or is
unavailable, I enter my PIN. The app never stores my token in plaintext.

## Threat model (do not over-build)

The lock protects against **casual access** — someone holding the unlocked
phone — not against a forensic attacker with the device image. The real data
lives in Drive behind Google auth (`specs.md` §5). A 4-digit PIN is only 10⁴
combinations: brute-force resistance comes from the **attempt throttle**
(5 tries → forced Google re-login) plus PBKDF2 work factor, not from PIN entropy.

## Scope

**In:** `pinLock.ts` (crypto + vault persistence, TDD), `lockStore.ts` (zustand:
lock state + triggers, orchestration), and a **minimal** lock/setup UI so the
feature is usable.
**Out (separate spec):** the polished lock-screen / setup visual design — the
user will propose it separately. Keep the UI here bare (PIN keypad + biometric
button + "enable lock" toggle), no theming work.

## Architecture — modules

| Unit                                       | Responsibility                                                                                                | Depends on                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `src/lib/pinLock.ts`                       | Crypto + vault read/write. Pure functions over WebCrypto + IndexedDB. No React. **TDD.**                      | WebCrypto, dexie, WebAuthn   |
| `src/lib/lockStore.ts`                     | zustand store: `locked/unlocked`, Page Visibility + cold-start triggers, orchestrates `pinLock` ↔ `authStore` | `pinLock.ts`, `authStore.ts` |
| `src/features/lock/LockScreen.tsx` + setup | Minimal gate UI: biometric button, PIN keypad, enable-lock toggle                                             | `lockStore.ts`               |

## Data model — the vault (one record in IndexedDB)

Nothing in plaintext: not the PIN, not the token, not the DEK — only ciphertext,
salts, IVs, the WebAuthn credential id, and throttle counters.

```ts
type LockVault = {
  schemaVersion: number
  // token envelope — encrypted once under the DEK
  tokenCipher: ArrayBuffer
  tokenIv: ArrayBuffer
  // PIN wrap (always present)
  pinSalt: ArrayBuffer
  pinIterations: number
  dekWrappedByPin: ArrayBuffer
  pinWrapIv: ArrayBuffer
  // biometric wrap (present only when enabled AND PRF available)
  biometric?: {
    credentialId: ArrayBuffer
    prfSalt: ArrayBuffer
    dekWrappedByPrf: ArrayBuffer
    prfWrapIv: ArrayBuffer
  }
  // throttle
  failedAttempts: number
  // 7-min background timeout
  lastActiveAt: number
}
```

Stored via dexie in a dedicated table (single-row, fixed key). Token at-rest
encryption is the only reason the vault exists; the local financial-data cache
(future `repo.ts`) is out of scope here.

## Crypto (WebCrypto primitives, no extra deps)

- **DEK** (data encryption key): 32 random bytes (`crypto.getRandomValues`),
  imported as `AES-GCM` 256.
- **Token cipher:** `AES-GCM(JSON(AuthSession))` under the DEK, fresh IV.
- **PIN wrap:** `PBKDF2(PIN, pinSalt, ~310_000 iter, SHA-256)` → an `AES-GCM`
  wrapping key that encrypts the raw DEK bytes → `dekWrappedByPin`.
- **Biometric wrap:** WebAuthn ceremony with the **PRF extension** → a stable
  32-byte secret → `HKDF` → an `AES-GCM` wrapping key that encrypts the DEK →
  `dekWrappedByPrf`.

Envelope encryption: the token is encrypted **once**; the DEK is wrapped **per
method**. Either wrap yields the same DEK, which opens the single token cipher.
Adding/removing a method re-wraps a small key; it never re-encrypts the token.

## Flows

### Enable lock (setup)

1. Precondition: an `AuthSession` is in memory (user is logged in).
2. User sets a 4-digit PIN (mandatory).
3. Generate DEK, encrypt token → `tokenCipher`.
4. Derive PIN key (PBKDF2), wrap DEK → `dekWrappedByPin`.
5. If WebAuthn + PRF available **and** user opts in: create a credential with the
   `prf` extension, evaluate PRF, wrap DEK → `biometric`.
6. Persist the vault. `failedAttempts = 0`, `lastActiveAt = now`.

### Unlock

1. If `biometric` present → WebAuthn `get()` with `prf.eval` → derive key →
   unwrap DEK. On user cancel/failure, fall through (not an error).
2. Else / on fall-through → prompt PIN → derive key → AES-GCM-unwrap DEK. A wrong
   PIN makes the unwrap throw → increment `failedAttempts`.
3. With the DEK → decrypt `tokenCipher` → `AuthSession` in memory.
4. If the token is expired → silent re-auth (GIS `prompt=''`) → re-encrypt the
   fresh token under the **same** DEK (new IV) → update `tokenCipher`.
5. On success: `failedAttempts = 0`, store hands token to `authStore`, app unlocks.

### Lock triggers

- **Cold start / reload:** if a vault exists, boot `locked`.
- **Background timeout:** `visibilitychange → hidden` writes `lastActiveAt`; on
  `visible`, if `Date.now() - lastActiveAt > 7 * 60_000` → `locked`. No background
  timer (browsers freeze them); elapsed is computed on return.

### Token rotation while unlocked

Every fresh token (silent refresh during a session) is re-encrypted under the
in-memory DEK; the envelopes are untouched.

### Throttle & reset

- 5 failed PIN attempts → terminal `LockedOutError`; force Google re-login (wipe
  vault). No timed cooldown window (YAGNI) — lockout is "until re-login".
- "Forgot PIN" → **wipe the vault** → full Google re-login → re-enable lock.
  (Matches §5: PIN reset = re-login, no email flows.)

## Error handling / edge cases

| Case                                 | Behaviour                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| No WebAuthn / no PRF support         | Biometric option not offered → PIN-only. Single honest security model (no weak "gate-only" fallback).            |
| Biometric cancelled / failed         | Fall through to PIN. Not an error.                                                                               |
| Wrong PIN                            | AES-GCM unwrap throws → count attempt; after 5 → lockout + re-login.                                             |
| Corrupt / unreadable vault           | Force Google re-login (treat as reset).                                                                          |
| Logout                               | Clear in-memory token; **keep the vault**. Next launch: unlock → token expired → silent re-auth → re-encrypt.    |
| Offline at unlock with expired token | Unlock succeeds locally; silent re-auth deferred until network returns (app already reads from IndexedDB cache). |

## Testing (TDD — `pinLock.ts` is on the TDD list)

`fake-indexeddb` + Node WebCrypto + mocked `navigator.credentials`.

- setup → unlock with PIN round-trips; decrypted session equals the original.
- setup with biometric (mock PRF) → unlock via PRF round-trips.
- biometric cancel → PIN path still unlocks.
- wrong PIN → unwrap throws, `failedAttempts` increments.
- 5 wrong PINs → `lockedOutUntil` set, re-login forced.
- token rotation re-encrypts under the same DEK (DEK unchanged across rotation).
- reset wipes the vault.
- no-PRF environment → setup offers PIN-only, no `biometric` field written.

## Done when

- A user can enable the lock with a 4-digit PIN; biometric is offered only where
  PRF exists.
- Cold start and 7-min background both re-lock; biometric-first, PIN-fallback.
- Token is never persisted unencrypted; either method decrypts it.
- 5 failed PINs force re-login; "forgot PIN" wipes the vault.
- `pinLock.ts` / `lockStore.ts` tests + `typecheck` + `lint` green.

```

```
