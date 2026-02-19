import { describe, expect, it } from 'vitest'
import authReducer, { logout, setGuestMode, setLoading, setUser } from './authSlice'

describe('authSlice', () => {
  it('handles setUser', () => {
    const state = authReducer(
      undefined,
      setUser({ id: 'u1', email: 'u1@test.com', authType: 'google', name: 'U1' })
    )
    expect(state.isAuthenticated).toBe(true)
    expect(state.isGuest).toBe(false)
    expect(state.user?.id).toBe('u1')
  })

  it('handles setGuestMode', () => {
    const state = authReducer(undefined, setGuestMode('guest-1'))
    expect(state.isAuthenticated).toBe(true)
    expect(state.isGuest).toBe(true)
    expect(state.user?.id).toBe('guest-1')
  })

  it('handles logout and loading', () => {
    let state = authReducer(undefined, setUser({ id: 'u1', email: 'u1@test.com', authType: 'google' }))
    state = authReducer(state, setLoading(true))
    expect(state.loading).toBe(true)
    state = authReducer(state, logout())
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isGuest).toBe(false)
  })
})
