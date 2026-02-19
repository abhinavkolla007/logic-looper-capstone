import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import gameReducer from '../features/gameSlice'
import authReducer from '../features/authSlice'
import HeatmapView from './HeatmapView'
import { storageManager } from '../storage/storageManager'

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
      <HeatmapView />
    </Provider>
  )
}

describe('HeatmapView', () => {
  it('renders heading and year selector', async () => {
    vi.spyOn(storageManager, 'getActivitiesByYear').mockResolvedValue([])
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy.mockImplementation(((tagName: string) => {
      if (tagName === 'a') {
        return { click: vi.fn() } as unknown as HTMLElement
      }
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            fillStyle: '',
            fillRect: vi.fn(),
            font: '',
            fillText: vi.fn(),
          }),
          toDataURL: () => 'data:image/png;base64,abc',
        } as unknown as HTMLElement
      }
      return realCreateElement(tagName)
    }) as typeof document.createElement)

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

    expect(screen.getByText(/-Day Activity$/)).toBeTruthy()
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: String(new Date().getFullYear() - 1) } })
    await waitFor(() => expect(storageManager.getActivitiesByYear).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Share as Image'))
    expect(screen.getByText('Hover a day to see details.')).toBeTruthy()
    createElementSpy.mockRestore()
  })
})
