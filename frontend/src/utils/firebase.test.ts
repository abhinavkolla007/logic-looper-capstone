import { beforeEach, describe, expect, it, vi } from 'vitest'

const signInWithPopupMock = vi.fn()
const signInWithRedirectMock = vi.fn()
const getRedirectResultMock = vi.fn()
const onAuthStateChangedMock = vi.fn()
const signOutMock = vi.fn()
const getAuthMock = vi.fn()

const authInstance = {
  currentUser: null as null | { getIdToken: () => Promise<string> },
}

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ app: true })),
}))

vi.mock('firebase/auth', () => ({
  getAuth: () => getAuthMock(),
  GoogleAuthProvider: vi.fn(() => ({ provider: 'google' })),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirectMock(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResultMock(...args),
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

describe('firebase utils', () => {
  beforeEach(() => {
    getAuthMock.mockReturnValue(authInstance)
    signInWithPopupMock.mockReset()
    signInWithRedirectMock.mockReset()
    getRedirectResultMock.mockReset()
    onAuthStateChangedMock.mockReset()
    onAuthStateChangedMock.mockImplementation(() => () => {})
    signOutMock.mockReset()
    authInstance.currentUser = null
  })

  it('returns formatted google login response', async () => {
    const getIdToken = vi.fn().mockResolvedValue('id-token')
    signInWithPopupMock.mockResolvedValue({
      user: {
        uid: 'u1',
        email: 'u1@test.com',
        displayName: 'User 1',
        photoURL: 'photo',
        getIdToken,
      },
    })

    const { signInWithGoogle } = await import('./firebase')
    const result = await signInWithGoogle()

    expect(result.uid).toBe('u1')
    expect(result.token).toBe('id-token')
    expect(getIdToken).toHaveBeenCalled()
  })

  it('logs out and supports current user token reads', async () => {
    signOutMock.mockResolvedValue(undefined)
    const { getTokenForUser, logout } = await import('./firebase')

    expect(await getTokenForUser()).toBeNull()

    authInstance.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('abc'),
    }
    expect(await getTokenForUser()).toBe('abc')

    await logout()
    expect(signOutMock).toHaveBeenCalled()
  })

  it('supports redirect auth helpers', async () => {
    signInWithRedirectMock.mockResolvedValue(undefined)
    const getIdToken = vi.fn().mockResolvedValue('redirect-token')
    getRedirectResultMock.mockResolvedValue({
      user: {
        uid: 'u2',
        email: 'u2@test.com',
        displayName: 'User 2',
        photoURL: 'photo2',
        getIdToken,
      },
    })

    const { getGoogleRedirectResult, startGoogleRedirectSignIn } = await import('./firebase')
    await startGoogleRedirectSignIn()
    const result = await getGoogleRedirectResult()

    expect(signInWithRedirectMock).toHaveBeenCalled()
    expect(result?.uid).toBe('u2')
    expect(result?.token).toBe('redirect-token')
  })

  it('waitForUserToken resolves from auth state callback', async () => {
    const getIdToken = vi.fn().mockResolvedValue('late-token')
    onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (user: { getIdToken: () => Promise<string> }) => void) => {
      cb({ getIdToken })
      return () => {}
    })

    const { waitForUserToken } = await import('./firebase')
    const token = await waitForUserToken(10)

    expect(token).toBe('late-token')
    expect(getIdToken).toHaveBeenCalled()
  })
})
