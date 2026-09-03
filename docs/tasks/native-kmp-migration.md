# Native migration: Kotlin Multiplatform, Android first

## Decision

Distribution moves to genuinely native apps built with **Kotlin Multiplatform
(KMP)**: one Kotlin module carries the data/business logic, compiled natively
for both Android and iOS — not a bridge, not a WebView. Android ships first,
end to end; iOS starts only once Android is working (see Sequencing).

This supersedes the previous "Capacitor migration" decision
(`docs/pendientes-usuario.md`'s former item 28) — the web/PWA path, and the
whole Capacitor/WebView plan, are dropped, not kept as a stepping stone.

## Why KMP over the alternatives considered

- **Capacitor (WebView wrapper):** fastest to ship, reuses the existing React
  code as-is, but permanently inherits WebView-class bugs — the iOS `dvh`/
  keyboard drift already in the backlog, and Google blocking its OAuth popup
  inside embedded WebViews (`disallowed_useragent`) — that a real native app
  never has in the first place.
- **React Native:** keeps the same language (TypeScript) and renders real
  native views (not a WebView), but doesn't remove the underlying problem —
  it carries its own class of iOS-specific bridge bugs, distinct from but
  structurally the same shape as the WebView issues already fought here.
- **Kotlin Multiplatform:** the actual business logic — schema, `movimientoStats`,
  the sync/outbox engine, validation, `categorySuggest` — is written once and
  compiled natively on both platforms. Google's own recommended direction
  since I/O 2024; stable as of Kotlin 2.2 / Compose Multiplatform 1.8 (2025);
  real large-scale adopters include Airbnb (95% shared booking logic),
  Duolingo (80% shared logic, simultaneous iOS/Android releases), Netflix,
  and Google's own Docs team (reported the KMP experiment "very happy").

## What's shared vs. platform-specific

- **Fully shared, one Kotlin module:** the data layer (schema equivalent,
  SQLDelight in place of Dexie), `movimientoStats`, `categorySuggest`, the
  sync/outbox merge engine (HLC ordering, the Drive shard read-modify-write
  serialization), validation. Also shareable: per-screen **ViewModels**
  (Jetpack's multiplatform ViewModel library) — not just data, but the
  orchestration of what happens on a given action (e.g. tapping Save) too.
- **Platform-specific by nature** (via Kotlin's `expect`/`actual`, still one
  shared module, just with a small actual implementation per platform): the
  PIN vault's secure storage (Android Keystore vs. iOS Keychain), the
  biometric prompt (`BiometricPrompt` vs. `LocalAuthentication`), and the
  native Google sign-in integration itself.
- **Native Google auth, no WebView involved on either platform:** Android
  uses Credential Manager (sign-in) + `AuthorizationClient` (Drive scopes,
  `drive.file`/`drive.appdata`) called directly from Kotlin — both resolve
  silently on repeat launches once granted, no re-consent popup. iOS uses
  Google's native Sign-In SDK, which requests the same scopes in one flow.

## Sequencing

Android first, end to end (shared module + Android UI in Jetpack Compose),
working and usable, before any iOS UI work starts. The shared module carries
the real risk — the sync engine and the crypto/vault code — and proving it
against one UI avoids paying for the same architecture churn twice.

Exception: keep the iOS Kotlin/Native compile target green from day one (a
trivial SwiftUI shell around the shared module, nothing more) — this catches
multiplatform-incompatible code in the shared module early and cheaply,
without actually building iOS UI in parallel.

## UI strategy — open, revisit after Android ships

Two paths, deliberately not decided yet:

1. **Native UI per platform** — Jetpack Compose (Android) + SwiftUI (iOS),
   sharing only logic/ViewModels. The safer default: no known blocking
   issues, the most mature path.
2. **Compose Multiplatform for iOS too** — the same Compose UI code runs
   natively on both platforms (rendered via Skia/Skiko on iOS). Stable since
   JetBrains' 1.8.0 release (May 2025). Specifically attractive here because
   the app's design is already 100% custom (Manrope, Lucide, bespoke
   `BottomSheet`/`Toast`/`PagedGrid` animations) — CMP's own "no Cupertino
   kit, defaults to Material" limitation is a non-issue for a design that was
   never going to look native-iOS-idiomatic anyway.

   Known, documented risks as of 2026 that argue for caution rather than
   committing now: reported memory leaks specifically around **lingering
   bottom sheets**, list-prefetch/scroll jank on iOS (Skiko's prefetch
   scheduling differs from Android's), and accessibility gaps versus native
   SwiftUI (VoiceOver, no `XCTest` exposure). These land directly on the two
   component patterns — sheets and paginated/scrolling lists — this app just
   spent real engineering effort polishing; not a generic footnote for this
   specific codebase.

   Decision point: revisit once Android ships. Trialing CMP for iOS at that
   point is lower-risk — a working per-platform Compose/SwiftUI fallback
   already exists if CMP doesn't hold up.

## Rough time estimate (Android only: shared logic + Android UI, parity with today's web MVP)

| Work package                                                                             | Hours       |
| ---------------------------------------------------------------------------------------- | ----------- |
| KMP project setup (modules, Gradle, first build on a device)                             | 15–25       |
| Shared data layer (schema, SQLDelight, `movimientoStats`, `categorySuggest`, validation) | 40–70       |
| Sync/outbox engine (HLC merge, Drive shard serialization)                                | 50–100      |
| Auth/security (native Google sign-in + Drive scopes, PIN vault on Keystore, biometrics)  | 35–70       |
| Android UI in Compose (~15–20 screens, incl. the custom gesture/animation work)          | 100–160     |
| Testing, stabilization, real-device QA                                                   | 40–70       |
| Contingency (~20%)                                                                       | 55–95       |
| **Total**                                                                                | **335–595** |

At roughly 40 effective hours/week, that's **~8–15 weeks (2–3.5 months)** of
calendar time for a working Android app at parity with today's web MVP.

This is a planning estimate, not a commitment — re-baseline once the shared
data layer and the sync engine are actually underway; those two are the most
likely to move the range.

## Explicitly out of scope for now

- Anything Capacitor-specific (`@capacitor/*`, the WebView wrapper) —
  superseded outright, not a stepping stone toward this plan.
- The iOS app itself — starts only after Android ships (see Sequencing).
- The final call on Compose Multiplatform vs. separate SwiftUI UI — deferred
  (see UI strategy).
