import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppDispatch } from '../features/store'
import { initializeGameForUser, registerOnlineSyncHandlers } from './appRuntime'

const preloadPuzzleWindowMock = vi.fn()
const getPuzzleMock = vi.fn()
const getRecentActivitiesMock = vi.fn()
const getYearActivitiesMock = vi.fn()
const getTodayActivityMock = vi.fn()
const initMock = vi.fn()

const ensureTodayActivityMock = vi.fn()
const calculateStreakFromActivitiesMock = vi.fn()
const calculateDifficultyAdjustmentFromPerformanceMock = vi.fn()
const generatePuzzleMock = vi.fn()
const flushPendingSyncWithOptionsMock = vi.fn()

vi.mock('../storage/storageManager', () => ({
  storageManager: {
    init: (...args: unknown[]) => initMock(...args),
    preloadPuzzleWindow: (...args: unknown[]) => preloadPuzzleWindowMock(...args),
    getPuzzle: (...args: unknown[]) => getPuzzleMock(...args),
    getRecentActivities: (...args: unknown[]) => getRecentActivitiesMock(...args),
    getYearActivities: (...args: unknown[]) => getYearActivitiesMock(...args),
    getTodayActivity: (...args: unknown[]) => getTodayActivityMock(...args),
  },
}))

vi.mock('../engines/streakEngine', () => ({
  ensureTodayActivity: (...args: unknown[]) => ensureTodayActivityMock(...args),
  calculateStreakFromActivities: (...args: unknown[]) => calculateStreakFromActivitiesMock(...args),
}))

vi.mock('../engines/puzzleEngine', () => ({
  calculateDifficultyAdjustmentFromPerformance: (...args: unknown[]) =>
    calculateDifficultyAdjustmentFromPerformanceMock(...args),
  generatePuzzle: (...args: unknown[]) => generatePuzzleMock(...args),
}))

vi.mock('./syncManager', () => ({
  flushPendingSyncWithOptions: (...args: unknown[]) => flushPendingSyncWithOptionsMock(...args),
}))

describe('appRuntime', () => {
  beforeEach(() => {
    initMock.mockReset().mockResolvedValue(undefined)
    preloadPuzzleWindowMock.mockReset().mockResolvedValue(undefined)
    getPuzzleMock.mockReset().mockResolvedValue({ type: 'pattern', difficulty: 2, data: {} })
    getRecentActivitiesMock.mockReset().mockResolvedValue([])
    getYearActivitiesMock.mockReset().mockResolvedValue([])
    getTodayActivityMock.mockReset().mockResolvedValue(undefined)
    ensureTodayActivityMock.mockReset().mockResolvedValue(undefined)
    calculateStreakFromActivitiesMock.mockReset().mockReturnValue({
      current: 0,
      longest: 0,
      lastPlayedDate: null,
      isActiveToday: false,
    })
    calculateDifficultyAdjustmentFromPerformanceMock.mockReset().mockReturnValue(0)
    generatePuzzleMock.mockReset().mockReturnValue({ type: 'pattern', difficulty: 2, data: {} })
    flushPendingSyncWithOptionsMock.mockReset().mockResolvedValue(undefined)
  })

  it('initializes puzzle/streak state and flushes sync', async () => {
    const dispatch = vi.fn() as unknown as AppDispatch
    await initializeGameForUser(dispatch, 'u1')

    expect(initMock).toHaveBeenCalled()
    expect(getRecentActivitiesMock).toHaveBeenCalledWith('u1', 14)
    expect(getYearActivitiesMock).toHaveBeenCalledWith('u1')
    expect(ensureTodayActivityMock).toHaveBeenCalled()
    expect(flushPendingSyncWithOptionsMock).toHaveBeenCalledWith('u1', { force: true, batchSize: 5 })
    expect(dispatch).toHaveBeenCalled()
  })

  it('registers online/sync listeners and cleans them up', () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener')
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')

    const swAdd = vi.fn()
    const swRemove = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { addEventListener: swAdd, removeEventListener: swRemove },
    })

    const cleanup = registerOnlineSyncHandlers('u1')
    expect(addWindowListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(swAdd).toHaveBeenCalledWith('message', expect.any(Function))

    cleanup()
    expect(removeWindowListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(swRemove).toHaveBeenCalledWith('message', expect.any(Function))
  })
})
