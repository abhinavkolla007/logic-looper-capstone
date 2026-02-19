import axios from 'axios'
import { env } from './env'

type StandardApiError = {
  success?: false
  error?: {
    code?: string
    message?: string
    requestId?: string
  }
}

function extractApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as StandardApiError | undefined
    if (payload?.error?.message) {
      if (payload.error.requestId) {
        return `${payload.error.message} (requestId: ${payload.error.requestId})`
      }
      return payload.error.message
    }
    if (typeof error.response?.data?.error === 'string') return error.response.data.error
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Request failed'
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = extractApiErrorMessage(error)
  return message || fallback
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const message = extractApiErrorMessage(error)
    return Promise.reject(new Error(message))
  }
)

export const syncAPI = {
  /**
   * Sync daily scores with backend
   */
  async syncDailyScores(
    entries: Array<{
      date: string
      score: number
      timeTaken: number
      timedBonus?: number
      proof?: string
    }>
  ) {
    return apiClient.post('/sync/daily-scores', { entries })
  },

  /**
   * Sync achievements with backend
   */
  async syncAchievements(
    achievements: Array<{
      id: string
      name: string
      unlockedAt: string
    }>
  ) {
    return apiClient.post('/sync/achievements', { achievements })
  },
}

export const authAPI = {
  /**
   * Login with Google token
   */
  async loginGoogle(token: string) {
    return apiClient.post('/auth/google', { token })
  },

  /**
   * Login with Truecaller identity
   */
  async loginTruecaller(payload: {
    phoneNumber?: string
    name?: string
    accessToken?: string
    authorizationCode?: string
  }) {
    return apiClient.post('/auth/truecaller', payload)
  },

  async getTruecallerStatus(requestNonce: string) {
    return apiClient.get(`/auth/truecaller/status/${encodeURIComponent(requestNonce)}`, {
      params: { t: Date.now() },
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })
  },

  /**
   * Create guest session
   */
  async createGuestSession() {
    return apiClient.post('/auth/guest', {})
  },

  /**
   * Verify and refresh auth token
   */
  async verifyToken() {
    return apiClient.get('/auth/verify')
  },
}

export const leaderboardAPI = {
  async getDaily(date?: string) {
    const params = date ? { date } : undefined
    return apiClient.get('/leaderboard/daily', { params })
  },
}
