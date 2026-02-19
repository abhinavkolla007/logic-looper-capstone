import dayjs from 'dayjs'
import { storageManager, type DailyActivity } from '../storage/storageManager'
import { calculateStreakFromSolvedDates } from '../lib/engagementCore'

export interface StreakInfo {
  current: number
  longest: number
  lastPlayedDate: string | null
  isActiveToday: boolean
}

export function calculateStreakFromActivities(
  activities: DailyActivity[],
  todayDate: string = dayjs().format('YYYY-MM-DD')
): StreakInfo {
  const solvedDates = activities
    .filter((a) => a.solved)
    .map((a) => dayjs(a.date).format('YYYY-MM-DD'))
  return calculateStreakFromSolvedDates(solvedDates, todayDate)
}

export async function calculateStreak(userId: string): Promise<StreakInfo> {
  const activities = await storageManager.getYearActivities(userId)
  return calculateStreakFromActivities(activities)
}

export async function checkStreakBreak(userId: string): Promise<boolean> {
  const streak = await calculateStreak(userId)
  if (!streak.lastPlayedDate) return false

  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  return streak.lastPlayedDate < yesterday
}

export async function ensureTodayActivity(userId: string, difficulty: number = 0): Promise<void> {
  const today = dayjs().format('YYYY-MM-DD')
  const activity = await storageManager.getActivity(userId, today)

  if (!activity) {
    await storageManager.saveActivity({
      userId,
      date: today,
      solved: false,
      score: 0,
      timeTaken: 0,
      difficulty,
      hintsUsed: 0,
      synced: false,
    })
  }
}

export async function isPuzzleLocked(userId: string, date: string): Promise<boolean> {
  const today = dayjs().format('YYYY-MM-DD')

  if (date > today) return true
  if (date === today) return false

  const activity = await storageManager.getActivity(userId, date)
  return !activity?.solved
}

export async function completeActivity(
  userId: string,
  date: string,
  score: number,
  timeTaken: number,
  difficulty: number,
  hintsUsed: number
): Promise<void> {
  const activity: DailyActivity = {
    userId,
    date,
    solved: true,
    score,
    timeTaken,
    difficulty,
    hintsUsed,
    synced: false,
    completedAt: new Date().toISOString(),
  }

  await storageManager.saveActivity(activity)

  const streak = await calculateStreak(userId)
  await checkMilestones(userId, streak.current)
}

export async function syncMilestonesForStreak(userId: string, currentStreak: number): Promise<void> {
  await checkMilestones(userId, currentStreak)
}

async function checkMilestones(userId: string, currentStreak: number): Promise<void> {
  const milestones = [7, 30, 100, 365]

  for (const milestone of milestones) {
    if (currentStreak === milestone) {
      const achievementId = `milestone_${milestone}`
      const existing = (await storageManager.getAchievements(userId)).find(
        (a) => (a as { achievementId: string }).achievementId === achievementId
      )

      if (!existing) {
        await storageManager.saveAchievement(achievementId, `${milestone}-Day Streak`)
      }
    }
  }
}
