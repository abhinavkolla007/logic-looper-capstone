import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import { isPuzzleLocked } from './streakEngine'
import { storageManager } from '../storage/storageManager'

describe('isPuzzleLocked', () => {
  it('locks future puzzles', async () => {
    const future = dayjs().add(1, 'day').format('YYYY-MM-DD')
    const locked = await isPuzzleLocked('u1', future)
    expect(locked).toBe(true)
  })

  it('unlocks today', async () => {
    const today = dayjs().format('YYYY-MM-DD')
    const locked = await isPuzzleLocked('u1', today)
    expect(locked).toBe(false)
  })

  it('locks unsolved past puzzles and unlocks solved past puzzles', async () => {
    const past = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const getActivity = vi.spyOn(storageManager, 'getActivity')

    getActivity.mockResolvedValueOnce(undefined)
    expect(await isPuzzleLocked('u1', past)).toBe(true)

    getActivity.mockResolvedValueOnce({
      userId: 'u1',
      date: past,
      solved: true,
      score: 100,
      timeTaken: 1000,
      difficulty: 2,
      hintsUsed: 0,
      synced: false,
    })
    expect(await isPuzzleLocked('u1', past)).toBe(false)
  })
})
