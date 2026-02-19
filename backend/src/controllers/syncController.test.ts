import { describe, expect, it } from 'vitest'
import {
  buildDailyEntryProof,
  isIncomingDailyEntryBetter,
  validateAchievementEntry,
  validateDailyEntry,
} from './syncController'

describe('validateDailyEntry', () => {
  it('accepts valid sync payload', () => {
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 70,
        timeTaken: 45000,
      })
    ).toBe(true)
  })

  it('rejects future dates', () => {
    expect(
      validateDailyEntry({
        date: '2099-01-01',
        score: 100,
        timeTaken: 45000,
      })
    ).toBe(false)
  })

  it('rejects near-future date beyond server day window', () => {
    const twoDaysAhead = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(
      validateDailyEntry({
        date: twoDaysAhead,
        score: 90,
        timeTaken: 45000,
      })
    ).toBe(false)
  })

  it('rejects unrealistic solve times', () => {
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 100,
        timeTaken: 200,
      })
    ).toBe(false)
  })

  it('rejects impossible high score for long solve time', () => {
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 110,
        timeTaken: 120000,
      })
    ).toBe(false)
  })

  it('rejects non-integer score/time fields', () => {
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 90.5,
        timeTaken: 45000,
      })
    ).toBe(false)
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 90,
        timeTaken: 45000.12,
      })
    ).toBe(false)
  })

  it('rejects unrealistically slow runs with elite scores', () => {
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 100,
        timeTaken: 300001,
      })
    ).toBe(false)
    expect(
      validateDailyEntry({
        date: '2026-02-16',
        score: 110,
        timeTaken: 91000,
      })
    ).toBe(false)
  })

  it('produces stable proof hash for a given token and payload', () => {
    const entry = { date: '2026-02-16', score: 70, timeTaken: 45000 }
    const token = 'example-auth-token'
    const proofA = buildDailyEntryProof(entry, token)
    const proofB = buildDailyEntryProof(entry, token)
    expect(proofA).toBe(proofB)
    expect(proofA.length).toBeGreaterThan(20)
  })
})

describe('validateAchievementEntry', () => {
  it('accepts valid achievement payload', () => {
    expect(
      validateAchievementEntry({
        id: 'milestone_7',
        name: '7-Day Streak',
        unlockedAt: '2026-02-16T10:00:00.000Z',
      })
    ).toBe(true)
  })

  it('rejects invalid unlockedAt', () => {
    expect(
      validateAchievementEntry({
        id: 'milestone_7',
        name: '7-Day Streak',
        unlockedAt: 'invalid-date',
      })
    ).toBe(false)
  })

  it('rejects future unlockedAt timestamp', () => {
    expect(
      validateAchievementEntry({
        id: 'milestone_7',
        name: '7-Day Streak',
        unlockedAt: '2099-01-01T00:00:00.000Z',
      })
    ).toBe(false)
  })

  it('rejects achievement id with invalid characters', () => {
    expect(
      validateAchievementEntry({
        id: 'milestone 7',
        name: '7-Day Streak',
        unlockedAt: '2026-02-16T10:00:00.000Z',
      })
    ).toBe(false)
  })
})

describe('isIncomingDailyEntryBetter', () => {
  it('accepts when no existing score is present', () => {
    expect(isIncomingDailyEntryBetter(null, { score: 80, timeTaken: 60000 })).toBe(true)
  })

  it('accepts higher score', () => {
    expect(isIncomingDailyEntryBetter({ score: 70, timeTaken: 50000 }, { score: 75, timeTaken: 55000 })).toBe(true)
  })

  it('rejects lower score', () => {
    expect(isIncomingDailyEntryBetter({ score: 90, timeTaken: 50000 }, { score: 80, timeTaken: 20000 })).toBe(false)
  })

  it('accepts same score with faster time', () => {
    expect(isIncomingDailyEntryBetter({ score: 90, timeTaken: 50000 }, { score: 90, timeTaken: 45000 })).toBe(true)
  })

  it('rejects same score with same or slower time', () => {
    expect(isIncomingDailyEntryBetter({ score: 90, timeTaken: 50000 }, { score: 90, timeTaken: 50000 })).toBe(false)
    expect(isIncomingDailyEntryBetter({ score: 90, timeTaken: 50000 }, { score: 90, timeTaken: 55000 })).toBe(false)
  })
})
