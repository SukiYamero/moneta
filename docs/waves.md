# KuroBello — development waves

This file is the sequencing/status board: which waves exist, in what order,
and whether they're done. It does not decide _behavior_ — that's `specs.md`
(§10 feature specs, §12 backlog). If this file and `specs.md` ever disagree
on a decision, `specs.md` wins.

## Vision

A mobile-first personal-finance PWA. Records income/expenses (flow) and
assets/investments (balance), organized into user-defined sections and
categories, with totals, breakdowns and charts by day/week/month/year, and
an optional PIN lock. The non-negotiable architectural spine: **no backend
of any kind** — identity is Google, data lives in the user's own Drive, the
developer hosts nothing. Audience: personal use today, with the future
possibility of a friend using it with their own Google account.

## Waves

- [Wave 1](wave-1.md) — foundation: auth, Drive bootstrap, PIN lock, UI kit. Complete.
- [Wave 2](wave-2.md) — first read-only screens: Home, Search, History. Complete.
- [Wave 2.1](wave-2.1.md) — region-aware formatting, category chip color. Complete.
- [Wave 2.2](wave-2.2.md) — loading-state anti-flash, guest entry. Complete.
- [Wave 3](wave-3.md) — offline entry, write path, form primitives, profile scoping. Complete.
- [Wave 3.1](wave-3.1.md) — sign-out actually invalidates the session. Complete.
- [Wave 4](wave-4.md) — the app becomes writable and syncs to Drive. Complete.
- [Wave 4.1](wave-4.1.md) — cold-start sequence, light theme, PIN screens, profile switcher. Complete.
- [Ajustes](ajustes.md) — manual-pass fixes from using the app on a real phone. Ongoing.

**Wave 5 — hardening (not started).** Drive sync now writes and reads plain JSON files that sit in the user's own Drive, visible and editable outside the app; `drive.file` limits what the app can see, never what the user (or a bug) can do to the file, so a malformed file must never reach the store. Still missing: a prototype-pollution guard on every merge from parsed Drive JSON (`repo.local.ts`/`repo.fake.ts` currently spread untrusted objects directly); finite/positive range validation on `monto` beyond what `sync/validate.ts` already checks; a size cap on what's read/written; a lint rule pinning the existing no-`innerHTML`/`eval` property so it can't regress silently; a test proving no written file carries a secret (token/PIN/vault material); and telling the user when a malformed entry was skipped rather than silently dropping it. Deliberately out of scope even then: a character blocklist on free text (`nota`/`categoria` are Spanish/Portuguese — accents and emoji are legitimate) and client-side encryption of the Drive files (rejected — it would cost the "your data is verifiably yours" architecture).

**Not scheduled:**

- Receipt scan is deferred indefinitely — on-device OCR is unreliable on real receipts, and the on-device path good enough for it (Chrome's Prompt API / Gemini Nano) doesn't cover this app's mobile target. No backend for it either. Revisit only on a real platform change.
- Voice entry ("dictar un movimiento") is architecturally cleared (Web Speech API, on-device transcript parsing — amount via regex, date/category as a pre-filled suggestion the user confirms, no backend) but not built. The `AreasBanner` on Home renders disabled, pointing at an unbuilt "Áreas" (groups) feature: a list + detail + editor grouping categories into a theme, with month-vs-previous-period spend comparison. `Grupo` doesn't exist in `schema.ts` yet — it needs either a new type or an `extra` field on `Categoria` before real implementation.
