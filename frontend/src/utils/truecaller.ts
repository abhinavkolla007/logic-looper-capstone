import { authAPI } from './api'
import { env } from './env'

type TruecallerProfile = {
  phoneNumber?: string
  name?: string
  accessToken?: string
  authorizationCode?: string
}

type TruecallerStatusResponse = {
  status?: 'pending' | 'verified'
  payload?: TruecallerProfile
}

const TRUECALLER_APP_KEY = env.truecaller.appKey
const TRUECALLER_APP_NAME = env.truecaller.appName
const TRUECALLER_LANG = env.truecaller.lang
const TRUECALLER_PRIVACY_URL = env.truecaller.privacyUrl || `${window.location.origin}/privacy`
const TRUECALLER_TERMS_URL = env.truecaller.termsUrl || `${window.location.origin}/terms`

const TRUECALLER_REQUEST_TIMEOUT_MS = 120000
const TRUECALLER_POLL_INTERVAL_MS = 2000

export function isTruecallerSupportedDevice(): boolean {
  const userAgent = navigator.userAgent || ''
  return /android/i.test(userAgent)
}

function createRequestNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function ensureTruecallerConfig() {
  if (!TRUECALLER_APP_KEY) {
    throw new Error('VITE_TRUECALLER_APP_KEY is missing.')
  }
}

export function startTruecallerVerification(): string {
  if (!isTruecallerSupportedDevice()) {
    throw new Error('Truecaller login is only supported on Android mobile browsers.')
  }

  ensureTruecallerConfig()
  const requestNonce = createRequestNonce()
  const params = new URLSearchParams({
    type: 'btmsheet',
    requestNonce,
    partnerKey: TRUECALLER_APP_KEY,
    partnerName: TRUECALLER_APP_NAME,
    lang: TRUECALLER_LANG,
    privacyUrl: TRUECALLER_PRIVACY_URL,
    termsUrl: TRUECALLER_TERMS_URL,
    loginPrefix: 'continue',
    loginSuffix: 'verifymobile',
    ctaPrefix: 'continuewith',
    ctaColor: '#00a884',
    ctaTextColor: '#ffffff',
    btnShape: 'rect',
    skipOption: 'useanothermethod',
    ttl: '8000',
  })

  window.location.href = `truecallersdk://truesdk/web_verify?${params.toString()}`
  return requestNonce
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function waitForTruecallerVerification(
  requestNonce: string,
  timeoutMs = TRUECALLER_REQUEST_TIMEOUT_MS
): Promise<TruecallerProfile> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const response = await authAPI.getTruecallerStatus(requestNonce)
    const data = response.data as TruecallerStatusResponse

    if (data.status === 'verified' && data.payload) {
      return data.payload
    }

    await sleep(TRUECALLER_POLL_INTERVAL_MS)
  }

  throw new Error('Truecaller verification timed out. Please try again.')
}
