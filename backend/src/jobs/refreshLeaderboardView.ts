import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function refreshLeaderboardView(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_leaderboard_mv')
    console.log('daily_leaderboard_mv refreshed (concurrently)')
  } catch (error) {
    console.warn('Concurrent refresh failed, retrying non-concurrent refresh')
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW daily_leaderboard_mv')
    console.log('daily_leaderboard_mv refreshed (non-concurrent)')
    if (error instanceof Error) {
      console.warn(`Concurrent refresh error: ${error.message}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

void refreshLeaderboardView()
