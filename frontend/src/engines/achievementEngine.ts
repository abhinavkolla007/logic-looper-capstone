import type { DailyActivity } from '../storage/storageManager'
import { storageManager } from '../storage/storageManager'

export type AchievementDefinition = {
  id: string
  name: string
  description: string
  target: number
  progress: (stats: AchievementStats) => number
}

export type AchievementStatus = AchievementDefinition & {
  value: number
  unlocked: boolean
}

type AchievementStats = {
  solvedCount: number
  perfectCount: number
  hintlessSolvedCount: number
  fastestSolveMs: number | null
  currentStreak: number
}

const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    id: 'first_solve',
    name: 'First Solve',
    description: 'Solve your first daily puzzle.',
    target: 1,
    progress: (stats) => stats.solvedCount,
  },
  {
    id: 'perfect_day',
    name: 'Perfect Day',
    description: 'Score 100+ on any puzzle.',
    target: 1,
    progress: (stats) => stats.perfectCount,
  },
  {
    id: 'speed_runner',
    name: 'Speed Runner',
    description: 'Solve a puzzle in 60 seconds or less.',
    target: 1,
    progress: (stats) => (stats.fastestSolveMs !== null && stats.fastestSolveMs <= 60_000 ? 1 : 0),
  },
  {
    id: 'hintless_solver',
    name: 'Hintless Solver',
    description: 'Solve any puzzle with zero hints.',
    target: 1,
    progress: (stats) => stats.hintlessSolvedCount,
  },
  {
    id: 'solver_30',
    name: '30 Solves',
    description: 'Complete 30 daily puzzles.',
    target: 30,
    progress: (stats) => stats.solvedCount,
  },
  {
    id: 'milestone_7',
    name: '7-Day Streak',
    description: 'Maintain a 7-day streak.',
    target: 7,
    progress: (stats) => stats.currentStreak,
  },
  {
    id: 'milestone_30',
    name: '30-Day Streak',
    description: 'Maintain a 30-day streak.',
    target: 30,
    progress: (stats) => stats.currentStreak,
  },
  {
    id: 'milestone_100',
    name: '100-Day Streak',
    description: 'Maintain a 100-day streak.',
    target: 100,
    progress: (stats) => stats.currentStreak,
  },
  {
    id: 'milestone_365',
    name: '365-Day Streak',
    description: 'Maintain a 365-day streak.',
    target: 365,
    progress: (stats) => stats.currentStreak,
  },
]

function buildAchievementStats(activities: DailyActivity[], currentStreak: number): AchievementStats {
  const solved = activities.filter((activity) => activity.solved)
  const fastestSolveMs = solved.length ? Math.min(...solved.map((activity) => activity.timeTaken)) : null
  return {
    solvedCount: solved.length,
    perfectCount: solved.filter((activity) => activity.score >= 100).length,
    hintlessSolvedCount: solved.filter((activity) => activity.hintsUsed === 0).length,
    fastestSolveMs,
    currentStreak,
  }
}

export function getAchievementCatalog(): AchievementDefinition[] {
  return ACHIEVEMENT_CATALOG
}

export function getAchievementStatuses(
  activities: DailyActivity[],
  currentStreak: number,
  persistedIds: Set<string> = new Set()
): AchievementStatus[] {
  const stats = buildAchievementStats(activities, currentStreak)
  return ACHIEVEMENT_CATALOG.map((achievement) => {
    const value = Math.min(achievement.target, Math.max(0, achievement.progress(stats)))
    const unlocked = persistedIds.has(achievement.id) || value >= achievement.target
    return {
      ...achievement,
      value,
      unlocked,
    }
  })
}

export async function unlockEligibleAchievements(
  userId: string,
  activities: DailyActivity[],
  currentStreak: number
): Promise<AchievementDefinition[]> {
  const existingRows = await storageManager.getAchievements(userId)
  const existingIds = new Set(existingRows.map((row) => row.achievementId))
  const statuses = getAchievementStatuses(activities, currentStreak, existingIds)

  const newlyUnlocked: AchievementDefinition[] = []
  for (const status of statuses) {
    if (existingIds.has(status.id) || !status.unlocked) continue
    await storageManager.saveAchievement(status.id, status.name)
    existingIds.add(status.id)
    newlyUnlocked.push(status)
  }

  return newlyUnlocked
}

