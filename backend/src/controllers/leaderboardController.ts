import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { sendError, sendSuccess } from '../utils/http.ts'
import { getRequestLogMeta, logError } from '../utils/logger.ts'
import { getLeaderboardCache, setLeaderboardCache } from '../utils/leaderboardCache.ts'

dayjs.extend(customParseFormat)
const prisma = new PrismaClient()

const CACHE_TTL_MS = 60_000

type LeaderboardViewRow = {
  rank: number
  userId: string
  name: string | null
  email: string
  score: number
  timeTaken: number
}

async function queryFromMaterializedView(date: string): Promise<LeaderboardViewRow[] | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<LeaderboardViewRow[]>(
      `
      SELECT rank, "userId", name, email, score, "timeTaken"
      FROM daily_leaderboard_mv
      WHERE date = $1::date
      ORDER BY rank ASC
      LIMIT 100
      `,
      date
    )
    return rows
  } catch {
    return null
  }
}

export function normalizeLeaderboardDate(dateInput?: string): string | null {
  const date = dateInput ?? dayjs().format('YYYY-MM-DD')
  const parsed = dayjs(date, 'YYYY-MM-DD', true)
  if (!parsed.isValid()) return null

  const minDate = dayjs().subtract(365, 'day').startOf('day')
  const maxDate = dayjs().add(1, 'day').startOf('day')
  if (parsed.isBefore(minDate, 'day') || parsed.isAfter(maxDate, 'day')) return null
  return parsed.format('YYYY-MM-DD')
}

export async function getDailyLeaderboard(req: Request, res: Response) {
  try {
    const date = normalizeLeaderboardDate(
      typeof req.query.date === 'string' ? req.query.date : undefined
    )
    if (!date) return sendError(res, 400, 'BAD_REQUEST', 'Invalid date format', req.requestId)

    const cacheKey = `daily:${date}`
    const cached = await getLeaderboardCache(cacheKey)
    if (cached) {
      return sendSuccess(res, cached)
    }

    const viewRows = await queryFromMaterializedView(date)
    const entriesFromView = viewRows?.map((row) => ({
      rank: Number(row.rank),
      userId: row.userId,
      displayName: row.name || row.email.split('@')[0],
      score: Number(row.score),
      timeTaken: Number(row.timeTaken),
    }))

    const entries = entriesFromView ??
      (
        await prisma.dailyScore.findMany({
          where: { date: new Date(date) },
          orderBy: [{ score: 'desc' }, { timeTaken: 'asc' }],
          take: 100,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      ).map((row, idx) => ({
        rank: idx + 1,
        userId: row.userId,
        displayName: row.user.name || row.user.email.split('@')[0],
        score: row.score,
        timeTaken: row.timeTaken,
      }))

    const payload = {
      date,
      count: entries.length,
      source: entriesFromView ? 'materialized_view' : 'live_query',
      entries,
    }

    await setLeaderboardCache(cacheKey, payload, CACHE_TTL_MS)

    sendSuccess(res, payload)
  } catch (error) {
    logError('leaderboard.fetch_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to fetch leaderboard', req.requestId)
  }
}
