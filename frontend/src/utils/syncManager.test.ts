import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPendingSync, flushPendingSyncWithOptions } from './syncManager'
import { storageManager } from '../storage/storageManager'
import { syncAPI } from './api'

describe('flushPendingSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  it('does nothing when auth token is missing', async () => {
    const queueSpy = vi.spyOn(storageManager, 'getSyncQueue')
    await flushPendingSync('u1')
    expect(queueSpy).not.toHaveBeenCalled()
  })

  it('syncs daily scores and achievements for matching user', async () => {
    localStorage.setItem('authToken', 'token')

    vi.spyOn(storageManager, 'getSyncQueue').mockResolvedValue([
      {
        timestamp: 1,
        action: 'daily_score',
        data: { userId: 'u1', date: '2026-02-16', score: 99, timeTaken: 32000 },
        synced: false,
      },
      {
        timestamp: 2,
        action: 'daily_score',
        data: { userId: 'u2', date: '2026-02-16', score: 88, timeTaken: 40000 },
        synced: false,
      },
    ])
    const markSynced = vi.spyOn(storageManager, 'markSynced').mockResolvedValue()
    const markActivitySynced = vi.spyOn(storageManager, 'markActivitySynced').mockResolvedValue()

    vi.spyOn(storageManager, 'getUnsyncedAchievements').mockResolvedValue([
      {
        id: 'u1:milestone_7',
        userId: 'u1',
        achievementId: 'milestone_7',
        name: '7-Day Streak',
        unlockedAt: '2026-02-16T00:00:00.000Z',
        synced: false,
      },
    ])
    const markAchievementSynced = vi.spyOn(storageManager, 'markAchievementSynced').mockResolvedValue()

    const scoreSync = vi.spyOn(syncAPI, 'syncDailyScores').mockResolvedValue({ data: {} } as never)
    const achievementSync = vi.spyOn(syncAPI, 'syncAchievements').mockResolvedValue({ data: {} } as never)

    await flushPendingSyncWithOptions('u1', { force: true, batchSize: 5 })

    expect(scoreSync).toHaveBeenCalledWith([
      expect.objectContaining({
        date: '2026-02-16',
        score: 99,
        timeTaken: 32000,
        proof: expect.any(String),
      }),
    ])
    expect(markSynced).toHaveBeenCalledWith(1)
    expect(markActivitySynced).toHaveBeenCalledWith('u1', '2026-02-16')
    expect(markSynced).not.toHaveBeenCalledWith(2)

    expect(achievementSync).toHaveBeenCalledWith([
      { id: 'milestone_7', name: '7-Day Streak', unlockedAt: '2026-02-16T00:00:00.000Z' },
    ])
    expect(markAchievementSynced).toHaveBeenCalledWith('u1', 'milestone_7')
  })

  it('does not sync daily scores when below batch threshold', async () => {
    localStorage.setItem('authToken', 'token')
    vi.spyOn(storageManager, 'getSyncQueue').mockResolvedValue([
      {
        timestamp: 11,
        action: 'daily_score',
        data: { userId: 'u1', date: '2026-02-16', score: 99, timeTaken: 32000 },
        synced: false,
      },
    ])
    vi.spyOn(storageManager, 'getUnsyncedAchievements').mockResolvedValue([])
    const scoreSync = vi.spyOn(syncAPI, 'syncDailyScores').mockResolvedValue({ data: {} } as never)

    await flushPendingSync('u1')

    expect(scoreSync).not.toHaveBeenCalled()
  })
})
