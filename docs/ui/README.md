# docs/ui

Reference docs for implementing screens from the Claude Design project
(`Moneta.dc.html`), kept separate from the actual component code.

- `design-tokens.md` — rationale for the design tokens in
  `src/styles/index.css` (the tokens themselves live in code, not here);
  also carries the rule for when a design reference disagrees with existing
  code.
- `design-export-reference.md` — extraction from the `Moneta-standalone.html`
  design export covering the light theme token mapping, the loading/boot
  screens, the returning-user screen, and the PIN screens. Superseded: every
  screen it describes is built and its open questions are answered in
  `design-tokens.md`.
- `design-export-add-sheet.md` — the Add-sheet artboard, extracted verbatim.
  Its top divergence table predates the fixes that made the sheet match it
  (`docs/ajustes.md`) and is stale except the gear button, still open
  (`docs/pendientes-usuario.md` item 12); §2/§3's verbatim artboard stays a
  live reference, and most of the export's other artboards (listed at its
  end) haven't been diffed against `specs.md` at all yet.
