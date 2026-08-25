# Design tokens — rationale

Ground truth is code: **`src/styles/index.css`**. This file explains the
_why_ behind what's there; it is not a copy of the values, so it can't drift
out of sync with the CSS the way a value-dump doc would. If a value here and
the CSS ever disagree, the CSS wins — fix this doc, not the other way.

Source design: Claude Design project `18d93152-c2e6-4bde-8eff-f944b1537ad8`
(`Moneta.dc.html`), read 2026-08-18. The user actively keeps adding screens
to it — treat it as a living source, not a one-time snapshot. See
`docs/ui/implementation-plan.md` for the screen-by-screen breakdown and the
design ↔ code sync workflow.

## Colors

Mapped onto shadcn's existing semantic slots (`--background`, `--card`,
`--primary`, `--destructive`, etc.) under `.dark`, so every already-installed
shadcn/ui component automatically picks up the real palette — no parallel
color system for components to accidentally miss. Extra tokens
(`--color-fg-secondary/tertiary/faint/disabled`, `--color-success*`,
`--color-danger*`, `--color-info`, `--color-warning`, `--color-canvas`,
`--color-surface-sunken`, `--color-border-subtle/strong/hover`) exist because
the design uses more foreground/status/surface tiers than shadcn's default
slot set has room for — five text tiers, not one `muted-foreground`.

**Light theme is real, mapped from the design export (specs.md §10.30).**
`:root` carries the light values; `.dark` is untouched. The mapping came
from `docs/ui/design-export-reference.md` §1: the app's shipped `.dark`
block was diffed hex-by-hex against `docs/ui/moneta-theme.css`'s dark
column, every value matched, and that same formula was applied mechanically
to the light column — not re-guessed per token. Four exceptions the mapping
alone couldn't resolve, all decided by the user 2026-08-20 and recorded in
`specs.md` §10.30, not to be "fixed" back toward the export's raw numbers:

- The five `chart-*` tints. The export's own light values, measured in real
  usage (`text-chart-N` on `bg-chart-N/15` over a white card, WCAG 3.0),
  fail contrast outright (1.62–2.32 against a 3.0 threshold). The fix holds
  each tint's hue/saturation and lowers lightness to the minimum that
  passes — the same operation the design itself already performs on the
  accent (`#2FD896` dark → `#12A873` light) — landing at `#1c9465`,
  `#4180e9`, `#af7809`, `#f72121`, `#a958fb`.
- `--destructive`/`--danger-strong`/`--danger-foreground`/`--warning` have
  no light source in the export at all (their dark values trace to a
  literal hex hardcoded once in the export's markup, not a `--mn-*`
  variable). Adapted from `--mn-danger`'s own dark→light pair (`#FB8989` →
  `#CF4B4B`) and, for `--warning`, from `--chart-3`'s light value (their
  dark hexes are identical, `#f5b93f`).
- `--muted`/`--accent`/`--secondary` all landing on the same `#FFFFFF` as
  `--card` is confirmed correct, not a mapping bug — the design's own light
  palette reuses the card slot the same way `.dark` already does.

**The theme mechanism** — `src/lib/theme.ts` (pure resolution) +
`src/lib/syncStoredTheme.ts` (the `dataStore` subscription that applies a
resolved `tema`, mirroring `src/lib/i18n/syncStoredLocale.ts`'s split for
`idioma`) + a synchronous inline script in `index.html` that resolves the
theme before React renders, so a returning user never sees a full-screen
colour flash. The app's `.dark`-class convention wins over the design's own
`data-mn-theme` attribute — Tailwind v4's `dark:` variant is already wired
to the class everywhere.

**Google's brand SVG colors** (the "G" logo on the auth screens) are the
one deliberate exception — they're a third-party mark with fixed legal
colors, not part of our token system. They stay as literal hex in the
component that renders the Google icon.

## Radius scale

Not a single-base multiplier. The design's radii (8–30px, plus a 44px phone
frame that doesn't apply to a real web layout) aren't a clean geometric
progression, so `--radius-xs` through `--radius-5xl` are explicit steps
rather than `calc(var(--radius) * n)`. Being honest about that beats forcing
a formula that doesn't match what was actually designed.

## Font size scale

Overrides Tailwind's default type scale on purpose — `--text-base` is 14px
here, not Tailwind's default 16px, because this is a dense mobile UI and
that's what the design actually uses as its body size.

The design contains many near-duplicate half-pixel sizes (14 vs 14.5, 15 vs
15.5, 17 vs 17.5, etc.) — almost certainly freehand micro-variance, not a
deliberate hierarchy step. Consolidated into one token per meaningfully
distinct size, rounding the odd ones in. Consolidating prevents the exact
drift problem tokens exist to solve: two near-identical sizes floating
around invite inconsistency, not intentional hierarchy.

