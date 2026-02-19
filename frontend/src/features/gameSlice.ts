import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { DailyActivity } from '../storage/storageManager'
import type { StreakInfo } from '../engines/streakEngine'

interface GameState {
  currentPuzzle: unknown | null
  userActivity: DailyActivity | null
  streak: StreakInfo | null
  heatmapData: DailyActivity[]
  loading: boolean
  error: string | null
  puzzleStarted: boolean
  elapsedTime: number
}

const initialState: GameState = {
  currentPuzzle: null,
  userActivity: null,
  streak: null,
  heatmapData: [],
  loading: false,
  error: null,
  puzzleStarted: false,
  elapsedTime: 0,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setPuzzle: (state, action: PayloadAction<unknown>) => {
      state.currentPuzzle = action.payload
    },
    setActivity: (state, action: PayloadAction<DailyActivity | null>) => {
      state.userActivity = action.payload
    },
    setStreak: (state, action: PayloadAction<StreakInfo>) => {
      state.streak = action.payload
    },
    setHeatmapData: (state, action: PayloadAction<DailyActivity[]>) => {
      state.heatmapData = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setPuzzleStarted: (state, action: PayloadAction<boolean>) => {
      state.puzzleStarted = action.payload
    },
    setElapsedTime: (state, action: PayloadAction<number>) => {
      state.elapsedTime = action.payload
    },
    resetGame: (state) => {
      Object.assign(state, initialState)
    },
  },
})

export const {
  setPuzzle,
  setActivity,
  setStreak,
  setHeatmapData,
  setLoading,
  setError,
  setPuzzleStarted,
  setElapsedTime,
  resetGame,
} = gameSlice.actions

export default gameSlice.reducer
