import { describe, expect, it } from 'vitest'
import reducer, {
  resetGame,
  setActivity,
  setElapsedTime,
  setError,
  setHeatmapData,
  setLoading,
  setPuzzle,
  setPuzzleStarted,
  setStreak,
} from './gameSlice'

describe('gameSlice', () => {
  it('updates puzzle and activity state', () => {
    const puzzle = { type: 'pattern' }
    const activity = {
      userId: 'u1',
      date: '2026-02-17',
      solved: true,
      score: 120,
      timeTaken: 30,
      difficulty: 2,
      hintsUsed: 1,
      synced: false,
    }

    let state = reducer(undefined, setPuzzle(puzzle))
    state = reducer(state, setActivity(activity))
    state = reducer(state, setHeatmapData([activity]))

    expect(state.currentPuzzle).toEqual(puzzle)
    expect(state.userActivity).toEqual(activity)
    expect(state.heatmapData).toHaveLength(1)
  })

  it('updates loading/error/timer controls', () => {
    let state = reducer(undefined, setLoading(true))
    state = reducer(state, setError('boom'))
    state = reducer(state, setPuzzleStarted(true))
    state = reducer(state, setElapsedTime(42))
    state = reducer(state, setStreak({ current: 4, longest: 9, lastPlayedDate: '2026-02-17', isActiveToday: true }))

    expect(state.loading).toBe(true)
    expect(state.error).toBe('boom')
    expect(state.puzzleStarted).toBe(true)
    expect(state.elapsedTime).toBe(42)
    expect(state.streak?.current).toBe(4)
  })

  it('resets back to initial state', () => {
    let state = reducer(undefined, setLoading(true))
    state = reducer(state, setError('boom'))
    state = reducer(state, setElapsedTime(30))
    state = reducer(state, resetGame())

    expect(state).toEqual({
      currentPuzzle: null,
      userActivity: null,
      streak: null,
      heatmapData: [],
      loading: false,
      error: null,
      puzzleStarted: false,
      elapsedTime: 0,
    })
  })
})
