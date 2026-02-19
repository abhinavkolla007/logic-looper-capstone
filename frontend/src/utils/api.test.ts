import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, authAPI, getApiErrorMessage, syncAPI } from './api'

type ApiResponse = { url: string; payload?: unknown }
type RequestInterceptor = { fulfilled: (config: { headers: Record<string, string> }) => Promise<{ headers: Record<string, string> }> }
type InterceptorManagerShape = { handlers: RequestInterceptor[] }

describe('api utils', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('attaches auth header through interceptor', async () => {
    localStorage.setItem('authToken', 'abc')
    const manager = apiClient.interceptors.request as unknown as InterceptorManagerShape
    const interceptor = manager.handlers[0].fulfilled
    const config = await interceptor({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc')
  })

  it('calls sync and auth endpoints', async () => {
    const postSpy = vi.fn(async (url: string, payload: unknown) => ({ url, payload }))
    const getSpy = vi.fn(async (url: string) => ({ url }))
    ;(apiClient.post as unknown) = postSpy as unknown
    ;(apiClient.get as unknown) = getSpy as unknown

    const daily = await syncAPI.syncDailyScores([{ date: '2026-02-17', score: 100, timeTaken: 50 }])
    const ach = await syncAPI.syncAchievements([{ id: 'a1', name: 'A', unlockedAt: new Date().toISOString() }])
    const google = await authAPI.loginGoogle('token')
    const guest = await authAPI.createGuestSession()
    const verify = await authAPI.verifyToken()

    expect(postSpy).toBeTruthy()
    expect(getSpy).toBeTruthy()
    expect((daily as unknown as ApiResponse).url).toBe('/sync/daily-scores')
    expect((ach as unknown as ApiResponse).url).toBe('/sync/achievements')
    expect((google as unknown as ApiResponse).url).toBe('/auth/google')
    expect((guest as unknown as ApiResponse).url).toBe('/auth/guest')
    expect((verify as unknown as ApiResponse).url).toBe('/auth/verify')
  })

  it('extracts message from standardized API error', () => {
    const err = {
      response: {
        data: {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid entries format',
          },
        },
      },
      isAxiosError: true,
      message: 'Request failed with status code 400',
      toJSON: () => ({}),
      name: 'AxiosError',
      config: {},
    }

    expect(getApiErrorMessage(err, 'fallback')).toBe('Invalid entries format')
  })

  it('appends requestId from standardized API error when present', () => {
    const err = {
      response: {
        data: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Sync failed',
            requestId: 'req-1234',
          },
        },
      },
      isAxiosError: true,
      message: 'Request failed with status code 500',
      toJSON: () => ({}),
      name: 'AxiosError',
      config: {},
    }

    expect(getApiErrorMessage(err, 'fallback')).toBe('Sync failed (requestId: req-1234)')
  })
})
