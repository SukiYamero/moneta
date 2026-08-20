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
  getProfile,
  listProfiles,
  makeProfileDatabaseName,
  recordSuccessfulPull,
  recordSuccessfulPush,
  registerProfile,
  resolveGoogleProfile,
  setDriveFolderId,
  touchLastUsed,
} from '@/lib/profiles/profileRegistry'
export { __clearProfileDatabaseCacheForTests, getProfileDatabase } from '@/lib/profiles/profileDb'
