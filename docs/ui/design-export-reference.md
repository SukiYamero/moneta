# Design export reference — Wave 4.1

> Source: `docs/ui/Moneta_ Expense Manager UI.zip`, extracted for this pass to
> `/Users/sukiyamero/.claude/jobs/599ed37a/tmp/design/export/` (a one-time
> local extraction, not checked into this repo). Two files: `Moneta-standalone.html`
> (the whole Claude Design canvas as one bundled page, ~7.2 MB) and
> `moneta-theme.css` (the `--mn-*` token table for both themes, ~3 KB).
>
> **This is a snapshot**, taken 2026-08-20. The user actively keeps adding
> screens to the live canvas (`docs/ui/design-tokens.md`'s own header note),
> so this file can drift from the canvas the same way any export can.
> `specs.md` remains authoritative for behavior; this document is authoritative
> for _what the export contains_, nothing more. Where this file and `specs.md`
> disagree on behavior, `specs.md` wins — flag the conflict, don't silently
> follow the artboard (`AGENTS.md` § How every agent works).
>
> The export's markup uses a component-templating syntax (`sc-if`, `sc-for`,
> `{{ }}` bindings) — quoted verbatim below for structure/copy, but it is not
> React and none of it should be copied as code.

## Scope

Only the four areas below were extracted. The export contains many more
artboards (Home, Search, History, movement sheet, groups, tag picker, voice
input, invoice scan…) — **not documented here**, out of scope for this pass.

