// The canonical tint list and its union, with no styling or component
// dependency — the bottom of the layer graph, so both `schema.ts`
// (`Categoria.color`) and `sync/validate.ts` (checking an untrusted value
// from a hand-edited Drive file) can reach it without depending on the UI.
// `components/shared/IconAvatar.tsx` re-exports the type so every existing
// `@/components/shared/IconAvatar` import keeps working unchanged.
//
// The runtime array is the source and the type is derived from it, not the
// other way round: `TINT_CLASSES` is typed `Record<IconAvatarTint, …>`, so
// adding a tint here without giving it classes is a compile error, and
// giving classes to a tint that isn't here is one too. The exhaustiveness
// guarantee that used to run one way now runs both.
export const ICON_AVATAR_TINTS = [
  'emerald',
  'blue',
  'purple',
  'rose',
  'amber',
  'success',
  'danger',
  'info',
  'neutral',
] as const

export type IconAvatarTint = (typeof ICON_AVATAR_TINTS)[number]
