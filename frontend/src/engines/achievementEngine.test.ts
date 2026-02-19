import { describe, expect, it } from 'vitest'
import { getAchievementStatuses } from './achievementEngine'
import type { DailyActivity } from '../storage/storageManager'

function makeSolvedActivity(
  overrides: Partial<DailyActivity> = {}
): DailyActivity {
  return {
    userId: 'u1',
    date: '2026-02-19',
    solved: true,
    score: 110,
    timeTaken: 45_000,
    difficulty: 3,
    hintsUsed: 0,
    synced: false,
    ...overrides,
  }
}

describe('achievementEngine', () => {
  it('keeps achievements locked for empty history', () => {
    const statuses = getAchievementStatuses([], 0)
    const firstSolve = statuses.find((status) => status.id === 'first_solve')
    const streak7 = statuses.find((status) => status.id === 'milestone_7')

    expect(firstSolve?.unlocked).toBe(false)
    expect(firstSolve?.value).toBe(0)
    expect(streak7?.unlocked).toBe(false)
    expect(streak7?.value).toBe(0)
  })

  it('unlocks solve/skill achievements from solved activity stats', () => {
    const statuses = getAchievementStatuses([makeSolvedActivity()], 1)
    const firstSolve = statuses.find((status) => status.id === 'first_solve')
    const perfectDay = statuses.find((status) => status.id === 'perfect_day')
    const speedRunner = statuses.find((status) => status.id === 'speed_runner')
    const hintless = statuses.find((status) => status.id === 'hintless_solver')

    expect(firstSolve?.unlocked).toBe(true)
    expect(perfectDay?.unlocked).toBe(true)
    expect(speedRunner?.unlocked).toBe(true)
    expect(hintless?.unlocked).toBe(true)
  })

  it('uses streak progress for milestone achievements', () => {
    const statuses = getAchievementStatuses([makeSolvedActivity()], 30)
    const streak7 = statuses.find((status) => status.id === 'milestone_7')
    const streak30 = statuses.find((status) => status.id === 'milestone_30')
    const streak100 = statuses.find((status) => status.id === 'milestone_100')

    expect(streak7?.unlocked).toBe(true)
    expect(streak30?.unlocked).toBe(true)
    expect(streak100?.unlocked).toBe(false)
  })
})

