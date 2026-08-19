import type { Repo } from '@/lib/repo'
import { fakeRepo } from '@/lib/repo.fake'

// STUB(wave3): swap to the Drive-backed Repo once one exists — see
// docs/wave-2-plan.md §3.2. This is the single swap point: every screen
// reads through `getRepo()`, never importing repo.fake.ts/repo.local.ts
// directly, so that swap is a one-line change here.
export const getRepo = (): Repo => fakeRepo
