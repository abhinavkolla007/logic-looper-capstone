import { openDB, DBSchema, IDBPDatabase } from 'idb'
import dayjs from 'dayjs'

type PayloadEncoding = 'plain' | 'gzip-base64'

export interface DailyActivity {
  id?: string
  userId: string
  date: string
  solved: boolean
  score: number
  timeTaken: number
  difficulty: number
  hintsUsed: number
  synced: boolean
  completedAt?: string
}

type ProgressPayload = {
  answer: string
  elapsedTime: number
  hintsUsed: number
  puzzleStarted: boolean
  playMode?: 'standard' | 'timed'
}

export interface StorageSchema extends DBSchema {
  activities: {
    key: string
    value: DailyActivity
  }
  progress: {
    key: string
    value: {
      id: string
      userId: string
      date: string
      payload: string
      encoding: PayloadEncoding
      updatedAt: string
    }
  }
  puzzles: {
    key: string
    value: {
      date: string
      payload: string
      encoding: PayloadEncoding
      updatedAt: string
    }
  }
  achievements: {
    key: string
    value: {
      id: string
      userId: string
      achievementId: string
      name: string
      unlockedAt: string
      synced: boolean
    }
  }
  syncQueue: {
    key: number
    value: {
      timestamp: number
      action: string
      data: unknown
      synced: boolean
    }
  }
}

class StorageManager {
  private db: IDBPDatabase<StorageSchema> | null = null
  private readonly dbName = 'logic-looper'
  private readonly dbVersion = 3

  private activityKey(userId: string, date: string): string {
    return `${userId}:${date}`
  }

  private normalizeDate(input: string): string | null {
    const parsed = dayjs(input)
    if (!parsed.isValid()) return null
    return parsed.format('YYYY-MM-DD')
  }

  private pickPreferredActivity(current: DailyActivity | undefined, incoming: DailyActivity): DailyActivity {
    if (!current) return incoming
    if (incoming.solved && !current.solved) return incoming
    if (incoming.solved === current.solved && incoming.score > current.score) return incoming
    return current
  }

  private async normalizeLegacyActivities(): Promise<void> {
    const rows = await this.db!.getAll('activities')
    if (rows.length === 0) return

    const normalized = new Map<string, DailyActivity>()
    let needsRewrite = false

    for (const row of rows) {
      if (!row.userId) {
        needsRewrite = true
        continue
      }

      const normalizedDate = this.normalizeDate(row.date)
      if (!normalizedDate) {
        needsRewrite = true
        continue
      }

      const key = this.activityKey(row.userId, normalizedDate)
      const candidate: DailyActivity = {
        ...row,
        id: key,
        date: normalizedDate,
      }

      if (row.id !== key || row.date !== normalizedDate) {
        needsRewrite = true
      }

      normalized.set(key, this.pickPreferredActivity(normalized.get(key), candidate))
    }

    if (!needsRewrite && normalized.size === rows.length) return

    const tx = this.db!.transaction('activities', 'readwrite')
    await tx.store.clear()
    for (const value of normalized.values()) {
      await tx.store.put(value)
    }
    await tx.done
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }

