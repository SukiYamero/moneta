# scripts

Standalone guard scripts wired into `lint:units` (`package.json`), which
`bun run check` runs. Each mechanically enforces one `AGENTS.md`/`specs.md`
rule that oxlint has no Tailwind/repo-shape-aware way to check, by grepping
`src/` for the banned shape and failing with a pointer to the rule it
guards.

- `no-raw-px.sh` — bans arbitrary px lengths in a class (`AGENTS.md` § UI
  "Relative units, not fixed device sizes").
- `no-ui-imports-in-lib.sh` — bans `src/lib/` importing from
  `@/components`/`@/features` (`src/lib/` is the bottom layer).
- `no-in-flow-min-h-dvh.sh` — bans `min-h-dvh` on an in-flow root inside the
  safe-area-padded `body` (`specs.md` §10.34/§10.39/§12); the one exemption
  is a `fixed`-positioned element, which sizes against the true viewport
  directly instead of `body`'s padded content box.

Each script is line-based (`grep`, not a real parser) — the tradeoff each
one's own header comment names. Add a new one here only when oxlint/a
TypeScript-level check genuinely can't express the rule.
