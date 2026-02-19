import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import authReducer from './features/authSlice'
import gameReducer from './features/gameSlice'

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}))

vi.mock('./components/PuzzleView', () => ({
  default: () => <div>Puzzle View Mock</div>,
}))
vi.mock('./components/HeatmapView', () => ({
  default: () => <div>Heatmap View Mock</div>,
}))
vi.mock('./components/StreakBar', () => ({
  default: () => <div>Streak Bar Mock</div>,
}))
vi.mock('./components/LeaderboardView', () => ({
  default: () => <div>Leaderboard View Mock</div>,
}))
vi.mock('./components/AchievementsView', () => ({
  default: () => <div>Achievements View Mock</div>,
}))
vi.mock('./components/AuthScreen', () => ({
  default: () => <div>Auth Screen Mock</div>,
}))

vi.mock('./storage/storageManager', () => ({
  storageManager: {
    init: vi.fn().mockResolvedValue(undefined),
    preloadPuzzleWindow: vi.fn().mockResolvedValue(undefined),
    getPuzzle: vi.fn().mockResolvedValue({ type: 'pattern', difficulty: 2, data: {} }),
    getYearActivities: vi.fn().mockResolvedValue([]),
    getRecentActivities: vi.fn().mockResolvedValue([]),
    getTodayActivity: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('./engines/streakEngine', () => ({
  calculateStreak: vi.fn().mockResolvedValue({ current: 0, longest: 0, lastPlayedDate: null, isActiveToday: false }),
  calculateStreakFromActivities: vi.fn(() => ({ current: 0, longest: 0, lastPlayedDate: null, isActiveToday: false })),
  ensureTodayActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./engines/puzzleEngine', () => ({
  generatePuzzle: vi.fn(() => ({ type: 'pattern', difficulty: 2, data: {} })),
  calculateDifficultyAdjustmentFromPerformance: vi.fn(() => 0),
}))

vi.mock('./utils/api', () => ({
  authAPI: {
    verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
  },
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

vi.mock('./utils/syncManager', () => ({
  flushPendingSyncWithOptions: vi.fn().mockResolvedValue(undefined),
}))

function renderApp(preloadedState: object) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
    preloadedState,
  })
  return render(
    <Provider store={store}>
      <App />
    </Provider>
  )
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    verifyTokenMock.mockReset()
    verifyTokenMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'u1@test.com', authType: 'google' } } })
  })

  it('renders auth screen while logged out', async () => {
    renderApp({
      auth: { user: null, isAuthenticated: false, isGuest: false, loading: false },
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
    })

    expect(await screen.findByText('Auth Screen Mock')).toBeTruthy()
  })

  it('renders loading state while token verification is pending', () => {
    localStorage.setItem('authToken', 'pending-token')
    verifyTokenMock.mockImplementationOnce(
      () =>
        new Promise(() => {
          // keep pending to assert loading UI
        })
    )

    renderApp({
      auth: { user: null, isAuthenticated: false, isGuest: false, loading: false },
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
    })

    expect(screen.getByText('Loading Logic Looper...')).toBeTruthy()
  })

  it('renders main app while authenticated', async () => {
    renderApp({
      auth: {
        user: { id: 'u1', email: 'u1@test.com', authType: 'google' },
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
    })

    expect(screen.getByText('Logic Looper')).toBeTruthy()
    expect(await screen.findByText('Puzzle View Mock')).toBeTruthy()
    expect(await screen.findByText('Heatmap View Mock')).toBeTruthy()
    expect(await screen.findByText('Streak Bar Mock')).toBeTruthy()
    expect(await screen.findByText('Leaderboard View Mock')).toBeTruthy()
    expect(await screen.findByText('Achievements View Mock')).toBeTruthy()
  })

  it('falls back to auth screen and clears stale token when verify fails', async () => {
    verifyTokenMock.mockRejectedValueOnce(new Error('expired'))
    localStorage.setItem('authToken', 'stale-token')

    renderApp({
      auth: { user: null, isAuthenticated: false, isGuest: false, loading: false },
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
    })

    await waitFor(() => expect(screen.getByText('Auth Screen Mock')).toBeTruthy())
    expect(localStorage.getItem('authToken')).toBeNull()
  })

  it('restores guest session when guestId exists and token verify fails', async () => {
    verifyTokenMock.mockRejectedValueOnce(new Error('expired'))
    localStorage.setItem('authToken', 'stale-token')
    localStorage.setItem('guestId', 'guest-123')

    renderApp({
      auth: { user: null, isAuthenticated: false, isGuest: false, loading: false },
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
    })

    await waitFor(() => expect(screen.getByText('Logic Looper')).toBeTruthy())
    expect(await screen.findByText('Puzzle View Mock')).toBeTruthy()
  })

  it('restores authenticated user from valid token during bootstrap', async () => {
    localStorage.setItem('authToken', 'valid-token')

    renderApp({
      auth: { user: null, isAuthenticated: false, isGuest: false, loading: false },
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
    })

    await waitFor(() => expect(verifyTokenMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Logic Looper')).toBeTruthy())
    expect(localStorage.getItem('userId')).toBe('u1')
  })
})
