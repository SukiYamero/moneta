import { describe, expect, it } from 'vitest'
import { getInitials } from '@/lib/initials'

describe('getInitials', () => {
  it('takes the first letter of the first and last name', () => {
    expect(getInitials('Alex Rivera')).toBe('AR')
  })

  it('handles a single name', () => {
    expect(getInitials('Alex')).toBe('A')
  })

  it('ignores extra whitespace', () => {
    expect(getInitials('  Alex   Rivera  ')).toBe('AR')
  })

  it('returns an empty string for an empty name', () => {
    expect(getInitials('')).toBe('')
  })
})
