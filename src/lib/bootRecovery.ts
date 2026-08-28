import { getActiveProfileBinding } from '@/lib/repoProvider'
import { DEFAULT_PROFILE_DATABASE_NAME } from '@/lib/profiles/profileRegistry'

const deleteIndexedDbDatabase = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.addEventListener('success', () => resolve())
    request.addEventListener('error', () =>
      reject(request.error ?? new Error(`indexedDB.deleteDatabase("${name}") failed`)),
    )
    request.addEventListener('blocked', () =>
      console.warn(`indexedDB.deleteDatabase("${name}") is blocked by another open connection`),
    )
  })

export const clearLocalDatabaseAndReload = async (): Promise<void> => {
  const binding = getActiveProfileBinding()
  const databaseName = binding?.database.name ?? DEFAULT_PROFILE_DATABASE_NAME
  try {
    binding?.database.close()
    await deleteIndexedDbDatabase(databaseName)
  } catch (e) {
    console.error(`bootRecovery: failed to delete local database "${databaseName}"`, e)
  }
  window.location.reload()
}
