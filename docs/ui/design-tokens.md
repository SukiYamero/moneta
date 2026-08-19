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

**Light theme is an unspecified placeholder.** No light design exists yet.
`Config.preferencias.tema` (`schema.ts`) already plans for `claro | oscuro |
sistema`, so `:root` keeps shadcn's neutral scaffold values rather than
being left broken — replace them with real values once a light design
lands (own spec, own decision-log entry when it happens).

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
