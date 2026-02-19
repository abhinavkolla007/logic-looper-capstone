type NodeEnv = 'development' | 'test' | 'production'

function getNodeEnv(): NodeEnv {
  const raw = (process.env.NODE_ENV || 'development').trim()
  if (raw === 'development' || raw === 'test' || raw === 'production') {
    return raw
  }
  throw new Error(`Invalid NODE_ENV: "${raw}". Expected development, test, or production.`)
}

function getRequiredString(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getOptionalString(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : undefined
}

function getPort(): number {
  const raw = process.env.PORT?.trim()
  if (!raw) return 3001
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: "${raw}". Expected an integer between 1 and 65535.`)
  }
  return parsed
}

function getAllowedOrigins(): string[] {
  const defaults = ['http://localhost:5173', 'http://localhost:5174']
  const fromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return Array.from(new Set([...defaults, ...fromEnv]))
}

function getBooleanFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return false
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`Invalid ${name}: "${process.env[name]}". Expected "true" or "false".`)
}

const nodeEnv = getNodeEnv()
const jwtSecret = getRequiredString('JWT_SECRET')

if (jwtSecret === 'your-secret-key') {
  throw new Error('JWT_SECRET cannot use the insecure default value "your-secret-key".')
}

const truecallerVerifyUrl = getOptionalString('TRUECALLER_VERIFY_URL')
const truecallerApiKey = getOptionalString('TRUECALLER_API_KEY')
if ((truecallerVerifyUrl && !truecallerApiKey) || (!truecallerVerifyUrl && truecallerApiKey)) {
  throw new Error('TRUECALLER_VERIFY_URL and TRUECALLER_API_KEY must be set together.')
}

const truecallerStrictVerify = getBooleanFlag('TRUECALLER_STRICT_VERIFY')
if (truecallerStrictVerify && (!truecallerVerifyUrl || !truecallerApiKey)) {
  throw new Error(
    'TRUECALLER_STRICT_VERIFY is enabled but TRUECALLER_VERIFY_URL/TRUECALLER_API_KEY are missing.'
  )
}

export const env = {
  nodeEnv,
  port: getPort(),
  jwtSecret,
  allowedOrigins: getAllowedOrigins(),
  frontendOriginsRaw: process.env.FRONTEND_URL || '',
  firebaseProjectId: getOptionalString('FIREBASE_PROJECT_ID'),
  truecallerVerifyUrl,
  truecallerApiKey,
  truecallerStrictVerify,
  metricsApiKey: getOptionalString('METRICS_API_KEY'),
  leaderboardRedisUrl: getOptionalString('LEADERBOARD_REDIS_URL'),
  leaderboardRedisToken: getOptionalString('LEADERBOARD_REDIS_TOKEN'),
} as const