  private async encodePayload(data: unknown): Promise<{ payload: string; encoding: PayloadEncoding }> {
    const json = JSON.stringify(data)
    if (typeof CompressionStream === 'undefined') {
      return { payload: json, encoding: 'plain' }
    }

    try {
      const input = new TextEncoder().encode(json)
      const cs = new CompressionStream('gzip')
      const writer = cs.writable.getWriter()
      await writer.write(input)
      await writer.close()
      const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer())
      return { payload: this.bytesToBase64(compressed), encoding: 'gzip-base64' }
    } catch {
      return { payload: json, encoding: 'plain' }
    }
  }

  private async decodePayload<T>(payload: string, encoding: PayloadEncoding): Promise<T> {
    if (encoding === 'plain' || typeof DecompressionStream === 'undefined') {
      return JSON.parse(payload) as T
    }

    try {
      const bytes = this.base64ToBytes(payload)
      const ds = new DecompressionStream('gzip')
      const writer = ds.writable.getWriter()
      const writeBytes = new Uint8Array(bytes)
      await writer.write(writeBytes)
      await writer.close()
      const decompressed = await new Response(ds.readable).text()
      return JSON.parse(decompressed) as T
    } catch {
      return JSON.parse(payload) as T
    }
  }

  async init(): Promise<void> {
    this.db = await openDB<StorageSchema>(this.dbName, this.dbVersion, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('activities')) {
          db.createObjectStore('activities', { keyPath: 'id' })
        } else if (oldVersion < 2) {
          db.deleteObjectStore('activities')
          db.createObjectStore('activities', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'id' })
        } else if (oldVersion < 3) {
          db.deleteObjectStore('progress')
          db.createObjectStore('progress', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('puzzles')) {
          db.createObjectStore('puzzles', { keyPath: 'date' })
        }
        if (!db.objectStoreNames.contains('achievements')) {
          db.createObjectStore('achievements', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'timestamp' })
        }
      },
    })

    await this.normalizeLegacyActivities()
  }

  async saveActivity(activity: DailyActivity): Promise<void> {
    if (!this.db) await this.init()
    const withKey: DailyActivity = {
      ...activity,
      id: this.activityKey(activity.userId, activity.date),
    }
    await this.db!.put('activities', withKey)
  }

  async getActivity(userId: string, date: string): Promise<DailyActivity | undefined> {
    if (!this.db) await this.init()
    const normalizedDate = this.normalizeDate(date) ?? date
    const key = this.activityKey(userId, normalizedDate)
    const all = await this.db!.getAll('activities')
    let candidate: DailyActivity | undefined
    const direct = await this.db!.get('activities', key)
    if (direct) {
      candidate = this.pickPreferredActivity(candidate, {
        ...direct,
        date: this.normalizeDate(direct.date) ?? direct.date,
      })
    }

    // Legacy fallback: if duplicate/non-canonical rows exist for same user+date,
    // always prefer solved/high-score row to avoid replay/streak drift.
    for (const row of all) {
      if (row.userId !== userId) continue
      if (this.normalizeDate(row.date) !== normalizedDate) continue
      candidate = this.pickPreferredActivity(candidate, {
        ...row,
        date: normalizedDate,
        id: this.activityKey(userId, normalizedDate),
      })
    }

    return candidate
  }

  async getTodayActivity(userId: string): Promise<DailyActivity | undefined> {
    const today = dayjs().format('YYYY-MM-DD')
    return this.getActivity(userId, today)
  }

  async getAllActivities(): Promise<DailyActivity[]> {
    if (!this.db) await this.init()
    return this.db!.getAll('activities')
  }

  async getYearActivities(userId: string): Promise<DailyActivity[]> {
    return this.getActivitiesByYear(userId, dayjs().year())
  }

  async getActivitiesByYear(userId: string, year: number): Promise<DailyActivity[]> {
    if (!this.db) await this.init()
    const activities = await this.db!.getAll('activities')
    const deduped = new Map<string, DailyActivity>()

    for (const activity of activities) {
      if (activity.userId !== userId) continue
      const normalizedDate = this.normalizeDate(activity.date)
      if (!normalizedDate) continue
      if (dayjs(normalizedDate).year() !== year) continue
      const key = this.activityKey(userId, normalizedDate)
      const normalized: DailyActivity = {
        ...activity,
        id: key,
        date: normalizedDate,
      }
      deduped.set(key, this.pickPreferredActivity(deduped.get(key), normalized))
    }

    return [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  async getRecentActivities(userId: string, days: number = 14): Promise<DailyActivity[]> {
    if (!this.db) await this.init()
    const cutoff = dayjs().subtract(days, 'day').format('YYYY-MM-DD')
    const activities = await this.db!.getAll('activities')
    return activities
      .filter((activity) => activity.userId === userId && activity.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async markActivitySynced(userId: string, date: string): Promise<void> {
    if (!this.db) await this.init()
    const activity = await this.getActivity(userId, date)
    if (!activity) return
    activity.synced = true
    await this.saveActivity(activity)
  }

  async saveProgress(progress: {
    userId: string
    date: string
    answer: string
    elapsedTime: number
    hintsUsed: number
    puzzleStarted: boolean
    playMode?: 'standard' | 'timed'
  }): Promise<void> {
    if (!this.db) await this.init()
    const id = this.activityKey(progress.userId, progress.date)
    const encoded = await this.encodePayload({
      answer: progress.answer,
      elapsedTime: progress.elapsedTime,
      hintsUsed: progress.hintsUsed,
      puzzleStarted: progress.puzzleStarted,
      playMode: progress.playMode || 'standard',
    })

    await this.db!.put('progress', {
      id,
      userId: progress.userId,
      date: progress.date,
      payload: encoded.payload,
      encoding: encoded.encoding,
      updatedAt: new Date().toISOString(),
    })
  }

  async getProgress(userId: string, date: string): Promise<ProgressPayload | undefined> {
    if (!this.db) await this.init()
    const key = this.activityKey(userId, date)
    const row = await this.db!.get('progress', key)
    if (!row) return undefined
    try {
      return await this.decodePayload<ProgressPayload>(row.payload, row.encoding)
    } catch {
      await this.db!.delete('progress', key)
      return undefined
    }
  }

  async clearProgress(userId: string, date: string): Promise<void> {
    if (!this.db) await this.init()
    await this.db!.delete('progress', this.activityKey(userId, date))
  }

  async savePuzzle(date: string, puzzle: unknown): Promise<void> {
    if (!this.db) await this.init()
    const encoded = await this.encodePayload(puzzle)
    await this.db!.put('puzzles', {
      date,
      payload: encoded.payload,
      encoding: encoded.encoding,
      updatedAt: new Date().toISOString(),
    })
  }

  async getPuzzle<T = unknown>(date: string): Promise<T | undefined> {
    if (!this.db) await this.init()
    const row = await this.db!.get('puzzles', date)
    if (!row) return undefined
    try {
      return await this.decodePayload<T>(row.payload, row.encoding)
    } catch {
      await this.db!.delete('puzzles', date)
      return undefined
    }
  }

  async preloadPuzzleWindow(
    startDate: string,
    days: number,
    generator: (date: string) => unknown
  ): Promise<void> {
    return this.ensureRollingPuzzleCache(startDate, days, generator)
  }

  async ensureRollingPuzzleCache(
    startDate: string,
    days: number,
    generator: (date: string) => unknown,
    options?: { yieldEvery?: number }
  ): Promise<void> {
    if (!this.db) await this.init()
    const totalDays = Math.max(0, Math.floor(days))
    const yieldEvery = Math.max(1, options?.yieldEvery ?? 30)
    for (let i = 0; i < totalDays; i++) {
      if (i > 0 && i % yieldEvery === 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), 0)
        })
      }
      const date = dayjs(startDate).add(i, 'day').format('YYYY-MM-DD')
      const existing = await this.db!.get('puzzles', date)
      if (!existing) {
        await this.savePuzzle(date, generator(date))
      }
    }
  }

  async saveAchievement(id: string, name: string): Promise<void> {
    if (!this.db) await this.init()
    const userId = localStorage.getItem('userId') || localStorage.getItem('guestId') || 'guest'
    const key = this.activityKey(userId, id)
    await this.db!.put('achievements', {
      id: key,
      userId,
      achievementId: id,
      name,
      unlockedAt: new Date().toISOString(),
      synced: false,
    })
  }

  async getAchievements(userId?: string) {
    if (!this.db) await this.init()
    const rows = await this.db!.getAll('achievements')
    if (!userId) return rows
    return rows.filter((row) => row.userId === userId)
  }

  async getUnsyncedAchievements(userId: string) {
    const rows = await this.getAchievements(userId)
    return rows.filter((row) => !row.synced)
  }

  async markAchievementSynced(userId: string, achievementId: string): Promise<void> {
    if (!this.db) await this.init()
    const key = this.activityKey(userId, achievementId)
    const row = await this.db!.get('achievements', key)
    if (!row) return
    row.synced = true
    await this.db!.put('achievements', row)
  }

  async addToSyncQueue(action: string, data: unknown): Promise<void> {
    if (!this.db) await this.init()
    await this.db!.add('syncQueue', {
      timestamp: Date.now(),
      action,
      data,
      synced: false,
    })
  }

  async getSyncQueue() {
    if (!this.db) await this.init()
    const items = await this.db!.getAll('syncQueue')
    return items.filter((item) => !item.synced)
  }

  async markSynced(timestamp: number): Promise<void> {
    if (!this.db) await this.init()
    const item = await this.db!.get('syncQueue', timestamp)
    if (!item) return
    item.synced = true
    await this.db!.put('syncQueue', item)
  }

  async clearOldData(daysToKeep: number = 365): Promise<void> {
    if (!this.db) await this.init()
    const cutoff = dayjs().subtract(daysToKeep, 'day').format('YYYY-MM-DD')
    const activities = await this.getAllActivities()
    for (const activity of activities) {
      if (activity.date < cutoff) {
        await this.db!.delete('activities', activity.id || this.activityKey(activity.userId, activity.date))
      }
    }
  }
}

export const storageManager = new StorageManager()
