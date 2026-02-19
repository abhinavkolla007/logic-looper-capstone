import dayjs from 'dayjs'
import type { AppDispatch } from '../features/store'
import { setActivity, setHeatmapData, setPuzzle, setPuzzleStarted, setStreak } from '../features/gameSlice'
import { storageManager } from '../storage/storageManager'
import { calculateStreakFromActivities, ensureTodayActivity } from '../engines/streakEngine'
import { calculateDifficultyAdjustmentFromPerformance, generatePuzzle, type Puzzle } from '../engines/puzzleEngine'
import { flushPendingSyncWithOptions } from './syncManager'

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then((value) => resolve(value))
      .catch((err) => reject(err))
      .finally(() => window.clearTimeout(timer))
  })
}

function formatTodayDate(): string {
  return dayjs().format('YYYY-MM-DD')
}

export async function initializeGameForUser(dispatch: AppDispatch, userId: string): Promise<void> {
  await withTimeout(storageManager.init(), 2000, 'storage init')

  const today = formatTodayDate()
  const recentActivities = await storageManager.getRecentActivities(userId, 14)
  const difficultyAdjustment = calculateDifficultyAdjustmentFromPerformance(recentActivities)

  // Preload current and next 7 days only (8-day window total).
  void storageManager
    .preloadPuzzleWindow(today, 8, (date) => generatePuzzle(new Date(date), { difficultyAdjustment }))
    .catch((error) => {
      console.warn('Puzzle preload failed (non-blocking):', error)
    })

  const puzzle = ((await withTimeout(storageManager.getPuzzle<Puzzle>(today), 1500, 'get puzzle cache')) ??
    generatePuzzle(new Date(today), { difficultyAdjustment })) as Puzzle
  dispatch(setPuzzle(puzzle))

  await ensureTodayActivity(userId, puzzle.difficulty)

  const activities = await storageManager.getYearActivities(userId)
  dispatch(setHeatmapData(activities))
  const streak = calculateStreakFromActivities(activities, today)
  dispatch(setStreak(streak))

  const todaysActivity = await storageManager.getTodayActivity(userId)
  if (todaysActivity?.solved) {
    dispatch(setActivity(todaysActivity))
    dispatch(setPuzzleStarted(false))
  }

  await flushPendingSyncWithOptions(userId, { force: true, batchSize: 5 })
}

export function registerOnlineSyncHandlers(userId: string): () => void {
  const onOnline = () => {
    void flushPendingSyncWithOptions(userId, { force: true, batchSize: 5 })
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => {
          if ('sync' in registration) {
            return (registration as ServiceWorkerRegistration & {
              sync: { register: (tag: string) => Promise<void> }
            }).sync.register('flush-sync')
          }
          return Promise.resolve()
        })
        .catch((error) => {
          console.warn('Background sync registration failed:', error)
        })
    }
  }

  const onServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type !== 'FLUSH_SYNC') return
    void flushPendingSyncWithOptions(userId, { force: true, batchSize: 1 })
  }

  window.addEventListener('online', onOnline)
  navigator.serviceWorker?.addEventListener?.('message', onServiceWorkerMessage as EventListener)
  return () => {
    window.removeEventListener('online', onOnline)
    navigator.serviceWorker?.removeEventListener?.('message', onServiceWorkerMessage as EventListener)
  }
}
