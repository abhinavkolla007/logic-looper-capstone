import { describe, expect, it } from 'vitest'
import { normalizeLeaderboardDate } from './leaderboardController'

describe('normalizeLeaderboardDate', () => {
  it('returns today when date is missing', () => {
    const d = normalizeLeaderboardDate()
    expect(typeof d).toBe('string')
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('accepts valid YYYY-MM-DD dates', () => {
    expect(normalizeLeaderboardDate('2026-02-17')).toBe('2026-02-17')
  })

  it('rejects malformed dates', () => {
    expect(normalizeLeaderboardDate('17-02-2026')).toBeNull()
  })

  it('rejects very old dates outside supported range', () => {
    expect(normalizeLeaderboardDate('2010-01-01')).toBeNull()
  })
})
