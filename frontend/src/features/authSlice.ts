import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  user: {
    id: string
    email: string
    name?: string
    authType: 'google' | 'guest' | 'truecaller'
  } | null
  isAuthenticated: boolean
  isGuest: boolean
  loading: boolean
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isGuest: false,
  loading: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthState['user']>) => {
      state.user = action.payload
      state.isAuthenticated = !!action.payload
      state.isGuest = action.payload?.authType === 'guest'
      state.loading = false
    },
    setGuestMode: (state, action: PayloadAction<string | undefined>) => {
      const guestId = action.payload ?? `guest-${Date.now()}`
      state.user = {
        id: guestId,
        email: 'guest@logic-looper.local',
        authType: 'guest',
      }
      state.isAuthenticated = true
      state.isGuest = true
      state.loading = false
    },
    logout: (state) => {
      state.user = null
      state.isAuthenticated = false
      state.isGuest = false
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
  },
})

export const { setUser, setGuestMode, logout, setLoading } = authSlice.actions
export default authSlice.reducer
