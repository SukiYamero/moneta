#!/usr/bin/env sh
# Guards AGENTS.md § UI "Relative units, not fixed device sizes".
# oxlint has no Tailwind-aware rule, so this greps for arbitrary px lengths
# (h-[5px], px-[22px]...). Relative arbitrary values (dvh, rem, %) and
# non-length ones (transition-[left], gradients, data-[...]) are untouched.
hits=$(grep -rnE '\[[0-9]+(\.[0-9]+)?px\]' src --include='*.ts' --include='*.tsx' || true)
if [ -n "$hits" ]; then
  echo "✖ Raw px values are banned — use the rem-based spacing scale or a token."
  echo "  See AGENTS.md § UI and docs/ui/design-tokens.md."
  echo "$hits"
  exit 1
fi