1. [Light theme token mapping](#1-light-theme-token-mapping)
2. [Loading / splash / boot screens](#2-loading--splash--boot-screens)
3. [Returning-user screen (§10.21)](#3-returning-user-screen-1021)
4. [PIN screens (§10.2)](#4-pin-screens-102)

---

## 1. Light theme token mapping

`moneta-theme.css` defines `:root` (dark) and `:root[data-mn-theme="light"]`
(light) for the same `--mn-*` names. The app's `src/styles/index.css` uses
different token names under `.dark` (shipped, correct) and `:root` (the
unspecified placeholder §10.30 replaces).

### Method, and how confident this table is

I reverse-engineered the `--mn-*` → app-token correspondence by diffing the
app's **shipped `.dark` block** against `moneta-theme.css`'s dark values,
hex by hex. **Every single value in `.dark` matched a `--mn-*` value
exactly** — no divergence, no invented number. That gives a validated,
1:1 mapping formula (e.g. `--popover` ← `--mn-surface3`, not `--mn-surface2`
as you might guess), which I then applied mechanically to the light column.
This means the light values below are **not guesses** — they're the same
proven formula applied to the light side of a token table that already
matches the dark side perfectly. Where the formula has no dark-side anchor
(a token the app invented that has no `--mn-*` counterpart at all), I say so
instead of guessing.

### Dark theme cross-check — no divergence found

Every token in `src/styles/index.css`'s `.dark` block traced to an exact
`--mn-*` hex/rgba match in `moneta-theme.css`'s `:root` (dark) block. Not a
single value differs. This is a clean confirmation, not a question for the
operator — nothing to change.

### The mapping table

| App token (`:root`)            | Design source (`--mn-*`, light) | Light value                               | Confidence                                                    |
| ------------------------------ | ------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `--background`                 | `--mn-bg`                       | `#F4F3EF`                                 | Confirmed (dark formula)                                      |
| `--foreground`                 | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--card`                       | `--mn-surface`                  | `#FFFFFF`                                 | Confirmed                                                     |
| `--card-foreground`            | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--popover`                    | `--mn-surface3`                 | `#F0EFE9`                                 | Confirmed                                                     |
| `--popover-foreground`         | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--primary`                    | `--mn-accent`                   | `#12A873`                                 | Confirmed                                                     |
| `--primary-foreground`         | `--mn-on-accent`                | `#FFFFFF`                                 | Confirmed                                                     |
| `--secondary`                  | `--mn-surface2`                 | `#FFFFFF`                                 | Confirmed (see note below)                                    |
| `--secondary-foreground`       | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--muted`                      | `--mn-surface`                  | `#FFFFFF`                                 | Confirmed (same slot as `--card` — see note)                  |
| `--muted-foreground`           | `--mn-muted`                    | `#71736B`                                 | Confirmed                                                     |
| `--accent`                     | `--mn-surface`                  | `#FFFFFF`                                 | Confirmed (same slot as `--card`, matches dark's own pattern) |
| `--accent-foreground`          | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--destructive`                | —                               | **not found in export**                   | Gap — see below                                               |
| `--border`                     | `--mn-f6`                       | `rgba(28,28,20,.07)`                      | Confirmed                                                     |
| `--input`                      | `--mn-f8`                       | `rgba(28,28,20,.09)`                      | Confirmed                                                     |
| `--ring`                       | `--mn-accent` @ 50%             | `rgba(18,168,115,.5)`                     | Inferred (see below)                                          |
| `--sidebar`                    | `--mn-surface`                  | `#FFFFFF`                                 | Confirmed                                                     |
| `--sidebar-foreground`         | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--sidebar-primary`            | `--mn-accent`                   | `#12A873`                                 | Confirmed                                                     |
| `--sidebar-primary-foreground` | `--mn-on-accent`                | `#FFFFFF`                                 | Confirmed                                                     |
| `--sidebar-accent`             | `--mn-surface3`                 | `#F0EFE9`                                 | Confirmed                                                     |
| `--sidebar-accent-foreground`  | `--mn-text`                     | `#1B1C19`                                 | Confirmed                                                     |
| `--sidebar-border`             | `--mn-f6`                       | `rgba(28,28,20,.07)`                      | Confirmed                                                     |
| `--sidebar-ring`               | `--mn-accent` @ 50%             | `rgba(18,168,115,.5)`                     | Inferred                                                      |
| `--fg-secondary`               | `--mn-text2`                    | `#3C3E39`                                 | Confirmed                                                     |
| `--fg-tertiary`                | `--mn-text3`                    | `#585A52`                                 | Confirmed                                                     |
| `--fg-faint`                   | `--mn-muted2`                   | `#8A8C83`                                 | Confirmed                                                     |
| `--fg-disabled`                | `--mn-muted3`                   | `#9EA096`                                 | Confirmed                                                     |
| `--success`                    | `--mn-accent-2`                 | `#0E9765`                                 | Confirmed                                                     |
| `--success-strong`             | `--mn-accent`                   | `#12A873`                                 | Confirmed                                                     |
| `--success-foreground`         | `--mn-on-accent`                | `#FFFFFF`                                 | Confirmed                                                     |
| `--danger`                     | `--mn-danger`                   | `#CF4B4B`                                 | Confirmed                                                     |
| `--danger-strong`              | —                               | **not found in export**                   | Gap — see below                                               |
| `--danger-foreground`          | —                               | **not found in export**                   | Gap — see below                                               |
| `--info`                       | `--mn-info`                     | `#3D74C4`                                 | Confirmed                                                     |
| `--warning`                    | —                               | **not found in export as a themed token** | Gap — see below                                               |
| `--canvas`                     | `--mn-bg`                       | `#F4F3EF`                                 | Confirmed                                                     |
| `--surface-sunken`             | `--mn-surface2`                 | `#FFFFFF`                                 | Confirmed                                                     |
| `--border-subtle`              | `--mn-f4`                       | `rgba(28,28,20,.045)`                     | Confirmed                                                     |
| `--border-strong`              | `--mn-f10`                      | `rgba(28,28,20,.11)`                      | Confirmed                                                     |
| `--border-hover`               | `--mn-f16`                      | `rgba(28,28,20,.16)`                      | Confirmed                                                     |

`--chart-1..5` are **out of scope for this table** — `specs.md` §10.30 records
that the user already fixed `:root`'s five `chart-*` tokens to carry the same
values `.dark` does, deliberately, and says explicitly not to re-derive them.
Nothing here touches those five.

### Things to flag, not invent

- **`--muted` and `--accent` land on the exact same hex as `--card`
  (`#FFFFFF`)**, and `--secondary` also lands on `#FFFFFF`. This isn't a
  mapping error on my part — `--mn-surface` and `--mn-surface2` are
  themselves both `#FFFFFF` in the design's own light palette
  (`moneta-theme.css`), and the dark-theme formula genuinely does put
  `--muted`/`--accent` on the `--card` slot (dark: both `#16181d`, same as
  `--card`). Applied faithfully, light inherits the same flatness. Whether
  that reads acceptably (three "different" surfaces that are all pure white)
  is a question for whoever builds the light theme, not something to silently
  fix by picking `--mn-surface3` instead — that would be inventing a value
  the design doesn't specify.
- **`--destructive` / `--danger-strong` / `--danger-foreground` have no
  design source at all**, in either theme. The app's `.dark` values for
  these (`#f87171`, `#f87171`, `#2a0a0a`) don't trace to any `--mn-*`
  variable — moneta-theme.css has no "strong danger" token. They trace
  instead to a **literal, non-variable hex** hardcoded directly in the
  export's markup (the "Borrar y salir" destructive button in the PIN
  forgot-flow: `background:#F87171; color:#2A0A0A`), which the app team
  clearly promoted into a token themselves. That literal only appears once
  in the whole export, under the dark-mode default render — there is no
  light-mode render of that same button to check whether the design intends
  the same hardcoded red in light mode too, or a light-adapted one. **This
  is a real gap, not a value I can fill in**: either keep the literal
  `#F87171`/`#2A0A0A` unchanged in light (matching what little evidence
  exists — the design doesn't route it through a `--mn-*` var at all, which
  reads as "deliberately theme-invariant, like the Google logo colors"), or
  derive a light-adapted version from `--mn-danger` (light) `#CF4B4B`. Flag
  for the operator; don't guess.
- **`--warning` has the same shape of gap.** The app's `.dark` value
  (`#f5b93f`) matches a literal hex used once in the export for the
  sync-pending icon (`color:#F5B93F`), not a `--mn-*` variable — and it also
  happens to equal `--chart-3` (already fixed for light per §10.30). It is
  _plausible_ `--warning` (light) should reuse `--chart-3`'s light value for
  the same identity-consistency reason chart colors were fixed, but that is
  an inference, not something the export states. Flag it as a suggestion,
  not a confirmed extraction.
- **`--ring`/`--sidebar-ring` are not sourced from the design at all in
  either theme** — the app's dark value (`rgba(47,216,150,.5)`) is exactly
  `--mn-accent` (dark) at 50% alpha, a plausible but self-invented
  convention (shadcn's typical focus-ring treatment), not a value drawn from
  `moneta-theme.css`. Applying the same 50%-alpha-of-accent convention to
  light accent (`#12A873`) is the consistent thing to do, marked here as
  inferred, not confirmed.
- **Category tint contrast on light is still unverified.** `specs.md`
  §10.30 already names this as a human judgment nobody has done yet
  (`#f5b93f`, `#2fd896` are the two likely to fail against a light surface)
  — repeating it here so it isn't lost: this export does not resolve that
  open item.

---

## 2. Loading / splash / boot screens

**Finding: the export has no dedicated loading, splash, or boot screen at
all** — no brand-mark-plus-spinner artboard, no full-screen "cargando"
treatment distinct from the screens below. This was checked thoroughly, not
assumed:

- Full-text search across the whole 7.2 MB export for `cargando` /
  `Cargando` / `Descargando` / `splash` / `Splash` / `BootScreen` /
  `bootScreen` returns **exactly one match total**, and it's the in-screen
  movements-list skeleton (Tier 2, below) — not a boot/splash artboard.
- The brand mark (a rounded-square gradient tile with `ph-fill ph-coins`,
  `Moneta` wordmark) is used in exactly three places in the whole export,
  and all three are full auth screens, not a loading state: the Welcome
  screen, the Return screen, and the Drive-permission screen headers (§3
  and the AUTH section below).
- The design's own component logic (`componentDidMount`) resolves the
  initial screen **synchronously** from `localStorage` (`moneta_authed`,
  `moneta_known`) with no async wait and no loading flag in between — there
  is nothing in the export's state model that corresponds to "resolving
  auth" as a visible moment at all. This is a demo/prototype simplification
  (real auth restore is async), not a decision to skip a loading state —
  the export simply never modeled that moment.

**What this means for §10.29 ("one continuous brand screen…") and §10.26
(`DriveDownloadScreen`, the first-run download progress view): neither has
any artboard in this export.** Whatever `BootScreen`'s and
`DriveDownloadScreen`'s visuals end up being, they cannot be copied from the
canvas — there is nothing to copy. The nearest visual material that exists
is the brand mark used on the auth screens (§3 below: gradient tile,
`ph-coins`, `Moneta` wordmark, `var(--mn-accent)`→`var(--mn-accent-d))`
gradient, radial glow behind it) — reusing that mark for consistency is a
reasonable design choice, but it is **my inference**, not something the
export specifies as "the boot screen."

### What loading-adjacent UI does exist

Three real states, none of them a boot/splash screen:

1. **Tier 2 in-screen skeleton** — `<!-- ===== SKELETON: lista de
movimientos cargando ===== -->`. Its own comment states the exact rule
   already shipped in `specs.md` §10.9: _"Misma geometria que la fila real
   (44px de avatar, dos lineas, monto a la derecha) para que no haya salto
   al llegar los datos. No aparece antes de ~150ms: una carga instantanea no
   debe parpadear."_ This independently confirms the ~150ms anti-flash
   number is correct, not an implementation guess. Rows: an `mn-sk`
   shimmer div (`background-image: linear-gradient(90deg, transparent,
var(--mn-f55), transparent)`, `background-size:420px`,
   `animation: mnShimmer 1.25s ease-in-out infinite`) at 44×44px (avatar),
   plus two text-line bars, inside a card matching the real row's
   `border-radius:18px` / `border:1px solid var(--mn-f4)`.

2. **The persistent sync indicator** (`<!-- ===== SYNC INDICATOR (tres
estados) ===== -->`, with the design's own comment: _"El tercero es el
   que gana confianza: es el unico que admite que los datos todavia no
   estan en la nube."_). A pill, not a screen — floats over content at
   `top:96px`, `left/right:20px`, `background:var(--mn-surface92)`. Three
   states:
   - **Syncing**: `ph-arrows-clockwise` spinning (`animation:mnSpin 1s
linear infinite`), color `var(--mn-info)`, text **"Sincronizando con
     tu Drive"**.
   - **Synced ok**: `ph-cloud-check`, color `var(--mn-accent)`, text
     **"Todo al dia"** (no accent on "día" in the export's own copy).
   - **Pending**: `ph-cloud-arrow-up`, color `#F5B93F` (literal, not a
     `--mn-*` var — see the `--warning` note in §1), text
     **"{{ pendingCount }} sin sincronizar"** with a trailing
     **"Se subiran solos"** (also no accent in the export).
     This is the closest thing in the export to §10.26's `DriveDownloadScreen`
     concept, and it is explicitly **not** a full-screen progress view — it's
     a small persistent chip layered over whatever screen is already showing
     content. It matches `specs.md` §10.9 Tier 3 (control-scoped, never a
     blocking overlay) far more than it matches a download/progress screen.

3. **The auth-busy overlay**, shown on top of Welcome/Return/Chooser/Drive
   screens during the simulated OAuth handshake (`authBusy` state,
   `setTimeout(…, 900)` / `setTimeout(…, 1000)` in the export's own mock).
   Full-screen-blocking, `background:rgba(12,13,16,.75)`, a plain spinning
   ring (`border:3px solid rgba(255,255,255,.15); border-top-color:
var(--mn-accent)`), no brand mark repeated — text only on the
   Drive-permission variant: **"Conectando con tu Drive…"**. This matches
   `specs.md` §10.9's own named exception for these two screens (blocking
   is deliberate there, not a Tier-3 violation).

### Nothing else was found

No progress bar, no file count, no percentage, no "Se subirán solos" full
screen, no separate first-run "downloading your Drive data" artboard. If
`DriveDownloadScreen` needs a progress treatment with real numbers
(§10.26 describes "how many files, how far along, an honest failure with
retry"), that has to be designed fresh — it isn't in this export.

---

## 3. Returning-user screen (§10.21)

Three related auth artboards exist, all under one `authStep` state machine
(`welcome | return | chooser | drive`), sharing one full-screen container
(`z-index:40`, `border-radius:44px` phone-frame corner, `background:
var(--mn-bg)`).

### `<!-- ===== AUTH: RETURN (sesión vencida, cuenta conocida) ===== -->`

This is exactly §10.21's screen, and it matches the spec closely:

- Small brand mark (54×54px tile, same gradient/icon as Welcome, scaled
  down) with a radial glow behind it.
- Greeting: **"Hola de nuevo, Alex"** — first-name only, not full name, in
  the title. (The spec says "greets by name from the registry"; the export
  greets by _first_ name specifically.)
- Subtitle: **"Tu sesión caducó por seguridad.<br>Tus datos siguen acá,
  intactos."** — two lines, a `<br>` forced break.
- An account card below the greeting: avatar circle (initial-letter avatar,
  gradient fill, same treatment as elsewhere), full name **"Alex Rivera"**,
  email **"alex.rivera@gmail.com"** (truncated with ellipsis via
  `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`), and a
  status chip **"CADUCADA"** — `color:#E8B84B` on `background:rgba(232,184,75,.12)`,
  both **literal hex, not `--mn-*` tokens** (not matching any app warning
  token exactly — closest is `--warning`/`--chart-3` at `#f5b93f`, a
  different amber; flag as a design-internal inconsistency, not something
  to silently normalize).
- **Primary action**: full Google-branded pill button (white bg,
  `#1F1F1F` text, real 4-color Google "G" SVG, `box-shadow:0 8px 24px
rgba(0,0,0,.3)`), label **"Continuar como Alex"** — first-name
  interpolated into the button label itself, not a generic "Continue with
  Google".
- **Secondary action**: text-only button below it, **"Usar otra cuenta"**,
  transparent background, `color:var(--mn-muted)` → `var(--mn-text)` on
  hover. This exactly matches §10.21's "a secondary 'use another account' is
  acceptable" allowance.
- No guest option, no value proposition, no legal copy — matches §10.21's
  "not first-run pitch" requirement.
- `authBusy` overlay (full-screen, `rgba(12,13,16,.75)`, spinner) covers
  this screen during the simulated re-auth, per §2 above.

**Question for the operator, not a defect to silently fix:** the
reassurance line **"Tus datos siguen acá, intactos"** is shown
unconditionally in the export — there is no branch in the export's own
state model for "data isn't actually there." §10.21 is explicit that this
exact class of claim must be gated on real local data or worded to stay
true regardless ("A screen that says 'your data is still here' over an
empty store is precisely the dishonest-UI defect §11 has already ruled on
twice"). The export doesn't solve this; whoever implements this screen has
to add the gate the export doesn't show, not copy the copy verbatim
unconditionally.

### `<!-- ===== AUTH: ACCOUNT CHOOSER ===== -->`

This is the **Google-branded account picker**, styled as Google's own real
UI (white sheet, `#1F1F1F`/`#5F6368` Google grays, not app tokens — correct,
since it's meant to look like the OS/Google chooser, not the app). Slides up
from `showChooser`, triggered by `startGoogle` from the Welcome screen. It
shows:

- **"Elige una cuenta"** / **"para continuar a Moneta"**
- A list of remembered accounts (mock shows two: "Alex Rivera" /
  "alex.rivera@gmail.com" with the app's own gradient avatar, and "Alex
  Rivera (trabajo)" / "alex@studio.co" with a distinct purple avatar
  `#7E57C2` — Google's own multi-account color convention, not an app
  token)
- **"Usar otra cuenta"** row at the bottom (icon-only user glyph, no
  avatar), matching the "Usar otra cuenta" affordance seen again on the
  Return screen — this is the "how 'usar otra cuenta' is presented"
  the brief asked about: it's Google's own native account-switcher UI, not
  a custom app screen. The app doesn't design this chooser; it's whatever
  Google's real OAuth popup renders. This artboard is a mock of that popup
  for prototyping purposes only.
- Consent copy: **"Para continuar, Google compartirá tu nombre, dirección
  de correo y foto de perfil con Moneta."**

### The flow the export implies (inferred, not explicit)

`welcome → (tap "Continuar con Google") → chooser → (pick account) →`
either **straight to `authed:true`** if `authStep` was already `'return'`
(i.e., a known account skips Drive permission entirely — the export's own
`pickAccount` handler branches on this), **or → `drive` permission screen →
`authed:true`** for a first-time account. This matches `specs.md`'s existing
architecture (a returning user with prior Drive consent shouldn't be asked
again) and gives a concrete answer to "report the flow it implies": **the
Return screen's "Continuar como Alex" button goes through the same Google
chooser as first-run, not a silent one-tap resume** — worth confirming
against real Google Identity Services behavior before assuming the app can
skip the chooser too.

### `WelcomeScreen` (for contrast, not the focus of this area)

Full brand screen: 84×84px mark, **"Moneta"** wordmark (34px, weight 800),
tagline **"Tus finanzas, claras y privadas.<br>Tú eres el dueño de tus
datos."**, single primary Google button, legal footer **"Al continuar
aceptas los Términos y la Política de privacidad"**. **No guest/"continuar
como invitado" option anywhere in the export** — confirmed by a full-text
search for `invitado`/`Invitado`/`guest` returning zero matches anywhere in
the 7.2 MB file. `specs.md` §10.10 (guest entry) has no artboard behind it
in this export; that's not a contradiction to resolve, just an honest gap.

---

## 4. PIN screens (§10.2)

Four artboards, all reachable from the Profile sheet's **"Bloqueo con
PIN"** row (design's own comment: _"seguridad: el hogar real de
LockSettings (salio de la ruta /kit)"_ — i.e. the design deliberately
places lock settings inside the profile sheet, not a top-level
Personalizar/settings screen).

### `<!-- ===== PIN: LOCK SETTINGS ===== -->`

Full-screen push-in panel (`animation:mnPushIn`). Header: back arrow,
title **"Bloqueo con PIN"**, subtitle **"Protegé la app en este
dispositivo"**. One card:

- Row: lock icon, **"Pedir PIN al abrir"**, sub-copy **"4 dígitos, solo en
  este teléfono"**, a toggle switch (`{{ togglePin }}`).
- When `pinEnabled`, two buttons appear: **"Cambiar PIN"** (outlined) and
  **"Bloquear ahora"** (tinted, `var(--mn-tint12)` bg /
  `var(--mn-accent-2)` text) — an explicit **manual lock-now** action that
  doesn't currently exist as a spec'd affordance.
- Footer copy: **"El PIN se guarda solo en este dispositivo. Si lo olvidás
  podés desactivarlo desde la pantalla de bloqueo."** — this sentence is
  the export's own pointer to the "Olvidé mi PIN" flow below, stated as
  policy up front.

### `<!-- ===== PIN: LOCK SCREEN ===== -->` (entering the PIN)

Full-screen, `z-index:60`, radial accent glow behind a centered icon tile.
**"Ingresá tu PIN"**, subtitle `{{ lockSubtitle }}` (dynamic, not fixed
copy — the export doesn't show its variants). Four dot indicators
(`pinDots`, filled/outline via bound colors). Error line reserved
(`height:20px` always present, to avoid layout shift) — bound to
`{{ pinError }}`, color `#F87171` (literal, not `--mn-*`/`--destructive`
var). A 3×4 numeric keypad (`padKeys`, 12 slots — 10 digits + presumably a
delete key + a blank/biometric slot, though nothing in the export's own
`padKeys` construction shows a biometric icon; see below).

**Below the keypad: `<button …>Olvidé mi PIN</button>`.** This is the
important one the brief flagged. Tapping it does **not** open any kind of
PIN-recovery, PIN-reset-via-email, or account-verification flow. The
export's own handler is explicit:

```
askForgotPin = () => this.setState({ forgotConfirm: true, ... });
...
doForgotPin = () => {
  // demo: borra el PIN y la sesión, y vuelve al login de Google
  localStorage.removeItem('moneta_pin');
  localStorage.setItem('moneta_pin_on', '0');
  localStorage.setItem('moneta_authed', '0');
  localStorage.removeItem('moneta_known');
  this.setState({ ..., authed: false, authStep: 'welcome', tab: 'home' });
};
```

Tapping "Olvidé mi PIN" opens a **confirm dialog** (not a direct action):
icon tile (warning triangle, danger-tinted), title **"¿Restablecer el
acceso?"**, body **"Sin el PIN no podemos abrir los datos de este
dispositivo: se van a borrar y vas a tener que iniciar sesión de
nuevo."**, two buttons — **"Cancelar"** and a destructive **"Borrar y
salir"** (`background:#F87171; color:#2A0A0A`, literal hex — see §1's
`--destructive` gap note).

**This is the same destructive action the code already has** (vault wipe +
forced Google re-login on the 5th failed PIN attempt, per `specs.md`
§10.2's edge cases) — **not a new recovery mechanism**. The design doesn't
add a "reset your PIN without losing data" path; it exposes the _existing_
wipe-and-relogin action as a **manual, always-available escape hatch**
("Olvidé mi PIN" is reachable at any time, not just after 5 failures),
worded as an honest trade rather than hidden behind a failure counter. That
is the concrete, exact answer to what "Olvidé mi PIN" does: it is a
UI entry point onto the wipe path the app already implements, framed
explicitly as "your local data goes away, you sign in again" — not a
promise the app doesn't already keep.

### `<!-- ===== PIN: SETUP ===== -->`

Same shell as the lock screen (full-screen, same keypad, same dot
indicators, same reserved error line) but push-in animated and headed by an
X-close button plus a small uppercase kicker label bound to
`{{ pinSetupKicker }}` — the export's own JS resolves this to **"Nuevo
PIN"** (first time) or **"Cambiar PIN"** (already has one):
`pinSetupKicker: this.state.pin ? 'Cambiar PIN' : 'Nuevo PIN'`. Title/hint
are two-step, also resolved in JS rather than fixed copy:
`pinSetupTitle`: **"Elegí un PIN de 4 dígitos"** (create step) /
**"Repetí tu PIN"** (confirm step); `pinSetupHint`: **"Lo vas a necesitar
cada vez que abras la app."** / **"Para confirmar que lo recordás."** A
mismatch on the confirm step sets `pinError: 'Los PIN no coinciden'` (this
literal string lives in the JS, not in the markup template — noted since
it's real copy, not a binding placeholder).

### Biometric: absent, confirmed by exhaustive search

**No biometric UI exists anywhere in this export.** Checked directly, not
inferred from absence in the four PIN artboards alone: a full-text search
across the entire 7.2 MB file for `webauthn`, `WebAuthn`, `biometr`,
`Biometr`, `huella`, `dactilar`, `Face ID`, `FaceID`, `Touch ID`, `touch-id`
returns **zero matches**. The six hits for `fingerprint`/`ph-fingerprint`
are all inside the bundled Phosphor icon-font's own CSS class table (every
possible icon glyph is defined whether used or not, e.g. `.ph.ph-fingerprint:before
{ content: "\e23e"; }`) — never referenced by any artboard's actual markup.
`specs.md` §10.2 specs biometric-first-with-PIN-fallback as the target
design; **this export gives Track AF nothing to build the biometric side
from** — the PIN screens are complete and implementable from this export,
but biometric prompt/offer UI (if it's meant to appear on the lock screen
before or beside the PIN pad) has no reference here and needs its own
design pass.

### Settings entry point, for completeness

The Profile sheet's **"Bloqueo con PIN"** row shows a trailing status label
bound to `{{ lockStateLabel }}`, resolved in JS as
`this.state.pinEnabled ? 'Activado' : 'Desactivado'` — worth carrying over
verbatim as the two states of that summary label.

---

## Summary of open questions for the operator

1. **`--destructive`/`--danger-strong`/`--danger-foreground` and
   `--warning`** have no light-mode source in the export (§1) — decide
   whether they stay theme-invariant literals or get light-adapted from
   `--mn-danger`/`--chart-3`.
2. **`--muted`/`--accent`/`--secondary` all resolve to the same `#FFFFFF`**
   in light, faithfully inherited from the dark theme's own pattern of
   reusing the card slot (§1) — confirm this is acceptable before shipping,
   rather than "fixing" it unprompted.
3. **`BootScreen` and `DriveDownloadScreen` have no artboard at all** (§2) —
   whatever they end up looking like has to be designed fresh, not
   extracted.
4. **The Return screen's reassurance copy ("Tus datos siguen acá,
   intactos") is unconditional in the export**, which is exactly the
   dishonest-UI shape §10.21 already warns against — the gate has to be
   added during implementation, it isn't in the design.
5. **The "CADUCADA" chip uses a literal amber (`#E8B84B`) that doesn't match
   any existing app token** (§3) — decide whether to reuse `--warning`
   (`#f5b93f`) or treat this as its own color.
6. **Biometric has zero design reference** (§4) — Track AF can fully build
   the PIN side from this export, but the biometric-offer UI needs its own
   design work first.
