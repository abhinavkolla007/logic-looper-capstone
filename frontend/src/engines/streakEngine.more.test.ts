import { beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import {
  calculateStreak,
  checkStreakBreak,
  completeActivity,
  ensureTodayActivity,
  isPuzzleLocked,
  syncMilestonesForStreak,
} from './streakEngine'

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    getYearActivities: vi.fn(),
    getActivity: vi.fn(),
    saveActivity: vi.fn(),
    getAchievements: vi.fn(),
    saveAchievement: vi.fn(),
  },
}))

vi.mock('../storage/storageManager', () => ({
  storageManager: storageMock,
}))

describe('streakEngine extended', () => {
  beforeEach(() => {
    Object.values(storageMock).forEach((fn) => fn.mockReset())
  })

  it('calculates streak via storage list', async () => {
    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    storageMock.getYearActivities.mockResolvedValue([
      { userId: 'u1', date: yesterday, solved: true },
      { userId: 'u1', date: today, solved: true },
    ])

    const streak = await calculateStreak('u1')
    expect(streak.current).toBe(2)
    expect(streak.longest).toBe(2)
  })

  it('detects streak break', async () => {
    storageMock.getYearActivities.mockResolvedValue([
      { userId: 'u1', date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), solved: true },
    ])
    expect(await checkStreakBreak('u1')).toBe(true)
  })

  it('ensures today activity when missing', async () => {
    storageMock.getActivity.mockResolvedValue(undefined)
    await ensureTodayActivity('u1', 3)
    expect(storageMock.saveActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        solved: false,
        difficulty: 3,
      })
    )
  })

  it('locks future and incomplete past puzzles', async () => {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
    expect(await isPuzzleLocked('u1', tomorrow)).toBe(true)

    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    storageMock.getActivity.mockResolvedValue({ solved: false })
    expect(await isPuzzleLocked('u1', yesterday)).toBe(true)

    storageMock.getActivity.mockResolvedValue({ solved: true })
    expect(await isPuzzleLocked('u1', yesterday)).toBe(false)
  })

  it('completes activity and creates milestone achievements', async () => {
    const today = dayjs().format('YYYY-MM-DD')
    storageMock.getYearActivities.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        userId: 'u1',
        date: dayjs(today).subtract(i, 'day').format('YYYY-MM-DD'),
        solved: true,
      }))
    )
    storageMock.getAchievements.mockResolvedValue([])

    await completeActivity('u1', today, 120, 10, 2, 1)
    expect(storageMock.saveActivity).toHaveBeenCalledWith(expect.objectContaining({ solved: true, score: 120 }))
    expect(storageMock.saveAchievement).toHaveBeenCalledWith('milestone_7', '7-Day Streak')
  })

  it('syncs milestones for exact milestone only', async () => {
    storageMock.getAchievements.mockResolvedValue([])
    await syncMilestonesForStreak('u1', 30)
    expect(storageMock.saveAchievement).toHaveBeenCalledWith('milestone_30', '30-Day Streak')
  })
})
