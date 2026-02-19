import { describe, expect, it } from 'vitest'
import { validateGoogleLoginPayload, validateTruecallerLoginPayload } from './authController'

describe('validateGoogleLoginPayload', () => {
  it('accepts valid firebase token payload', () => {
    expect(validateGoogleLoginPayload({ token: 'header.payload.signature' })).toBe(true)
  })

  it('rejects short or missing token', () => {
    expect(validateGoogleLoginPayload({ token: 'short' })).toBe(false)
    expect(validateGoogleLoginPayload({ token: 'not.a.jwt!' })).toBe(false)
    expect(validateGoogleLoginPayload({})).toBe(false)
    expect(validateGoogleLoginPayload(null)).toBe(false)
  })
})

describe('validateTruecallerLoginPayload', () => {
  it('accepts access token login payload', () => {
    expect(
      validateTruecallerLoginPayload({
        accessToken: 'token_123456789',
        name: 'User',
      })
    ).toBe(true)
  })

  it('accepts authorization code payload', () => {
    expect(
      validateTruecallerLoginPayload({
        authorizationCode: 'code123456',
      })
    ).toBe(true)
  })

  it('accepts phone-number-only payload when valid E.164', () => {
    expect(
      validateTruecallerLoginPayload({
        phoneNumber: '+919999888877',
      })
    ).toBe(true)
  })

  it('rejects payload with no verifiable identifier', () => {
    expect(validateTruecallerLoginPayload({ name: 'Only Name' })).toBe(false)
  })

  it('rejects invalid phone and weak credentials', () => {
    expect(validateTruecallerLoginPayload({ phoneNumber: '12345' })).toBe(false)
    expect(validateTruecallerLoginPayload({ accessToken: 'short' })).toBe(false)
    expect(validateTruecallerLoginPayload({ authorizationCode: '123' })).toBe(false)
  })
})
