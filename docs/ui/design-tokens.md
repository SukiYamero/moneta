# Design tokens — rationale

Ground truth is code: **`src/styles/index.css`**. This file explains the
_why_ behind what's there; it is not a copy of the values, so it can't drift
out of sync with the CSS the way a value-dump doc would. If a value here and
the CSS ever disagree, the CSS wins — fix this doc, not the other way.

Source design: the Claude Design canvas. It is not reachable from an agent
session, so `docs/ui/moneta-theme.css` is the versioned export to read.

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

**Light theme (`:root`) is real** and mapped from the design export;
`.dark` is untouched. Five tokens deliberately diverge from the export's raw
numbers rather than reproducing them verbatim, because the export's own
values fail contrast when measured against a real card background (WCAG 3.0)
or have no light source in the export at all:

- The first five `chart-*` tints keep the export's hue/saturation and lower
  lightness to the minimum that passes contrast — the same operation the
  design itself already performs on the accent color — landing at
  `#1c9465`, `#4180e9`, `#af7809`, `#f72121`, `#a958fb`. `chart-6`
  through `chart-9` (teal, indigo, orange, magenta) extend the set past what
  the export provides, chosen by the same method — natural hue/saturation,
  lightness set to the same ≥3:1 contrast margin against each theme's card —
  rather than sourced from a design value.
- `--destructive`/`--danger-strong`/`--danger-foreground`/`--warning` have no
  light source in the export (their dark values trace to a literal hardcoded
  hex, not a design variable). Adapted from the nearest design token that
  does have both a dark and a light value.
- `--muted`/`--accent`/`--secondary` landing on the same white as `--card`
  is correct, not a mapping bug — the design's own light palette reuses the
  card slot the same way `.dark` already does.

**The theme mechanism** — `src/lib/theme.ts` (pure resolution) +
`src/lib/syncStoredTheme.ts` (applies a resolved `tema`, mirroring
`src/lib/i18n/syncStoredLocale.ts`'s split for `idioma`) + a synchronous
inline script in `index.html` that resolves the theme before React renders,
so a returning user never sees a full-screen colour flash. The app's
`.dark`-class convention wins over the design's own theme attribute —
Tailwind v4's `dark:` variant is already wired to the class everywhere.

**Google's brand SVG colors** (the "G" logo on the auth screens) are the
one deliberate exception — they're a third-party mark with fixed legal
colors, not part of our token system. They stay as literal hex in the
component that renders the Google icon.

## Radius scale

Not a single-base multiplier. The design's radii aren't a clean geometric
progression, so `--radius-xs` through `--radius-5xl` are explicit steps
rather than `calc(var(--radius) * n)`. Being honest about that beats forcing
a formula that doesn't match what was actually designed.

## Font size scale

Overrides Tailwind's default type scale on purpose — `--text-base` is 14px
here, not Tailwind's default 16px, because this is a dense mobile UI and
that's what the design actually uses as its body size.

The design contains many near-duplicate half-pixel sizes — near-certainly
freehand micro-variance, not a deliberate hierarchy step — consolidated into
one token per meaningfully distinct size. Consolidating prevents the exact
drift problem tokens exist to solve: two near-identical sizes floating
around invite inconsistency, not intentional hierarchy.

**Deliberately NOT tokenized:** the largest, rare, one-off display sizes
(the welcome-screen title, the giant amount-entry input). Those are
one-of-a-kind hero moments, not a reused step in the scale — use an
arbitrary, `rem`-based Tailwind value (`text-[2.875rem]`) there; `scripts/no-raw-px.sh`
fails the build on a raw px arbitrary value like `text-[46px]`. If a "hero number" size
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
directly from the canvas's own keyframes. All respect
`prefers-reduced-motion` via the global override in `index.css` — don't
bypass it with an inline animation.

## Spacing — deliberately NOT centralized

Gaps/padding in the design land on a near-continuous scale, not a clean 4px
grid. Tokenizing every one-off spacing value would be over-engineering the
wrong seam: layout spacing is per-component composition, not a
brand-identity value like a color or a radius — getting a gap 1px off
doesn't fragment the brand the way an inconsistent green would. Use
Tailwind's default spacing scale (including its half steps, e.g. `size-8.5`
for 34px), or an arbitrary `rem`-based value (`gap-[0.4375rem]`, never
`gap-[7px]` — `scripts/no-raw-px.sh` fails the build on a raw px arbitrary
value) for a one-off. If the same odd spacing value turns out to recur as a deliberate
rhythm (not coincidence) across many components, that's a signal to add a
named token then — not before.

## Screen layout constants — the exception to "not centralized"

Two values are layout constants a _screen_, not a component, must agree with
its siblings on — the opposite case from the spacing rule above, which is
about per-component one-offs:

- `--bottom-nav-height` / `--bottom-nav-clearance` — the tab bar's own height
  and the clearance any scrollable content under it needs. Every screen and
  the `Toaster` size off the same token so a change to the bar's height
  propagates everywhere at once.
- `--screen-inset-top` — the one gap between the safe area and the first
  pixel of any top-level screen's content (or its header row, for a screen
  that has one). `max(calc(1.5rem - env(safe-area-inset-top)), 0rem)`:
  **tops up** to a 1.5rem floor above whatever `body`'s own blanket
  `env(safe-area-inset-top)` padding already contributed, rather than
  re-adding that inset a second time — a bare
  `max(1.5rem, env(safe-area-inset-top))` here would double-count it on a
  real notch. A screen with a back-bar header
  (`src/components/shared/ScreenHeader.tsx`) renders that header as the
  first element _inside_ the token's padding, owning its own height, rather
  than encoding "inset + header" as a second magic number per screen.

## Icons: Lucide, not Phosphor

The design's canvas uses Phosphor icons loaded from a CDN — fine for a
disposable prototype, wrong for this app: this is a PWA that needs to work
offline, and a runtime icon CDN breaks that (see `AGENTS.md`'s no-CDN rule).
Lucide (self-hosted via the installed `lucide-react` package) has a directly
equivalent icon for every Phosphor icon the design uses — map 1:1
per-component as each screen is implemented; no icon-mapping table is
maintained separately since it would just be a second thing to keep in sync.

## Fonts: Manrope, not Geist

Unlike icons, this one **follows the design**: Manrope is used consistently
across the entire canvas as a foundational typography choice, not an
incidental one, and self-hosting it costs the same as any other
`@fontsource-variable/*` package. No CDN, no offline risk.

## When a design reference disagrees with the built code

A design reference disagreeing with existing code is a question, not a
license to overwrite. The canvas can be older than the code, or the code can
have moved on for a good reason — implementing the canvas faithfully can
silently revert real work, and assuming the code is right can silently drop
a change actually wanted. When a design reference disagrees with what is
already built, **ask which one is authoritative for that specific part**,
naming what already exists and in what form, before writing code. Ask about
the section, not the whole screen.

The divergences already decided and listed in this file — the fluid layout
instead of a fixed device frame, Lucide instead of CDN-loaded Phosphor,
tokens instead of inline styles, ≥44px touch targets, and the five color
exceptions above — are settled, not open questions; proceed on those without
asking. Only an _unrecorded_ divergence triggers the question.
