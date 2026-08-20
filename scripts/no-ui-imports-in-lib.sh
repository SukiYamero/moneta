#!/usr/bin/env sh
# Guards the layer direction AGENTS.md and ARCHITECTURE.md assume: `src/lib/`
# is the bottom of the graph — the data contract, the stores, the Drive/auth/
# sync logic — and the UI sits above it. A `src/lib/` module importing
# `@/components/**` or `@/features/**` inverts that.
#
# This exists because the inversion appeared twice in Wave 4 alone, hours
# apart, from two different tracks that were each locally reasonable:
# `schema.ts` reached for a curated icon-key union that had been placed in a
# feature folder, and `sync/validate.ts` reached for the runtime tint list to
# check an untrusted Drive value. Both were caught by review; the second
# proved that catching instances was not going to stop it. The fix in both
# cases was the same — the shared *data* moves down to `src/lib/`, never the
# importer up.
#
# Tests are exempt: a test may legitimately import a component to render it.
hits=$(grep -rnE "from '@/(components|features)/" src/lib \
  --include='*.ts' --include='*.tsx' \
  | grep -v '\.test\.' || true)
if [ -n "$hits" ]; then
  echo "✖ src/lib/ must not import from @/components or @/features."
  echo "  src/lib/ is the bottom layer; move the shared value down into"
  echo "  src/lib/ instead of importing upward. See specs.md §11, 2026-08-20."
  echo "$hits"
  exit 1
fi
