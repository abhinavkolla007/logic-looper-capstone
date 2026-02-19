import { describe, expect, it } from 'vitest'
import { buildHeatmapCells, calculateIntensity, splitWeeks } from './heatmapUtils'
import type { DailyActivity } from '../storage/storageManager'

function makeActivity(overrides: Partial<DailyActivity> = {}): DailyActivity {
  return {
    userId: 'u1',
    date: '2026-02-17',
    solved: true,
    score: 80,
    timeTaken: 120000,
    difficulty: 3,
    hintsUsed: 0,
    synced: false,
    ...overrides,
  }
}

describe('heatmapUtils', () => {
  it('calculates combined intensity using score/time/difficulty', () => {
    expect(calculateIntensity(undefined)).toBe(0)
    expect(calculateIntensity(makeActivity({ score: 50, difficulty: 1, timeTaken: 500000 }))).toBe(1)
    expect(calculateIntensity(makeActivity({ score: 72, difficulty: 2, timeTaken: 250000 }))).toBe(2)
    expect(calculateIntensity(makeActivity({ score: 86, difficulty: 4, timeTaken: 180000 }))).toBe(3)
    expect(calculateIntensity(makeActivity({ score: 96, difficulty: 4, timeTaken: 110000 }))).toBe(4)
  })

  it('builds leap-year cells correctly', () => {
    const cells = buildHeatmapCells([], 2024)
    expect(cells.length).toBe(366)
  })

  it('splits cells into weeks', () => {
    const cells = buildHeatmapCells([], 2026)
    const weeks = splitWeeks(cells)
    expect(weeks.length).toBeGreaterThan(50)
    expect(weeks[0].length).toBe(7)
  })
})
