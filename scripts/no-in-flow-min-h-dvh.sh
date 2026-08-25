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
# explanation.
#
# Two confirmed limits (review-aj-g, reproduced against constructed test
# files, not just reasoned about — specs.md §10.39.1):
# - A `cn()` call that splits `fixed` and `min-h-dvh` across separate
#   string arguments/lines is a FALSE POSITIVE, not a miss: the guard fails
#   a genuinely safe `position: fixed` element (the opposite of what an
#   earlier draft of this comment claimed — "would slip past it" was
#   backwards). Not worth a real parser for a case with zero occurrences in
#   this codebase today (FullScreenPanel.tsx, the one exemption, already
#   writes both tokens in a single string); if it ever fires on a real
#   `fixed` element, put `fixed` and `min-h-dvh` in the same string, or use
#   `min-h-full` instead (safe whenever the element's containing block is
#   itself already viewport-sized, e.g. nested in a `fixed inset-0` root).
# - `\bfixed\b` alone would treat Tailwind's real `bg-fixed`
#   (`background-attachment: fixed`, unrelated to `position`) as the
#   exemption, since a hyphen counts as a word boundary — a genuine false
#   NEGATIVE for an in-flow root that happens to also set a fixed
#   background. Guarded against below by requiring the token not be
#   preceded by `-`.
# - Not guarded against, and not mechanically detectable by a grep: a CSS
#   `transform` on an ancestor makes that ancestor the containing block for
#   a `position: fixed` descendant, which can undersize it exactly like the
#   original bug — but relative to the transformed box, not the viewport.
#   Checked (2026-08-25): nothing in this codebase nests a `fixed` element
#   inside a transformed one today — the app's only `fixed`+`min-h-dvh`
#   element (FullScreenPanel.tsx) and every other overlay
#   (BottomSheet/CenterModal) portal straight to `document.body`, which is
#   never transformed, sidestepping the question entirely. Re-check this if
#   that ever changes.
hits=$(grep -rnE '\bmin-h-dvh\b' src --include='*.ts' --include='*.tsx' \
  | grep -v '\.test\.' \
  | grep -vF '`min-h-dvh`' \
  | grep -vE '(^|[^-])fixed\b' || true)
if [ -n "$hits" ]; then
  echo "✖ min-h-dvh on an in-flow root overflows the page by exactly the safe-area inset on any real notched/home-indicator device (invisible in a desktop browser or DevTools emulation, where the inset is 0)."
  echo "  Use min-h-full instead — it resolves against the real html/body/#root chain and can never demand more room than body's own padded content box has. See specs.md §10.34/§10.39/§12."
  echo "  Exempt only for a genuinely fixed-positioned element (e.g. FullScreenPanel.tsx) — position: fixed sizes against the true viewport directly, so add 'fixed' to the same class string if that's really the case here."
  echo "$hits"
  exit 1
fi
