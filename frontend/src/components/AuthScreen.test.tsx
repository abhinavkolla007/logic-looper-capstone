import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import authReducer from '../features/authSlice'
import gameReducer from '../features/gameSlice'
import AuthScreen from './AuthScreen'

const startGoogleRedirectSignInMock = vi.fn()
const getGoogleRedirectResultMock = vi.fn()
const getTokenForUserMock = vi.fn()
const waitForUserTokenMock = vi.fn()
const signInWithGoogleMock = vi.fn()
const loginGoogleMock = vi.fn()

vi.mock('../utils/firebase', () => ({
  signInWithGoogle: () => signInWithGoogleMock(),
  startGoogleRedirectSignIn: () => startGoogleRedirectSignInMock(),
  getGoogleRedirectResult: () => getGoogleRedirectResultMock(),
  getTokenForUser: () => getTokenForUserMock(),
  waitForUserToken: () => waitForUserTokenMock(),
}))

vi.mock('../utils/api', () => ({
  authAPI: {
    loginGoogle: (...args: unknown[]) => loginGoogleMock(...args),
  },
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
}))

function renderScreen() {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      game: gameReducer,
    },
  })

  return {
    ...render(
      <Provider store={store}>
        <AuthScreen />
      </Provider>
    ),
    store,
  }
}

describe('AuthScreen', () => {
  beforeEach(() => {
    signInWithGoogleMock.mockReset()
    signInWithGoogleMock.mockResolvedValue({ token: 'popup-token' })
    startGoogleRedirectSignInMock.mockReset()
    getGoogleRedirectResultMock.mockReset()
    getGoogleRedirectResultMock.mockResolvedValue(null)
    getTokenForUserMock.mockReset()
    getTokenForUserMock.mockResolvedValue(null)
    waitForUserTokenMock.mockReset()
    waitForUserTokenMock.mockResolvedValue(null)
    loginGoogleMock.mockReset()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('falls back to current firebase user token after redirect when result is null', async () => {
    sessionStorage.setItem('googleRedirectPending', '1')
    getGoogleRedirectResultMock.mockResolvedValue(null)
    getTokenForUserMock.mockResolvedValue('firebase-token')
    loginGoogleMock.mockResolvedValue({
      data: {
        token: 'backend-token',
        user: { id: 'u2', email: 'u2@test.com', name: 'User 2' },
      },
    })

    const { store } = renderScreen()
    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true))
    expect(localStorage.getItem('authToken')).toBe('backend-token')
    expect(localStorage.getItem('userId')).toBe('u2')
  })

  it('shows clear message when redirect was pending but no user token is available', async () => {
    sessionStorage.setItem('googleRedirectPending', '1')
    getGoogleRedirectResultMock.mockResolvedValue(null)
    getTokenForUserMock.mockResolvedValue(null)
    waitForUserTokenMock.mockResolvedValue(null)

    renderScreen()
    await waitFor(() =>
      expect(screen.getByText('Google sign-in could not be completed. Please try again.')).toBeTruthy()
    )
  })

  it('completes google redirect login and stores auth data', async () => {
    sessionStorage.setItem('googleRedirectPending', '1')
    getGoogleRedirectResultMock.mockResolvedValue({ token: 'firebase-token' })
    loginGoogleMock.mockResolvedValue({
      data: {
        token: 'backend-token',
        user: { id: 'u1', email: 'u1@test.com', name: 'User 1' },
      },
    })

    const { store } = renderScreen()

    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true))
    expect(localStorage.getItem('authToken')).toBe('backend-token')
    expect(localStorage.getItem('userId')).toBe('u1')
  })

  it('falls back to guest login', () => {
    const { store } = renderScreen()
    fireEvent.click(screen.getByText('Play as Guest'))

    expect(store.getState().auth.isGuest).toBe(true)
    expect(localStorage.getItem('guestId')).toContain('guest-')
  })

  it('uses popup google login path and stores auth data', async () => {
    signInWithGoogleMock.mockResolvedValue({ token: 'popup-token' })
    loginGoogleMock.mockResolvedValue({
      data: {
        token: 'backend-popup-token',
        user: { id: 'u3', email: 'u3@test.com', name: 'User 3' },
      },
    })

    const { store } = renderScreen()
    fireEvent.click(screen.getByText('Continue with Google'))

    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true))
    expect(localStorage.getItem('authToken')).toBe('backend-popup-token')
    expect(startGoogleRedirectSignInMock).not.toHaveBeenCalled()
  })

  it('handles reset session and login failure', async () => {
    sessionStorage.setItem('googleRedirectPending', '1')
    getGoogleRedirectResultMock.mockRejectedValue(new Error('Network Error'))
    signInWithGoogleMock.mockRejectedValue(new Error('auth/operation-not-supported-in-this-environment'))
    startGoogleRedirectSignInMock.mockResolvedValue(undefined)
    localStorage.setItem('authToken', 't')
    localStorage.setItem('userId', 'u')
    localStorage.setItem('guestId', 'g')

    renderScreen()
    fireEvent.click(screen.getByText('Continue with Google'))
    await waitFor(() => expect(startGoogleRedirectSignInMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Network Error')).toBeTruthy())
  })
})
