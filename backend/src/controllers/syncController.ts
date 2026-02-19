import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import CryptoJS from 'crypto-js'
import { sendError, sendSuccess } from '../utils/http.ts'
import { getRequestLogMeta, logError, logInfo } from '../utils/logger.ts'

const prisma = new PrismaClient()
dayjs.extend(customParseFormat)

type SyncDailyEntry = {
  date: string
  score: number
  timeTaken: number
  timedBonus?: number
  proof?: string
}

type SyncAchievementEntry = {
  id: string
  name: string
  unlockedAt: string
}

type ExistingDailyScore = {
  score: number
  timeTaken: number
}

const MAX_SYNC_DAILY_ENTRIES_PER_REQUEST = 60
const MAX_SYNC_ACHIEVEMENTS_PER_REQUEST = 120
const PROOF_REPLAY_TTL_MS = 15 * 60 * 1000
const HIGH_SCORE_MAX_TIME_MS = 240_000
const ELITE_SCORE_MAX_TIME_MS = 90_000
const seenProofs = new Map<string, number>()

function cleanupSeenProofs(now: number): void {
  for (const [key, expiresAt] of seenProofs.entries()) {
    if (expiresAt <= now) {
      seenProofs.delete(key)
    }
  }
}

function registerProofIfFresh(userId: string, proof: string, now: number): boolean {
  cleanupSeenProofs(now)
  const key = `${userId}:${proof}`
  const existing = seenProofs.get(key)
  if (existing && existing > now) return false
  seenProofs.set(key, now + PROOF_REPLAY_TTL_MS)
  return true
}

export function isIncomingDailyEntryBetter(
  existing: ExistingDailyScore | null | undefined,
  incoming: Pick<SyncDailyEntry, 'score' | 'timeTaken'>
): boolean {
  if (!existing) return true
  if (incoming.score > existing.score) return true
  if (incoming.score < existing.score) return false
  return incoming.timeTaken < existing.timeTaken
}

function pickPreferredEntry(current: SyncDailyEntry | undefined, incoming: SyncDailyEntry): SyncDailyEntry {
  if (!current) return incoming
  return isIncomingDailyEntryBetter(current, incoming) ? incoming : current
}

export function validateDailyEntry(entry: unknown): entry is SyncDailyEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const e = entry as Record<string, unknown>
  if (
    typeof e.date !== 'string' ||
    typeof e.score !== 'number' ||
    typeof e.timeTaken !== 'number' ||
    (e.proof !== undefined && typeof e.proof !== 'string') ||
    (e.timedBonus !== undefined && typeof e.timedBonus !== 'number')
  ) {
    return false
  }
  if (!Number.isInteger(e.score) || !Number.isInteger(e.timeTaken)) return false
  if (e.timedBonus !== undefined && !Number.isInteger(e.timedBonus)) return false

  const parsed = dayjs(e.date, 'YYYY-MM-DD', true)
  const now = dayjs()
  const earliestAllowed = now.subtract(400, 'day').startOf('day')
  const latestAllowed = now.add(1, 'day').startOf('day')

  if (!parsed.isValid()) return false
  if (parsed.isBefore(earliestAllowed, 'day')) return false
  if (parsed.isAfter(latestAllowed, 'day')) return false
  if (e.score < 10 || e.score > 120) return false
  if (e.timedBonus !== undefined && (e.timedBonus < 0 || e.timedBonus > 25)) return false
  if (e.timeTaken < 1000 || e.timeTaken > 7_200_000) return false
  if (e.score >= 100 && e.timeTaken > HIGH_SCORE_MAX_TIME_MS) return false
  if (e.score >= 110 && e.timeTaken > ELITE_SCORE_MAX_TIME_MS) return false

  // Client scoring uses elapsed time (seconds) in score calculation.
  // Reject impossible score values for a reported completion time.
  const maxPossibleScore = Math.max(10, 120 - Math.floor(e.timeTaken / 1000) + (e.timedBonus ?? 0))
  if (e.score > maxPossibleScore) return false

  return true
}

export function buildDailyEntryProof(
  entry: Pick<SyncDailyEntry, 'date' | 'score' | 'timeTaken' | 'timedBonus'>,
  authToken: string
): string {
  const key = CryptoJS.SHA256(authToken).toString()
  const message = `${entry.date}|${entry.score}|${entry.timeTaken}|${entry.timedBonus ?? 0}`
  return CryptoJS.HmacSHA256(message, key).toString()
}

function verifyDailyEntryProof(entry: SyncDailyEntry, authToken: string): boolean {
  if (!entry.proof) return false
  const expected = buildDailyEntryProof(entry, authToken)
  return expected === entry.proof
}

async function recalculateUserStats(userId: string): Promise<void> {
  const allScores = await prisma.dailyScore.findMany({
    where: { userId, solved: true },
    select: { date: true, score: true, timeTaken: true },
    orderBy: { date: 'asc' },
  })

  const solvedCount = allScores.length
  const totalPoints = allScores.reduce((sum, row) => sum + row.score, 0)
  const avgSolveTime = solvedCount
    ? allScores.reduce((sum, row) => sum + row.timeTaken, 0) / solvedCount
    : 0
  const perfectDays = allScores.filter((row) => row.score >= 100).length
  const lastPlayed = solvedCount ? allScores[solvedCount - 1].date : null

  const solvedSet = new Set(allScores.map((row) => dayjs(row.date).format('YYYY-MM-DD')))
  let streakCount = 0
  let cursor = dayjs()
  while (solvedSet.has(cursor.format('YYYY-MM-DD'))) {
    streakCount += 1
    cursor = cursor.subtract(1, 'day')
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totalPoints,
      streakCount,
      lastPlayed: lastPlayed ? new Date(lastPlayed) : null,
    },
  })

  await prisma.userStats.upsert({
    where: { userId },
    update: {
      puzzlesSolved: solvedCount,
      avgSolveTime,
      perfectDays,
    },
    create: {
      userId,
      puzzlesSolved: solvedCount,
      avgSolveTime,
      perfectDays,
    },
  })
}

