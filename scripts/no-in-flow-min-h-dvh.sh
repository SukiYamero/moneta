#!/usr/bin/env sh
# Guards specs.md §10.34/§10.39/§12's min-h-dvh trap: `body` (src/styles/
# index.css) pads unconditionally by env(safe-area-inset-*), so an element
# in normal flow inside it that asks for min-h-dvh demands the FULL RAW
# viewport regardless of what that padding already spent — forcing the page
# to scroll by exactly the inset. Zero in a desktop browser or DevTools
# emulation (the inset is 0 there); non-zero on any real notch or home
# indicator. That gap is why nine instances of this shipped past every
# review and the user's own manual pass, all done on a PC. `min-h-full` is
# the fix everywhere in this codebase: it resolves against the real
# html/body/#root ancestor chain (all height: 100%, see index.css), so it
# can never demand more room than body's own padded content box has.
#
# The one legitimate use of min-h-dvh is a `fixed`-positioned element
# (src/features/lock/FullScreenPanel.tsx): `position: fixed` sizes against
# the true viewport directly, bypassing body's padded content box entirely
# (that's the mechanism, not "it's portaled" — a portal alone doesn't leave
# the padded box, fixed positioning does), so min-h-dvh there is correct,
# not the bug. This guard's whole job is telling the two apart: flag
# min-h-dvh only where the same line doesn't also carry `fixed`.
#
# Line-based grep, like this file's siblings (no-raw-px.sh,
# no-ui-imports-in-lib.sh) — cannot parse JSX, so it assumes (true
# everywhere in this codebase today) that a root's className/cn() string is
# written on one line together with any `fixed` it carries. A prose comment
# referencing the token in backticks (`` `min-h-dvh` ``, the house style for
# naming a code token in a comment — see WelcomeScreen.tsx/
# PreContentSkeleton.tsx) is exempted so this doesn't fire on its own
# explanation; a bare, unquoted mention would still fire, which is the
# honest tradeoff of a textual check over a real parser.
hits=$(grep -rnE '\bmin-h-dvh\b' src --include='*.ts' --include='*.tsx' \
  | grep -v '\.test\.' \
  | grep -vF '`min-h-dvh`' \
  | grep -vE '\bfixed\b' || true)
if [ -n "$hits" ]; then
  echo "✖ min-h-dvh on an in-flow root overflows the page by exactly the safe-area inset on any real notched/home-indicator device (invisible in a desktop browser or DevTools emulation, where the inset is 0)."
  echo "  Use min-h-full instead — it resolves against the real html/body/#root chain and can never demand more room than body's own padded content box has. See specs.md §10.34/§10.39/§12."
  echo "  Exempt only for a genuinely fixed-positioned element (e.g. FullScreenPanel.tsx) — position: fixed sizes against the true viewport directly, so add 'fixed' to the same class string if that's really the case here."
  echo "$hits"
  exit 1
fi
