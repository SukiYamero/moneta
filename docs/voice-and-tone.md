# Voice and tone — the standard

Ground truth is the copy in `src/lib/i18n/locales/*.json`; this doc settles
arguments about how to phrase a new string. If a rule here and a shipped
string disagree, fix whichever one is wrong and update this doc in the same
change.

## 1. Lead with the user's reason, not the app's demand

A string that states what the app needs reads as the app asking the user for
something. A string that states what the user gets reads as the app looking
out for them — same request, same outcome, but the second one makes the user
want to comply instead of feeling asked to comply.

**Before:** "Necesitamos los dos permisos de Drive para sincronizar. Intenta
de nuevo y marca ambos."
**After:** "Para que tus datos queden guardados y sincronizados sin
problemas, necesitamos los dos permisos de Drive. Inténtalo de nuevo y acepta
ambos."

The difference is structural, not decorative: open with "para que
[benefit to the user]", only then name what the app needs, and close with the
action. Never open with "necesitamos"/"we need" — that's the app's want
leading, not the user's.

## 2. Reassure wherever money or data is at stake

This is a finance app; a failure message about sync, Drive, or data is the
moment a user is most likely to worry they lost something. Say plainly that
nothing is lost before asking them to do anything ("tus datos queden
guardados", "lo que registraste está guardado en este dispositivo") rather
than a bare technical failure statement.

## 3. Translate the intent, not the sentence

`es.json` is the source of truth for the reason-first structure (§1), but
`en.json`/`pt-BR.json` are never a literal word-for-word rendering of it — they
restate the same structure in whatever is actually idiomatic for that
language. A calque that's merely grammatical but reads stiff ("So that your
data stays saved…") loses to the phrasing a native speaker would actually
write ("To keep your data saved…") even though the second is further from the
Spanish wording. Check every new string against how that language's own UX
copy is normally written, not against the Spanish original's syntax.

## 4. Informal, direct address — whatever form that takes per language

Every locale addresses the user informally, but "informal" means something
different in each one, so match the language's own ceiling, not Spanish's:

- `es.json` is tú ("intenta", "revisa"); `es-AR.json` is voseo ("intentá",
  "revisá") — never copy the tú form into `es-AR.json` verbatim.
- `pt-BR.json` uses "você", already the standard informal register in
  Brazilian Portuguese — there's no lower register to reach for.
- `en.json` has no grammatical formality distinction in "you" at all — the
  informality has to come from word choice and sentence construction (§3),
  not from a pronoun choice, since English doesn't have one to make.

## 5. No jargon, no filler warmth

Say "permisos de Drive", never "scopes" or "OAuth". Say "sincronizar", never
"hacer sync". Warmth comes from the reason-first structure (§1) and
reassurance (§2), not from exclamation marks, emoji, or diminutives — none of
those are used anywhere in this app's copy today, and adding them here would
be inconsistent with the rest of the UI.

## 6. Stay short

One or two sentences. A reason-first opener that runs three clauses long
defeats the point — the user should get the "why" and the action in one
read, not parse a paragraph to find the button they need to press.
