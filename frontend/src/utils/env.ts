type FrontendEnv = {
  apiUrl: string
  puzzleSeedNamespace: string
  firebase: {
    apiKey: string
    authDomain: string
    projectId: string
    appId: string
  }
  truecaller: {
    appKey: string
    appName: string
    lang: string
    privacyUrl?: string
    termsUrl?: string
  }
}

const isTestRuntime =
  (import.meta.env.MODE || '').toLowerCase() === 'test' || Boolean(import.meta.env.VITEST)

function readEnv(name: string): string {
  const value = (import.meta.env[name as keyof ImportMetaEnv] as string | undefined)?.trim()
  return value ?? ''
}

function requireEnv(name: string, testFallback?: string): string {
  const value = readEnv(name)
  if (!value && isTestRuntime && testFallback !== undefined) {
    return testFallback
  }
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizeApiUrl(raw: string): string {
  if (raw.startsWith('/')) return raw

  try {
    const parsed = new URL(raw)
    if (!parsed.protocol.startsWith('http')) {
      throw new Error()
    }
    return raw.replace(/\/+$/, '')
  } catch {
    throw new Error(`Invalid VITE_API_URL: "${raw}". Use absolute http(s) URL or relative path like /api.`)
  }
}

const apiUrl = normalizeApiUrl(requireEnv('VITE_API_URL', 'http://localhost:3001'))
const firebase = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY', 'test-firebase-api-key'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', 'test-project-id'),
  appId: requireEnv('VITE_FIREBASE_APP_ID', 'test-app-id'),
}

const truecallerAppKey = readEnv('VITE_TRUECALLER_APP_KEY')
const truecallerPrivacyUrl = readEnv('VITE_TRUECALLER_PRIVACY_URL')
const truecallerTermsUrl = readEnv('VITE_TRUECALLER_TERMS_URL')

if (truecallerAppKey && truecallerPrivacyUrl) {
  new URL(truecallerPrivacyUrl)
}
if (truecallerAppKey && truecallerTermsUrl) {
  new URL(truecallerTermsUrl)
}

export const env: FrontendEnv = {
  apiUrl,
  puzzleSeedNamespace: readEnv('VITE_PUZZLE_SEED_NAMESPACE') || 'logic-looper-v1',
  firebase,
  truecaller: {
    appKey: truecallerAppKey,
    appName: readEnv('VITE_TRUECALLER_APP_NAME') || 'Logic Looper',
    lang: readEnv('VITE_TRUECALLER_LANG') || 'en',
    privacyUrl: truecallerPrivacyUrl || undefined,
    termsUrl: truecallerTermsUrl || undefined,
  },
}
