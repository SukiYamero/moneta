import type { ProfileDb } from '@/lib/db'
import type { Repo } from '@/lib/repo'
import { createLocalRepo } from '@/lib/repo.local'

export const createDriveRepo = (database: ProfileDb): Repo => createLocalRepo(database)
