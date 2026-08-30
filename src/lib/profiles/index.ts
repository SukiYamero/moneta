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
export {
  adoptGuestMovements,
  countUnadoptedGuestMovements,
  finishConsentedAdoption,
  resumePendingAdoption,
  type AdoptionResult,
} from '@/lib/profiles/adoption'
