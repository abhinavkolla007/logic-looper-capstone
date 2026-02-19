import { env } from '../config/env.ts'

type CachePayload = Record<string, unknown>
type CacheEntry = { expiresAt: number; payload: CachePayload }

const localCache = new Map<string, CacheEntry>()
const CACHE_PREFIX = 'leaderboard:daily:'

function isRedisEnabled(): boolean {
  return Boolean(env.leaderboardRedisUrl && env.leaderboardRedisToken)
}

function normalizeKey(key: string): string {
  return `${CACHE_PREFIX}${key}`
}

async function redisGet<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null
  const url = `${env.leaderboardRedisUrl}/get/${encodeURIComponent(normalizeKey(key))}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.leaderboardRedisToken}`,
    },
  })
  if (!response.ok) return null
  const body = (await response.json()) as { result?: string | null }
  if (!body.result) return null
  return JSON.parse(body.result) as T
}

async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isRedisEnabled()) return
  const url = `${env.leaderboardRedisUrl}/set/${encodeURIComponent(normalizeKey(key))}`
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.leaderboardRedisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      value: JSON.stringify(value),
      ex: ttlSeconds,
    }),
  })
}

export async function getLeaderboardCache(key: string): Promise<CachePayload | null> {
  const now = Date.now()
  const local = localCache.get(key)
  if (local && local.expiresAt > now) return local.payload

  try {
    const remote = await redisGet<CachePayload>(key)
    if (remote) return remote
  } catch {
    // Redis is optional; ignore transient cache failures.
  }
  return null
}

export async function setLeaderboardCache(key: string, payload: CachePayload, ttlMs: number): Promise<void> {
  const now = Date.now()
  localCache.set(key, { expiresAt: now + ttlMs, payload })
  try {
    await redisSet(key, payload, Math.max(1, Math.floor(ttlMs / 1000)))
  } catch {
    // Redis is optional; ignore transient cache failures.
  }
}
