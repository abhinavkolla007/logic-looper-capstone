import axios from 'axios'
import { env } from '../config/env.ts'

export type TruecallerVerifyPayload = {
  phoneNumber?: string
  name?: string
  accessToken?: string
  authorizationCode?: string
}

type TruecallerVerifyResult = {
  phoneNumber: string
  name?: string
}

type VerifyResponseShape = {
  phoneNumber?: string
  mobile?: string
  msisdn?: string
  name?: string
  fullName?: string
}

const TRUECALLER_VERIFY_URL = env.truecallerVerifyUrl || ''
const TRUECALLER_API_KEY = env.truecallerApiKey || ''
const STRICT_TRUECALLER_VERIFY = env.truecallerStrictVerify

function normalizePhone(phone: string): string {
  return String(phone).replace(/[^\d+]/g, '')
}

export function isTruecallerVerificationConfigured(): boolean {
  return Boolean(TRUECALLER_VERIFY_URL && TRUECALLER_API_KEY)
}

export async function verifyTruecallerIdentity(payload: TruecallerVerifyPayload): Promise<TruecallerVerifyResult> {
  const normalizedPhone = payload.phoneNumber ? normalizePhone(payload.phoneNumber) : ''
  if (payload.phoneNumber && normalizedPhone.length < 8) {
    throw new Error('Invalid phone number')
  }

  if (!isTruecallerVerificationConfigured()) {
    if (STRICT_TRUECALLER_VERIFY) {
      throw new Error('Truecaller verification is not configured on server')
    }
    if (!normalizedPhone) {
      throw new Error('phoneNumber is required when strict verification is disabled')
    }
    return {
      phoneNumber: normalizedPhone,
      name: payload.name?.trim() || 'Truecaller User',
    }
  }

  if (!payload.accessToken && !payload.authorizationCode) {
    throw new Error('Truecaller verification token is missing')
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TRUECALLER_API_KEY}`,
    appKey: TRUECALLER_API_KEY,
    clientId: TRUECALLER_API_KEY,
  }

  const accessToken = payload.accessToken || payload.authorizationCode || ''
  const verifyUrl = TRUECALLER_VERIFY_URL.includes('{accessToken}')
    ? TRUECALLER_VERIFY_URL.replace('{accessToken}', encodeURIComponent(accessToken))
    : TRUECALLER_VERIFY_URL

  const response = TRUECALLER_VERIFY_URL.includes('{accessToken}')
    ? await axios.get<VerifyResponseShape>(verifyUrl, {
        headers,
        timeout: 10000,
      })
    : await axios.post<VerifyResponseShape>(
        verifyUrl,
        {
          accessToken: payload.accessToken,
          authorizationCode: payload.authorizationCode,
          phoneNumber: normalizedPhone,
        },
        {
          headers,
          timeout: 10000,
        }
      )

  const verifiedPhone =
    response.data.phoneNumber ?? response.data.mobile ?? response.data.msisdn ?? normalizedPhone
  const normalizedVerifiedPhone = normalizePhone(verifiedPhone)
  if (!normalizedVerifiedPhone || normalizedVerifiedPhone.length < 8) {
    throw new Error('Truecaller verification did not return a valid phone number')
  }
  if (normalizedPhone && normalizedVerifiedPhone !== normalizedPhone) {
    throw new Error('Truecaller phone verification mismatch')
  }

  return {
    phoneNumber: normalizedVerifiedPhone,
    name: (response.data.name || response.data.fullName || payload.name || 'Truecaller User').trim(),
  }
}
