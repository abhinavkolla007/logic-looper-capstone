import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import gameReducer from '../features/gameSlice'
import authReducer from '../features/authSlice'
import AchievementsView from './AchievementsView'
import { storageManager } from '../storage/storageManager'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
}))

function renderWithState(preloadedState: object) {
  const store = configureStore({
    reducer: {
      game: gameReducer,
      auth: authReducer,
    },
    preloadedState,
  })

  return render(
    <Provider store={store}>
      <AchievementsView />
    </Provider>
  )
}

describe('AchievementsView', () => {
  it('renders achievement progress based on solved activity and streak', async () => {
    vi.spyOn(storageManager, 'getAchievements').mockResolvedValue([
      {
        id: 'u1:first_solve',
        userId: 'u1',
        achievementId: 'first_solve',
        name: 'First Solve',
        unlockedAt: new Date().toISOString(),
        synced: true,
      },
    ])
    localStorage.setItem('userId', 'u1')

    renderWithState({
      game: {
        currentPuzzle: null,
        userActivity: null,
        streak: { current: 7, longest: 7, lastPlayedDate: '2026-02-19', isActiveToday: true },
        heatmapData: [
          {
            userId: 'u1',
            date: '2026-02-19',
            solved: true,
            score: 105,
            timeTaken: 45000,
            difficulty: 3,
            hintsUsed: 0,
            synced: true,
          },
        ],
        loading: false,
        error: null,
        puzzleStarted: false,
        elapsedTime: 0,
      },
      auth: {
        user: { id: 'u1', email: 'u1@test.com', authType: 'google' },
        isAuthenticated: true,
        isGuest: false,
        loading: false,
      },
    })

    await waitFor(() => expect(screen.getByText('Achievements')).toBeTruthy())
    expect(screen.getByText('First Solve')).toBeTruthy()
    expect(screen.getByText('7-Day Streak')).toBeTruthy()
    expect(screen.getByText(/1\/9|2\/9|3\/9|4\/9|5\/9|6\/9|7\/9|8\/9|9\/9/)).toBeTruthy()
  })
})

