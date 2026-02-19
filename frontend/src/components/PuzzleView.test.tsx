import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import authReducer from '../features/authSlice'
import gameReducer from '../features/gameSlice'
import PuzzleView from './PuzzleView'

const {
  storageMock,
  streakMock,
  puzzleEngineMock,
  achievementEngineMock,
  flushSyncMock,
} = vi.hoisted(() => ({
  storageMock: {
    getPuzzle: vi.fn(),
    savePuzzle: vi.fn(),
    getActivity: vi.fn(),
    getProgress: vi.fn(),
    saveProgress: vi.fn(),
    saveActivity: vi.fn(),
    clearProgress: vi.fn(),
    addToSyncQueue: vi.fn(),
    getYearActivities: vi.fn(),
    getRecentActivities: vi.fn(),
  },
  streakMock: {
    calculateStreak: vi.fn(),
    calculateStreakFromActivities: vi.fn(),
    isPuzzleLocked: vi.fn(),
    syncMilestonesForStreak: vi.fn(),
  },
  puzzleEngineMock: {
    generatePuzzle: vi.fn(),
    validateSolution: vi.fn(),
    calculateDifficultyAdjustmentFromPerformance: vi.fn(),
  },
  achievementEngineMock: {
    unlockEligibleAchievements: vi.fn(),
  },
  flushSyncMock: vi.fn(),
}))

vi.mock('../storage/storageManager', () => ({
  storageManager: storageMock,
}))

vi.mock('../engines/streakEngine', () => ({
  calculateStreak: (...args: unknown[]) => streakMock.calculateStreak(...args),
  calculateStreakFromActivities: (...args: unknown[]) => streakMock.calculateStreakFromActivities(...args),
  isPuzzleLocked: (...args: unknown[]) => streakMock.isPuzzleLocked(...args),
  syncMilestonesForStreak: (...args: unknown[]) => streakMock.syncMilestonesForStreak(...args),
}))

vi.mock('../engines/puzzleEngine', () => ({
  generatePuzzle: (...args: unknown[]) => puzzleEngineMock.generatePuzzle(...args),
  validateSolution: (...args: unknown[]) => puzzleEngineMock.validateSolution(...args),
  calculateDifficultyAdjustmentFromPerformance: (...args: unknown[]) =>
    puzzleEngineMock.calculateDifficultyAdjustmentFromPerformance(...args),
}))

vi.mock('../engines/achievementEngine', () => ({
  unlockEligibleAchievements: (...args: unknown[]) => achievementEngineMock.unlockEligibleAchievements(...args),
}))

vi.mock('../utils/syncManager', () => ({
  flushPendingSyncWithOptions: (...args: unknown[]) => flushSyncMock(...args),
}))

function baseState() {
  return {
    auth: {
      user: { id: 'u1', email: 'u1@test.com', authType: 'google' as const },
      isAuthenticated: true,
      isGuest: false,
      loading: false,
    },
    game: {
      currentPuzzle: null,
      userActivity: null,
      streak: null,
      heatmapData: [],
      loading: false,
      error: null,
      puzzleStarted: false,
      elapsedTime: 0,
    },
  }
}

function renderWithState(preloadedState = baseState()) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
    preloadedState,
  })
  return {
    ...render(
      <Provider store={store}>
        <PuzzleView />
      </Provider>
    ),
    store,
  }
}

