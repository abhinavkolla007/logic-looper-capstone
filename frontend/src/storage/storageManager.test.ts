import { beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import type { DailyActivity } from './storageManager'
import { storageManager } from './storageManager'

type StoreName = 'activities' | 'progress' | 'puzzles' | 'achievements' | 'syncQueue'
type StoredValue = Record<string, unknown>
type UpgradeFn = (db: InMemoryDB, oldVersion: number) => void
type OpenDbOptions = { upgrade?: UpgradeFn }

class InMemoryDB {
  public objectStoreNames = {
    contains: (name: string) => this.stores.has(name as StoreName),
  }

  private stores = new Map<StoreName, Map<string | number, StoredValue>>()

  constructor() {
    this.createObjectStore('activities')
    this.createObjectStore('progress')
    this.createObjectStore('puzzles')
    this.createObjectStore('achievements')
    this.createObjectStore('syncQueue')
  }

  createObjectStore(name: StoreName) {
    this.stores.set(name, new Map())
  }

  deleteObjectStore(name: StoreName) {
    this.stores.delete(name)
  }

  async put(store: StoreName, value: StoredValue) {
    const keyCandidate =
      store === 'syncQueue' ? value.timestamp
      : store === 'puzzles' ? value.date
      : value.id
    if (typeof keyCandidate !== 'string' && typeof keyCandidate !== 'number') {
      throw new Error('Invalid key')
    }
    const key = keyCandidate
    this.stores.get(store)!.set(key, value)
  }

  async add(store: StoreName, value: StoredValue) {
    return this.put(store, value)
  }

  async get(store: StoreName, key: string | number) {
    return this.stores.get(store)!.get(key)
  }

  async getAll(store: StoreName) {
    return [...this.stores.get(store)!.values()]
  }

  async delete(store: StoreName, key: string | number) {
    this.stores.get(store)!.delete(key)
  }
}

const db = new InMemoryDB()
const openDBMock = vi.fn(async (_name: string, _version: number, opts?: OpenDbOptions) => {
  opts?.upgrade?.(db, 3)
  return db
})

vi.mock('idb', () => ({
  openDB: (_name: string, _version: number, opts?: OpenDbOptions) => openDBMock(_name, _version, opts),
}))

const activity: DailyActivity = {
  userId: 'u1',
  date: '2026-02-17',
  solved: true,
  score: 100,
  timeTaken: 60,
  difficulty: 2,
  hintsUsed: 1,
  synced: false,
}

describe('storageManager', () => {
  beforeEach(async () => {
    localStorage.clear()
    openDBMock.mockClear()
    Reflect.set(storageManager as object, 'db', null)
    db.deleteObjectStore('activities')
    db.deleteObjectStore('progress')
    db.deleteObjectStore('puzzles')
    db.deleteObjectStore('achievements')
    db.deleteObjectStore('syncQueue')
    db.createObjectStore('activities')
    db.createObjectStore('progress')
    db.createObjectStore('puzzles')
    db.createObjectStore('achievements')
    db.createObjectStore('syncQueue')
    await storageManager.init()
  })

  it('saves, reads and filters activities', async () => {
    await storageManager.saveActivity(activity)
    await storageManager.saveActivity({ ...activity, date: '2025-02-17', userId: 'u1' })
    await storageManager.saveActivity({ ...activity, date: '2026-02-18', userId: 'u2' })

    const got = await storageManager.getActivity('u1', '2026-02-17')
    const year = await storageManager.getActivitiesByYear('u1', 2026)
    const all = await storageManager.getAllActivities()

    expect(got?.score).toBe(100)
    expect(year).toHaveLength(1)
    expect(all).toHaveLength(3)
  })

  it('marks activity as synced and gets today activity', async () => {
    const today = dayjs().format('YYYY-MM-DD')
    await storageManager.saveActivity({ ...activity, date: today })
    await storageManager.markActivitySynced('u1', today)

    const got = await storageManager.getTodayActivity('u1')
    expect(got?.synced).toBe(true)
  })

  it('saves and loads progress, then clears it', async () => {
    await storageManager.saveProgress({
      userId: 'u1',
      date: '2026-02-17',
      answer: 'ABC',
      elapsedTime: 12,
      hintsUsed: 1,
      puzzleStarted: true,
    })

    const progress = await storageManager.getProgress('u1', '2026-02-17')
    expect(progress).toEqual({
      answer: 'ABC',
      elapsedTime: 12,
      hintsUsed: 1,
      puzzleStarted: true,
      playMode: 'standard',
    })

    await storageManager.clearProgress('u1', '2026-02-17')
    expect(await storageManager.getProgress('u1', '2026-02-17')).toBeUndefined()
  })

  it('drops invalid progress payloads', async () => {
    await db.put('progress', {
      id: 'u1:2026-02-17',
      userId: 'u1',
      date: '2026-02-17',
      payload: '{not-json',
      encoding: 'plain',
      updatedAt: new Date().toISOString(),
    })

    expect(await storageManager.getProgress('u1', '2026-02-17')).toBeUndefined()
    expect(await db.get('progress', 'u1:2026-02-17')).toBeUndefined()
  })

  it('saves puzzle cache and preloads missing dates', async () => {
    await storageManager.savePuzzle('2026-02-17', { id: 'p1' })
    const puzzle = await storageManager.getPuzzle<{ id: string }>('2026-02-17')
    expect(puzzle?.id).toBe('p1')

    const generator = vi.fn((date: string) => ({ id: date }))
    await storageManager.preloadPuzzleWindow('2026-02-17', 3, generator)

    expect(generator).toHaveBeenCalledTimes(2)
    expect(await storageManager.getPuzzle('2026-02-18')).toEqual({ id: '2026-02-18' })
  })

  it('warms a rolling puzzle cache while skipping existing rows', async () => {
    await storageManager.savePuzzle('2026-02-17', { id: 'existing' })
    const generator = vi.fn((date: string) => ({ id: `gen-${date}` }))

    await storageManager.ensureRollingPuzzleCache('2026-02-17', 4, generator, { yieldEvery: 1 })

    expect(generator).toHaveBeenCalledTimes(3)
    expect(await storageManager.getPuzzle('2026-02-17')).toEqual({ id: 'existing' })
    expect(await storageManager.getPuzzle('2026-02-20')).toEqual({ id: 'gen-2026-02-20' })
  })

  it('drops invalid puzzle payloads', async () => {
    await db.put('puzzles', {
      date: '2026-02-17',
      payload: '{broken',
      encoding: 'plain',
      updatedAt: new Date().toISOString(),
    })

    expect(await storageManager.getPuzzle('2026-02-17')).toBeUndefined()
    expect(await db.get('puzzles', '2026-02-17')).toBeUndefined()
  })

  it('stores and syncs achievements using local user context', async () => {
    localStorage.setItem('userId', 'u1')
    await storageManager.saveAchievement('streak-7', '7 Day Streak')

    const all = await storageManager.getAchievements('u1')
    const unsynced = await storageManager.getUnsyncedAchievements('u1')
    expect(all).toHaveLength(1)
    expect(unsynced).toHaveLength(1)

    await storageManager.markAchievementSynced('u1', 'streak-7')
    expect(await storageManager.getUnsyncedAchievements('u1')).toHaveLength(0)
  })

  it('queues sync actions and marks processed items', async () => {
    await storageManager.addToSyncQueue('daily_sync', { date: '2026-02-17' })
    const queue = await storageManager.getSyncQueue()
    expect(queue).toHaveLength(1)

    await storageManager.markSynced(queue[0].timestamp)
    expect(await storageManager.getSyncQueue()).toHaveLength(0)
  })

  it('clears old activity rows outside retention window', async () => {
    const oldDate = dayjs().subtract(400, 'day').format('YYYY-MM-DD')
    await storageManager.saveActivity({ ...activity, date: oldDate })
    await storageManager.saveActivity({ ...activity, date: dayjs().format('YYYY-MM-DD') })

    await storageManager.clearOldData(365)
    const all = await storageManager.getAllActivities()

    expect(all).toHaveLength(1)
    expect(all[0].date).not.toBe(oldDate)
  })
})
