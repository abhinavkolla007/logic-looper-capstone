import { describe, expect, it } from 'vitest'
import { calculateStreakFromActivities } from './streakEngine'
import type { DailyActivity } from '../storage/storageManager'

function mk(date: string, solved = true): DailyActivity {
  return {
    userId: 'u1',
    date,
    solved,
    score: 100,
    timeTaken: 10000,
    difficulty: 2,
    hintsUsed: 0,
    synced: false,
  }
}

describe('calculateStreakFromActivities', () => {
  it('computes current and longest streak', () => {
    const activities = [
      mk('2026-02-14'),
      mk('2026-02-15'),
      mk('2026-02-16'),
      mk('2026-02-10'),
    ]

    const streak = calculateStreakFromActivities(activities, '2026-02-16')
    expect(streak.current).toBe(3)
    expect(streak.longest).toBe(3)
    expect(streak.isActiveToday).toBe(true)
  })

  it('resets current streak when today unsolved', () => {
    const activities = [mk('2026-02-14'), mk('2026-02-15')]
    const streak = calculateStreakFromActivities(activities, '2026-02-16')
    expect(streak.current).toBe(0)
    expect(streak.longest).toBe(2)
  })
})
