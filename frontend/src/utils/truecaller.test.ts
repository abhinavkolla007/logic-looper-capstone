import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTruecallerStatusMock = vi.fn()

vi.mock('./api', () => ({
  authAPI: {
    getTruecallerStatus: (...args: unknown[]) => getTruecallerStatusMock(...args),
  },
}))

vi.mock('./env', () => ({
  env: {
    truecaller: {
      appKey: 'tc-key',
      appName: 'Logic Looper',
      lang: 'en',
      privacyUrl: 'https://example.com/privacy',
      termsUrl: 'https://example.com/terms',
    },
  },
}))

import {
  isTruecallerSupportedDevice,
  startTruecallerVerification,
  waitForTruecallerVerification,
} from './truecaller'

describe('truecaller utils', () => {
  beforeEach(() => {
    getTruecallerStatusMock.mockReset()
  })

  it('detects unsupported device', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })
    expect(isTruecallerSupportedDevice()).toBe(false)
  })

  it('starts verification on android and returns a request nonce', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14)',
      configurable: true,
    })
    const nonce = startTruecallerVerification()
    expect(nonce).toHaveLength(32)
  })

  it('waits until verified payload is available', async () => {
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14)',
      configurable: true,
    })
    getTruecallerStatusMock
      .mockResolvedValueOnce({ data: { status: 'pending' } })
      .mockResolvedValueOnce({
        data: {
          status: 'verified',
          payload: { phoneNumber: '+1234567890', name: 'Test User' },
        },
      })

    const promise = waitForTruecallerVerification('nonce-1', 10000)
    await vi.advanceTimersByTimeAsync(2100)
    const result = await promise

    expect(result.phoneNumber).toBe('+1234567890')
    vi.useRealTimers()
  })
})
