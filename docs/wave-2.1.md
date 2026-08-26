# Wave 2.1

**Goal.** Region-aware currency/number formatting, and a per-category chip color, both gaps found right after Wave 2 shipped.

**Why.** Wave 2's screens formatted numbers off the UI copy language and colored every selected chip the same primary color; both needed fixing before Wave 3 built more screens on the same primitives.

- Region-aware formatting — device region (independent of the copy/UI locale) drives number/currency formatting and the first-run currency default (specs.md §10.7).
- Category color in `TagChip` — a category's tint now shows on its icon always, and on the whole pill when selected, off one shared tint table instead of several independent copies (specs.md §10.8).
