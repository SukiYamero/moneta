import { describe, it, expect } from 'vitest'
import { CONFIG_SEMILLA, SCHEMA_VERSION } from '@/lib/schema'

describe('schema seed config', () => {
  it('tags the seed config with the current schema version', () => {
    expect(CONFIG_SEMILLA.schemaVersion).toBe(SCHEMA_VERSION)
  })
})
