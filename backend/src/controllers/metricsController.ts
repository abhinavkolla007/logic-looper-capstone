import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { env } from '../config/env.ts'
import { sendError, sendSuccess } from '../utils/http.ts'
import { getRequestLogMeta, logError } from '../utils/logger.ts'

dayjs.extend(customParseFormat)
const prisma = new PrismaClient()

function isMetricsAuthorized(req: Request): boolean {
  if (!env.metricsApiKey) return true
  const key = req.headers['x-metrics-key']
  return typeof key === 'string' && key === env.metricsApiKey
}

function parseStrictDate(input?: string): string | null {
  const target = input ?? dayjs().format('YYYY-MM-DD')
  const parsed = dayjs(target, 'YYYY-MM-DD', true)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

function parseDays(input?: string): number {
  const raw = input?.trim()
  if (!raw) return 30
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 7 || parsed > 365) return 30
  return parsed
}

export async function getDbWriteMetrics(req: Request, res: Response) {
  try {
    if (!isMetricsAuthorized(req)) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid metrics API key', req.requestId)
    }

    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : ''
    const date = parseStrictDate(typeof req.query.date === 'string' ? req.query.date : undefined)
    if (!userId || !date) {
      return sendError(res, 400, 'BAD_REQUEST', 'userId and valid date are required', req.requestId)
    }

    const start = dayjs(date).startOf('day').toDate()
    const end = dayjs(date).add(1, 'day').startOf('day').toDate()

    const [dailyScoreWrites, achievementWrites, userWrites, userStatsWrites] = await Promise.all([
      prisma.dailyScore.count({
        where: {
          userId,
          updatedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      prisma.achievement.count({
        where: {
          userId,
          updatedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      prisma.user.count({
        where: {
          id: userId,
          updatedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      prisma.userStats.count({
        where: {
          userId,
          updatedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
    ])

    const totalWrites = dailyScoreWrites + achievementWrites + userWrites + userStatsWrites
    sendSuccess(res, {
      date,
      userId,
      totalWrites,
      targetMaxWritesPerDay: 10,
      withinTarget: totalWrites <= 10,
      breakdown: {
        dailyScoreWrites,
        achievementWrites,
        userWrites,
        userStatsWrites,
      },
    })
  } catch (error) {
    logError('metrics.db_writes_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to calculate DB write metrics', req.requestId)
  }
}

export async function getEngagementMetrics(req: Request, res: Response) {
  try {
    if (!isMetricsAuthorized(req)) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid metrics API key', req.requestId)
    }

    const days = parseDays(typeof req.query.days === 'string' ? req.query.days : undefined)
    const startDate = dayjs().subtract(days - 1, 'day').startOf('day')
    const today = dayjs().startOf('day')
    const previousWindowStart = startDate.subtract(days, 'day')

    const [totalUsers, activeTodayRows, recentScores, recentActiveUsers, previousActiveUsers, streakUsers] =
      await Promise.all([
        prisma.user.count(),
        prisma.dailyScore.findMany({
          where: { date: today.toDate() },
          distinct: ['userId'],
          select: { userId: true },
        }),
        prisma.dailyScore.findMany({
          where: {
            date: {
              gte: startDate.toDate(),
              lt: today.add(1, 'day').toDate(),
            },
            solved: true,
          },
          select: { userId: true, timeTaken: true },
        }),
        prisma.dailyScore.findMany({
          where: {
            date: {
              gte: startDate.toDate(),
              lt: today.add(1, 'day').toDate(),
            },
          },
          distinct: ['userId'],
          select: { userId: true },
        }),
        prisma.dailyScore.findMany({
          where: {
            date: {
              gte: previousWindowStart.toDate(),
              lt: startDate.toDate(),
            },
          },
          distinct: ['userId'],
          select: { userId: true },
        }),
        prisma.user.count({
          where: {
            streakCount: {
              gte: 7,
            },
          },
        }),
      ])

    const activeToday = activeTodayRows.length
    const dauRate = totalUsers ? (activeToday / totalUsers) * 100 : 0
    const averageSessionMinutes = recentScores.length
      ? recentScores.reduce((sum, row) => sum + row.timeTaken, 0) / recentScores.length / 60000
      : 0

    const recentSet = new Set(recentActiveUsers.map((row) => row.userId))
    const previousSet = new Set(previousActiveUsers.map((row) => row.userId))
    let retainedUsers = 0
    for (const id of previousSet) {
      if (recentSet.has(id)) retainedUsers += 1
    }
    const retentionRate = previousSet.size ? (retainedUsers / previousSet.size) * 100 : 0
    const streakCompletionRate = totalUsers ? (streakUsers / totalUsers) * 100 : 0

    sendSuccess(res, {
      windowDays: days,
      summary: {
        totalUsers,
        activeToday,
        dauRate,
        averageSessionMinutes,
        retentionRate,
        streakCompletionRate,
      },
      targets: {
        dauRateMin: 40,
        avgSessionMinutesMin: 8,
        retentionRateMin: 25,
        streakCompletionRateMin: 15,
      },
      status: {
        dauRateOk: dauRate >= 40,
        avgSessionMinutesOk: averageSessionMinutes >= 8,
        retentionRateOk: retentionRate >= 25,
        streakCompletionRateOk: streakCompletionRate >= 15,
      },
    })
  } catch (error) {
    logError('metrics.engagement_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to calculate engagement metrics', req.requestId)
  }
}
