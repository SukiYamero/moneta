/** Shared section-label style across the profile sheet's sections — same treatment `FilterSheet.tsx` uses locally, kept here once since every section in this sheet wants it. */
export const ProfileSectionHeading = ({ children }: { children: string }) => (
  <h3 className="mb-2.5 text-xs font-bold tracking-wide text-fg-tertiary uppercase">{children}</h3>
)
