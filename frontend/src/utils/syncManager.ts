import { syncAPI } from './api'
import { storageManager } from '../storage/storageManager'
import { buildDailyScoreProof } from './syncProof'

type SyncQueueEntry = {
  timestamp: number
  action: string
  data: unknown
  synced: boolean
}

type DailyScoreEntry = {
  userId: string
  date: string
  score: number
  timeTaken: number
  timedBonus?: number
}

function isDailyScoreEntry(data: unknown): data is DailyScoreEntry {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'date' in data &&
    'score' in data &&
    'timeTaken' in data
  )
}

export async function flushPendingSync(userId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  if (!localStorage.getItem('authToken')) return

  return flushPendingSyncWithOptions(userId, { force: false, batchSize: 5 })
}

export async function flushPendingSyncWithOptions(
  userId: string,
  options?: { force?: boolean; batchSize?: number }
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  if (!localStorage.getItem('authToken')) return

  const queue = (await storageManager.getSyncQueue()) as SyncQueueEntry[]
  const dailyEntries = queue.filter((item) => item.action === 'daily_score' && isDailyScoreEntry(item.data))

  const relevant = dailyEntries.filter((item) => {
    const payload = item.data as DailyScoreEntry
    return payload.userId === userId
  })

  const batchSize = options?.batchSize ?? 5
  const force = options?.force ?? false

  if (relevant.length && (force || relevant.length >= batchSize)) {
    const authToken = localStorage.getItem('authToken') || ''
    const entries = relevant.map((item) => {
      const payload = item.data as DailyScoreEntry
      const raw = {
        date: payload.date,
        score: payload.score,
        timeTaken: payload.timeTaken,
        timedBonus: payload.timedBonus ?? 0,
      }
      return {
        ...raw,
        proof: buildDailyScoreProof(raw, authToken),
      }
    })

    await syncAPI.syncDailyScores(entries)

    for (const item of relevant) {
      const payload = item.data as DailyScoreEntry
      await storageManager.markSynced(item.timestamp)
      await storageManager.markActivitySynced(payload.userId, payload.date)
    }
  }

  const unsyncedAchievements = await storageManager.getUnsyncedAchievements(userId)
  if (!unsyncedAchievements.length) return

  await syncAPI.syncAchievements(
    unsyncedAchievements.map((a) => ({
      id: a.achievementId,
      name: a.name,
      unlockedAt: a.unlockedAt,
    }))
  )

  for (const achievement of unsyncedAchievements) {
    await storageManager.markAchievementSynced(userId, achievement.achievementId)
  }
}