export function validateAchievementEntry(entry: unknown): entry is SyncAchievementEntry {
  if (typeof entry !== 'object' || entry === null) return false
  const e = entry as Record<string, unknown>
  if (typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.unlockedAt !== 'string') return false
  const parsed = dayjs(e.unlockedAt)
  if (parsed.isAfter(dayjs().add(5, 'minute'))) return false
  if (!parsed.isValid()) return false
  return (
    e.id.length > 0 &&
    e.id.length <= 100 &&
    e.name.length > 0 &&
    e.name.length <= 120 &&
    /^[-_a-zA-Z0-9]+$/.test(e.id)
  )
}

export async function syncDailyScores(req: Request, res: Response) {
  try {
    const { entries } = req.body
    const userId = req.user?.id
    const authToken = req.headers.authorization?.replace('Bearer ', '') || ''

    if (!userId) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized', req.requestId)
    }

    if (!Array.isArray(entries)) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid entries format', req.requestId)
    }
    if (!authToken) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Missing authorization token', req.requestId)
    }
    if (entries.length > MAX_SYNC_DAILY_ENTRIES_PER_REQUEST) {
      return sendError(
        res,
        413,
        'PAYLOAD_TOO_LARGE',
        `Too many entries. Max ${MAX_SYNC_DAILY_ENTRIES_PER_REQUEST} entries per request.`,
        req.requestId
      )
    }

    const validEntries = entries.filter((entry): entry is SyncDailyEntry => validateDailyEntry(entry))
    if (validEntries.length !== entries.length) {
      return sendError(
        res,
        400,
        'BAD_REQUEST',
        `Invalid sync entries: ${entries.length - validEntries.length} rejected`,
        req.requestId
      )
    }
    const uniqueEntries = new Map<string, SyncDailyEntry>()
    for (const entry of validEntries) {
      if (!verifyDailyEntryProof(entry, authToken)) continue
      uniqueEntries.set(entry.date, pickPreferredEntry(uniqueEntries.get(entry.date), entry))
    }

    let created = 0
    let updated = 0
    let skippedWorseOrDuplicate = 0
    let rejectedReplay = 0

    for (const entry of uniqueEntries.values()) {
      if (!entry.proof) continue
      const now = Date.now()
      if (!registerProofIfFresh(userId, entry.proof, now)) {
        rejectedReplay += 1
        continue
      }
      const rowDate = new Date(entry.date)
      const existing = await prisma.dailyScore.findUnique({
        where: {
          userId_date: {
            userId,
            date: rowDate,
          },
        },
        select: {
          score: true,
          timeTaken: true,
        },
      })
      if (!isIncomingDailyEntryBetter(existing, entry)) {
        skippedWorseOrDuplicate += 1
        continue
      }

      if (existing) {
        await prisma.dailyScore.update({
          where: {
            userId_date: {
              userId,
              date: rowDate,
            },
          },
          data: {
            score: entry.score,
            timeTaken: entry.timeTaken,
            hintsUsed: 0,
            synced: true,
            solved: true,
            updatedAt: new Date(),
          },
        })
        updated += 1
      } else {
        await prisma.dailyScore.create({
          data: {
            userId,
            date: rowDate,
            score: entry.score,
            timeTaken: entry.timeTaken,
            puzzleId: `puzzle-${entry.date}`,
            synced: true,
            solved: true,
          },
        })
        created += 1
      }
    }

    const synced = created + updated
    logInfo('sync.daily_scores_processed', {
      ...getRequestLogMeta(req),
      requestedEntries: entries.length,
      acceptedEntries: uniqueEntries.size,
      synced,
      created,
      updated,
      skippedWorseOrDuplicate,
      rejectedReplay,
    })
    sendSuccess(res, {
      synced,
      created,
      updated,
      skippedWorseOrDuplicate,
      rejectedReplay,
      message: `Synced ${synced} entries`,
    })
  } catch (error) {
    logError('sync.daily_scores_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Sync failed', req.requestId)
  }
}

export async function syncAchievements(req: Request, res: Response) {
  try {
    const { achievements } = req.body
    const userId = req.user?.id

    if (!userId) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized', req.requestId)
    }

    if (!Array.isArray(achievements)) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid achievements format', req.requestId)
    }
    if (achievements.length > MAX_SYNC_ACHIEVEMENTS_PER_REQUEST) {
      return sendError(
        res,
        413,
        'PAYLOAD_TOO_LARGE',
        `Too many achievements. Max ${MAX_SYNC_ACHIEVEMENTS_PER_REQUEST} achievements per request.`,
        req.requestId
      )
    }

    const synced: string[] = []
    for (const item of achievements) {
      if (!validateAchievementEntry(item)) continue

      await prisma.achievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId: item.id,
          },
        },
        update: {
          name: item.name,
          unlockedAt: new Date(item.unlockedAt),
          synced: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          achievementId: item.id,
          name: item.name,
          unlockedAt: new Date(item.unlockedAt),
          synced: true,
        },
      })

      synced.push(item.id)
    }

    await recalculateUserStats(userId)

    logInfo('sync.achievements_processed', {
      ...getRequestLogMeta(req),
      requestedAchievements: achievements.length,
      syncedAchievements: synced.length,
    })
    sendSuccess(res, {
      synced: synced.length,
    })
  } catch (error) {
    logError('sync.achievements_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Sync failed', req.requestId)
  }
}
