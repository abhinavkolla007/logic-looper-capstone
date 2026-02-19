import { describe, expect, it } from 'vitest'
import { store } from './store'

describe('store', () => {
  it('contains auth and game reducers', () => {
    const state = store.getState()
    expect(state.auth).toBeTruthy()
    expect(state.game).toBeTruthy()
  })

  it('dispatch exists', () => {
    expect(typeof store.dispatch).toBe('function')
  })
})
