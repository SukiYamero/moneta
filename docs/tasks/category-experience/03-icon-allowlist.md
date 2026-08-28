# 03 — More icons, every one of them searchable

**Branch:** `feat/icon-allowlist` · **Phase 1** · Blocks 05 and 07.

Read `docs/tasks/category-experience/README.md` first.

## Goal

Roughly double the curated icon allowlist, from 35 keys to about 70, and
guarantee that every single key is reachable by typing a word — because task 07
reorders the icon grid by what the user types, and an icon that no keyword
points at can never be surfaced by that feature.

## Where

- `src/lib/categoryIconKeys.ts` — `CATEGORY_ICON_KEYS`, the plain string list
  `schema.ts` and `sync/validate.ts` depend on. It lives in `src/lib/` because
  the bottom layer needs it, and it may not import from `@/components`
  (`scripts/no-ui-imports-in-lib.sh` fails the build if it does).
- `src/components/shared/categoryIcons.ts` — the `key → LucideIcon` map, held
  honest by `satisfies Record<CategoryIconKey, LucideIcon>`.
- `src/features/tags/categorySuggest.ts` — `CATEGORY_CONCEPTS`, the keyword
  table. **Add entries only.** Task 07 adds the ranking function to this same
  file, in a later phase; do not pre-build it here.

## Hard rule: keys are append-only

A key is stored data — it sits in `Categoria.icono` in IndexedDB and in the
Drive op log, and `sync/validate.ts` validates against the list, dropping any
value not in it. **Never rename, never remove, never reorder an existing key.**
Adding is free; anything else silently blanks a user's icon on the next pull.
New keys go at the end of the list, and the first 35 entries stay
byte-identical.

If an existing key looks wrong (a bad name, a duplicate concept), leave it and
say so in your report. Renaming it is a data migration wearing a tidy-up
costume.

## The coverage invariant

Every `CategoryIconKey` must be the `icon` of at least one entry in
`CATEGORY_CONCEPTS`. This is what lets task 07's ranking reach the whole set,
and it is the reason both files grow in one task rather than two.

Write it as a test, not as a promise:

```ts
it('every icon key is reachable through at least one keyword concept', () => {
  const covered = new Set(CATEGORY_CONCEPTS.map((c) => c.icon))
  expect(CATEGORY_ICON_KEYS.filter((k) => !covered.has(k))).toEqual([])
})
```

Asserting on the **filtered list** rather than a boolean is deliberate: a
failure then names the uncovered keys instead of saying `false !== true`.

That test is the acceptance criterion for the whole task, and it is what stops
the next person adding a 71st icon nobody can find.

## What to add

Aim at what people actually spend money on, and at what task 05's seed catalog
will need — groceries, dining out, delivery, fuel, parking, public transport,
rent, utilities, internet, phone, insurance, clothing, electronics, furniture,
beauty, fitness, medical, pharmacy, childcare, school, streaming,
subscriptions, games, sport, travel, hotels, savings, investments, debt, bank
fees, charity, laundry, cleaning, repairs, parcels, work tools.

Rules for each addition:

- The icon comes from `lucide-react`, imported by name in the existing
  alphabetical block. **No namespace import** — `import * as` is banned and
  `bun run lint` fails on it.
- The key is kebab-case and names the **thing**, not the Lucide component:
  `shirt`, not `Shirt`; `tv`, not `MonitorPlay`. When Lucide's name and the
  concept differ, the key follows the concept.
- Its concept entry carries a multilingual keyword bag in the existing style —
  Spanish, English and Portuguese in one array, matched on whole normalized
  words through `normalizeForSearch`. `gimnasio` / `gym` / `academia` already
  share one bag; follow that, do not create three entries for one idea.
- Include the accented and unaccented spelling where they differ
  (`peluqueria` / `peluquería`) — `normalizeForSearch` strips accents, so this
  costs nothing and protects against it later not doing so.
- Its concept entry carries a tint from `ICON_AVATAR_TINTS`. Reuse across
  concepts is fine and expected; there are 9 tints and ~70 icons.
- Keep the table's existing ordering logic: income-ish concepts first, then
  everyday spending. The declared order **is** the default grid order the user
  sees when they have typed nothing, so it is a UI decision, not a list.

## Premortem

- **Most likely failure: keyword bags that only cover Spanish.** The user asked
  for the icon search to work on what they type, and they type both languages.
  Every new bag gets at least the Spanish and the English word.
- **Second: an icon added to the map but not the key list, or the reverse.**
  `satisfies` catches one direction; the coverage test catches the other; the
  build catches neither if both files are edited consistently but the concept
  table is forgotten.
- **Third: quietly renaming an existing key while tidying.** See the
  append-only rule.
- **Fourth: ignoring that the declared order is the default UI order.** Dumping
  40 new keys at the end in the order they occurred to you gives the user a grid
  whose second page is a random pile. Group them by theme as you append.

## Acceptance

- `CATEGORY_ICON_KEYS.length` is roughly 70, and its first 35 entries are
  byte-identical to what they were.
- The coverage test passes, and it names uncovered keys when it fails.
- A test asserts `suggestCategoryVisual` resolves a sample of the new words to
  the expected icon, in Spanish and in English, as one `it.each` table rather
  than one `it` per word.
- A test asserts every concept's `tint` is a member of `ICON_AVATAR_TINTS` and
  every concept's `icon` is a member of `CATEGORY_ICON_KEYS`.
- `bun run check` green, output reported verbatim.
