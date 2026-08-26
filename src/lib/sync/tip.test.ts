import { afterEach, describe, expect, it, vi } from 'vitest'
import { __clearKnownTipsForTests, getKnownTip, recordKnownTip } from '@/lib/sync/tip'

afterEach(async () => {
  await __clearKnownTipsForTests()
})

describe('recordKnownTip / getKnownTip', () => {
  it('returns null for an entity with no recorded tip', async () => {
    await expect(getKnownTip('movimiento', 'm1')).resolves.toBeNull()
  })

  it('records and reads back a tip, scoped by entity + entityId', async () => {
    await recordKnownTip('movimiento', 'm1', '000000005-0000-devicea')
    await expect(getKnownTip('movimiento', 'm1')).resolves.toBe('000000005-0000-devicea')
    await expect(getKnownTip('movimiento', 'm2')).resolves.toBeNull()
    await expect(getKnownTip('config', 'm1')).resolves.toBeNull()
  })

  it('never moves a tip backward', async () => {
    await recordKnownTip('movimiento', 'm1', '000000005-0000-devicea')
    await recordKnownTip('movimiento', 'm1', '000000001-0000-devicea')

    await expect(getKnownTip('movimiento', 'm1')).resolves.toBe('000000005-0000-devicea')
  })

  it('advances a tip forward', async () => {
    await recordKnownTip('movimiento', 'm1', '000000001-0000-devicea')
    await recordKnownTip('movimiento', 'm1', '000000005-0000-devicea')

    await expect(getKnownTip('movimiento', 'm1')).resolves.toBe('000000005-0000-devicea')
  })

  it('never throws on a storage failure — logs and degrades to unknown/no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deviceDb } = await import('@/lib/deviceStore')
    const getSpy = vi.spyOn(deviceDb.syncTips, 'get').mockRejectedValue(new Error('IDB blocked'))

    await expect(getKnownTip('movimiento', 'm1')).resolves.toBeNull()
    expect(warn).toHaveBeenCalled()

    getSpy.mockRestore()

    const putSpy = vi.spyOn(deviceDb.syncTips, 'put').mockRejectedValue(new Error('IDB blocked'))
    await expect(
      recordKnownTip('movimiento', 'm1', '000000001-0000-devicea'),
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)

    putSpy.mockRestore()
    warn.mockRestore()
  })
})