describe('PuzzleView', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('userId', 'u1')
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    Object.values(storageMock).forEach((fn) => fn.mockReset())
    Object.values(streakMock).forEach((fn) => fn.mockReset())
    Object.values(puzzleEngineMock).forEach((fn) => fn.mockReset())
    Object.values(achievementEngineMock).forEach((fn) => fn.mockReset())
    flushSyncMock.mockReset()

    const today = dayjs().format('YYYY-MM-DD')
    const patternPuzzle = {
      type: 'pattern',
      difficulty: 2,
      data: { pattern: ['o', 's', 't', 'o'], missing: 4, options: ['o', 's', 't', 'x'] },
    }

    storageMock.getPuzzle.mockResolvedValue(patternPuzzle)
    storageMock.getActivity.mockResolvedValue(undefined)
    storageMock.getProgress.mockResolvedValue(undefined)
    storageMock.getYearActivities.mockResolvedValue([{ userId: 'u1', date: today, solved: true }])
    storageMock.getRecentActivities.mockResolvedValue([])
    streakMock.isPuzzleLocked.mockResolvedValue(false)
    streakMock.calculateStreak.mockResolvedValue({
      current: 1,
      longest: 2,
      lastPlayedDate: today,
      isActiveToday: true,
    })
    streakMock.calculateStreakFromActivities.mockReturnValue({
      current: 1,
      longest: 2,
      lastPlayedDate: today,
      isActiveToday: true,
    })
    streakMock.syncMilestonesForStreak.mockResolvedValue(undefined)
    storageMock.saveActivity.mockResolvedValue(undefined)
    storageMock.clearProgress.mockResolvedValue(undefined)
    storageMock.addToSyncQueue.mockResolvedValue(undefined)
    flushSyncMock.mockResolvedValue(undefined)
    puzzleEngineMock.generatePuzzle.mockReturnValue(patternPuzzle)
    puzzleEngineMock.calculateDifficultyAdjustmentFromPerformance.mockReturnValue(0)
    achievementEngineMock.unlockEligibleAchievements.mockResolvedValue([])
  })

  it('loads puzzle and allows start + hint usage', async () => {
    renderWithState()
    await waitFor(() => expect(screen.getByText('Daily Challenge')).toBeTruthy())

    fireEvent.click(screen.getByText('Start Puzzle'))
    expect(screen.getByText('Use Hint (3 left)')).toBeTruthy()

    fireEvent.click(screen.getByText('Use Hint (3 left)'))
    expect(screen.getByText('The symbols repeat in a short cycle.')).toBeTruthy()
    expect(storageMock.saveActivity).not.toHaveBeenCalled()
  })

  it('handles incorrect submission with alert', async () => {
    puzzleEngineMock.validateSolution.mockReturnValue({ valid: false, score: 0 })
    renderWithState()
    await waitFor(() => expect(screen.getByText('Start Puzzle')).toBeTruthy())

    fireEvent.click(screen.getByText('Start Puzzle'))
    fireEvent.change(screen.getByPlaceholderText('Enter answer...'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByText('Submit Answer'))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Incorrect answer. Try again!'))
  })

  it('handles valid submission and sync flow', async () => {
    puzzleEngineMock.validateSolution.mockReturnValue({ valid: true, score: 150 })
    renderWithState()
    await waitFor(() => expect(screen.getByText('Start Puzzle')).toBeTruthy())

    fireEvent.click(screen.getByText('Start Puzzle'))
    fireEvent.change(screen.getByPlaceholderText('Enter answer...'), { target: { value: 'o' } })
    fireEvent.click(screen.getByText('Submit Answer'))

    await waitFor(() => expect(storageMock.saveActivity).toHaveBeenCalled())
    expect(storageMock.addToSyncQueue).toHaveBeenCalledWith(
      'daily_score',
      expect.objectContaining({ userId: 'u1' })
    )
    expect(flushSyncMock).toHaveBeenCalled()
  })

  it('renders completed state when activity is solved', async () => {
    const today = dayjs().format('YYYY-MM-DD')
    storageMock.getActivity.mockResolvedValue({
      userId: 'u1',
      date: today,
      solved: true,
      score: 80,
      timeTaken: 5000,
      difficulty: 2,
      hintsUsed: 1,
      synced: true,
    })

    renderWithState()
    await waitFor(() => expect(screen.getByText('Puzzle Completed!')).toBeTruthy())
    expect(screen.getByText('Score:')).toBeTruthy()
  })

  it('renders locked state for unavailable past date', async () => {
    streakMock.isPuzzleLocked.mockResolvedValue(true)
    renderWithState()
    await waitFor(() => expect(screen.getByText('Locked Puzzle')).toBeTruthy())
  })

  it('renders matrix puzzle content after start', async () => {
    storageMock.getPuzzle.mockResolvedValue({
      type: 'matrix',
      difficulty: 3,
      data: { size: 3, matrix: [2, 4, 6, 8, 10, 12, 14, 16, 0], missing: 8 },
    })
    renderWithState()
    await waitFor(() => expect(screen.getByText('Start Puzzle')).toBeTruthy())

    fireEvent.click(screen.getByText('Start Puzzle'))
    expect(screen.getByText('16')).toBeTruthy()
    expect(screen.getAllByText('?').length).toBeGreaterThan(0)
  })

  it('renders deduction puzzle clues and question after start', async () => {
    storageMock.getPuzzle.mockResolvedValue({
      type: 'deduction',
      difficulty: 3,
      data: {
        clues: ['Alice has Red', 'Bob has Blue'],
        options: ['Alice', 'Bob'],
        question: 'Who has Blue?',
      },
    })
    renderWithState()
    await waitFor(() => expect(screen.getByText('Start Puzzle')).toBeTruthy())

    fireEvent.click(screen.getByText('Start Puzzle'))
    expect(screen.getByText('- Alice has Red')).toBeTruthy()
    expect(screen.getByText('Who has Blue?')).toBeTruthy()
  })

  it('renders binary puzzle rule after start', async () => {
    storageMock.getPuzzle.mockResolvedValue({
      type: 'binary',
      difficulty: 4,
      data: {
        size: 4,
        grid: [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, -1],
        rule: 'Use XOR parity of first row for missing value',
      },
    })
    renderWithState()
    await waitFor(() => expect(screen.getByText('Start Puzzle')).toBeTruthy())

    fireEvent.click(screen.getByText('Start Puzzle'))
    expect(screen.getByText('Use XOR parity of first row for missing value')).toBeTruthy()
  })

  it('shares challenge link via clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    renderWithState()
    await waitFor(() => expect(screen.getByText('Share Challenge Link')).toBeTruthy())
    fireEvent.click(screen.getByText('Share Challenge Link'))

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(window.alert).toHaveBeenCalledWith('Challenge link copied!')
  })
})
