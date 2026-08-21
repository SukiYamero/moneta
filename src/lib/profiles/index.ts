export type {
  ProfileKind,
  ProfileRecord,
  RegisterProfileInput,
  ResolveGoogleProfileInput,
} from '@/lib/profiles/profileRegistry'
export {
  __clearRegistryForTests,
  DEFAULT_PROFILE_DATABASE_NAME,
  DEFAULT_PROFILE_ID,
  getActiveProfile,
  getActiveProfileId,
  getProfile,
  listProfiles,
  makeProfileDatabaseName,
  recordSuccessfulPull,
  recordSuccessfulPush,
  registerProfile,
  removeProfile,
  resolveGoogleProfile,
  setActiveProfileId,
  setDriveFolderId,
  touchLastUsed,
} from '@/lib/profiles/profileRegistry'
export { __clearProfileDatabaseCacheForTests, getProfileDatabase } from '@/lib/profiles/profileDb'
export { ensureOwnerMarker, readOwnerMarker } from '@/lib/profiles/profileOwner'
// `switchToProfile` (profiles/switchProfile.ts) is deliberately NOT
// re-exported here: it imports `authStore.ts`, which itself imports this
// barrel (`resolveGoogleProfile`/`setActiveProfileId`) — re-exporting it
// from here would close that into a real circular import. Callers import
// it directly from `@/lib/profiles/switchProfile`.
