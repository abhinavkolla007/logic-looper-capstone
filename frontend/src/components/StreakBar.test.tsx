import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import gameReducer from '../features/gameSlice'
import authReducer from '../features/authSlice'
import StreakBar from './StreakBar'

const firebaseLogoutMock = vi.fn()

vi.mock('../utils/firebase', () => ({
  logout: () => firebaseLogoutMock(),
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
      <StreakBar />
    </Provider>
  )
}

describe('StreakBar', () => {
  it('renders sign out even when streak is null', () => {
    renderWithState({
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
      auth: {
        user: { id: 'u1', email: 'a@a.com', authType: 'google' },
        isAuthenticated: true,
        isGuest: false,
        loading: false,
      },
    })

    expect(screen.getByText('Sign out')).toBeTruthy()
    expect(screen.getByText('Share')).toBeTruthy()
  })

  it('shows streak values when available', () => {
    renderWithState({
      game: {
        currentPuzzle: null,
        userActivity: null,
        streak: { current: 3, longest: 8, lastPlayedDate: '2026-02-17', isActiveToday: true },
        heatmapData: [],
        loading: false,
        error: null,
        puzzleStarted: false,
        elapsedTime: 0,
      },
      auth: {
        user: { id: 'u1', email: 'a@a.com', authType: 'google' },
        isAuthenticated: true,
        isGuest: false,
        loading: false,
      },
    })

    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
  })

  it('shares streak image via canvas and logs out', async () => {
    const originalCreateElement = document.createElement.bind(document)
    const getContext = vi.fn(() => ({
      fillStyle: '',
      font: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
    }))
    const toDataURL = vi.fn(() => 'data:image/png;base64,abc')
    const click = vi.fn()
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return { width: 0, height: 0, getContext, toDataURL } as unknown as HTMLCanvasElement
      }
      if (tagName === 'a') {
        return { href: '', download: '', click } as unknown as HTMLAnchorElement
      }
      return originalCreateElement(tagName)
    })

    firebaseLogoutMock.mockResolvedValue(undefined)
    localStorage.setItem('authToken', 'token')
    localStorage.setItem('userId', 'u1')

    renderWithState({
      game: {
        currentPuzzle: null,
        userActivity: null,
        streak: { current: 3, longest: 8, lastPlayedDate: '2026-02-17', isActiveToday: true },
        heatmapData: [],
        loading: false,
        error: null,
        puzzleStarted: false,
        elapsedTime: 0,
      },
      auth: {
        user: { id: 'u1', email: 'a@a.com', authType: 'google', name: 'User 1' },
        isAuthenticated: true,
        isGuest: false,
        loading: false,
      },
    })

    fireEvent.click(screen.getByText('Share'))
    expect(click).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Sign out'))
    await waitFor(() => expect(firebaseLogoutMock).toHaveBeenCalled())
    expect(localStorage.getItem('authToken')).toBeNull()
    createElementSpy.mockRestore()
  })
})