**Deliberately NOT tokenized:** the largest, rare, one-off display sizes
(the welcome-screen title, the giant amount-entry input). Those are
one-of-a-kind hero moments, not a reused step in the scale — use an
arbitrary Tailwind value (`text-[46px]`) there. If a "hero number" size
turns out to repeat across screens as the design grows, promote it to a
token then; don't pre-invent a step for a value used once.

## Font weight

**No new tokens** — Tailwind's built-in `font-medium` (500) / `font-semibold`
(600) / `font-bold` (700) / `font-extrabold` (800) already match the
design's weights exactly. Redefining them would be tokenizing something
that isn't loose.

## Animation

`--ease-ios` (`cubic-bezier(.32,.72,0,1)`) is the single most important
token here — it's the exact curve the design uses for every sheet/push/pop
transition, and it's what makes those feel like a native iOS sheet instead
of a website modal. `--animate-fade-in/sheet-up/pop-in/push-in` are ported
directly from the canvas's own `@keyframes` (renamed to kebab-case). All
respect `prefers-reduced-motion` via the global override in `index.css` —
don't bypass it with an inline animation.

## Spacing — deliberately NOT centralized

Gaps/padding in the design land on a near-continuous scale (6, 7, 8, 9, 10,
11, 12, 13, 14px...), not a clean 4px grid. Tokenizing every one-off spacing
value would be over-engineering the wrong seam: layout spacing is
per-component composition, not a brand-identity value like a color or a
radius — getting a gap 1px off doesn't fragment the brand the way an
inconsistent green would. Use Tailwind's default spacing scale, or an
arbitrary value (`gap-[7px]`) for a one-off. If the same odd spacing value
turns out to recur as a deliberate rhythm (not coincidence) across many
components, that's a signal to add a named token then — not before.

## Screen layout constants — the exception to "not centralized"

Two values are layout constants a _screen_, not a component, must agree with
its siblings on — the opposite case from the spacing rule above, which is
about per-component one-offs:

- `--bottom-nav-height` / `--bottom-nav-clearance` — the tab bar's own height
  and the clearance any scrollable content under it needs (specs.md §10.x,
  Wave 2). Every screen and the `Toaster` size off the same token so a
  change to the bar's height propagates everywhere at once.
- `--screen-inset-top` (specs.md §10.34, Ajustes 1 Track AJ-A) — the one gap
  between the safe area and the first pixel of any top-level screen's
  content (or its header row, for a screen that has one). Measured on `main`
  before this fix: Home `pt-2` (8px), Search `pt-6` (24px), History/Settings
  `pt-14` (56px) — four hand-typed values with no relationship to each
  other, which is exactly what let them drift apart in the first place.
  `max(calc(1.5rem - env(safe-area-inset-top)), 0rem)`: **tops up** to a
  1.5rem floor above whatever `body`'s own blanket
  `env(safe-area-inset-top)` padding already contributed, rather than
  re-adding that inset a second time (`body` already gives it to every
  screen in normal flow, unconditionally) — a bare `max(1.5rem,
env(safe-area-inset-top))` here would double-count it on a real notch.
  1.5rem is Search's own pre-existing value, not an invented number. A
  screen with a back-bar header (`src/components/shared/ScreenHeader.tsx`)
  renders that header as the first element _inside_ the token's padding,
  owning its own height, rather than encoding "inset + header" as a second
  magic number per screen.

## Icons: Lucide, not Phosphor

The design's canvas uses Phosphor icons loaded from an `unpkg.com` CDN —
fine for a disposable prototype, wrong for this app: `AGENTS.md` already
decided Lucide (self-hosted via the installed `lucide-react` package), and
this is a PWA that needs to work offline — a runtime icon CDN breaks that.
Switching to `@phosphor-icons/react` as an installed package was considered
and rejected: it's a new dependency plus a full re-mapping across ~150+ icon
references in the design, for a purely cosmetic difference between two
perfectly good icon sets. Lucide has a directly equivalent icon for every
Phosphor icon used in this design (`ph-magnifying-glass` → `Search`,
`ph-caret-right` → `ChevronRight`, `ph-gear-six` → `Settings`, etc.) — map
1:1 per-component as each screen is implemented; no icon-mapping table is
maintained separately since it would just be a second thing to keep in sync.

## Fonts: Manrope, not Geist

Unlike icons, this one **follows the design**: Manrope is used consistently
across the entire canvas as a foundational typography choice, not an
incidental one, and self-hosting it costs the same as Geist did — swap one
`@fontsource-variable/*` package for another (done: `package.json`,
`src/styles/index.css`). No CDN, no offline risk, no per-call-site migration
cost the way icons would have. Supersedes the "Nova preset: Geist font" line
in `specs.md` §3 — see the §11 decision entry dated 2026-08-18.
