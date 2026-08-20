// The plain tint-name union, with no styling or component dependency —
// lives here (not in IconAvatar.tsx) so schema.ts (Categoria.color) can
// import it without depending on a component file. IconAvatar.tsx
// re-exports it so every existing `@/components/shared/IconAvatar` import
// keeps working unchanged; it stays the map from a tint name to its actual
// CSS classes (tintClasses.ts) and everything presentation-related.
export type IconAvatarTint =
  | 'emerald'
  | 'blue'
  | 'purple'
  | 'rose'
  | 'amber'
  | 'success'
  | 'danger'
  | 'info'
  | 'neutral'
