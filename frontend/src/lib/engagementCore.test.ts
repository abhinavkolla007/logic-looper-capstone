import { describe, expect, it } from 'vitest'
import {
  buildHeatmapCellsForYear,
  calculateStreakFromSolvedDates,
  getDaysInYear,
  splitIntoWeeks,
} from './engagementCore'

describe('engagementCore', () => {
  it('handles leap and non-leap year day counts', () => {
    expect(getDaysInYear(2024)).toBe(366)
    expect(getDaysInYear(2026)).toBe(365)
  })

  it('builds year cells deterministically from local dates', () => {
    const cells = buildHeatmapCellsForYear(
      [
        { date: '2026-01-01', solved: true, score: 72, timeTaken: 230000, difficulty: 2 },
        { date: '2026-12-31', solved: true, score: 99, timeTaken: 60000, difficulty: 5 },
      ],
      2026
    )
    expect(cells.length).toBe(365)
    expect(cells[0].date).toBe('2026-01-01')
    expect(cells[cells.length - 1].date).toBe('2026-12-31')
    expect(cells[0].intensity).toBeGreaterThan(0)
    expect(cells[cells.length - 1].intensity).toBe(4)
  })

  it('calculates streak across consecutive local dates', () => {
    const streak = calculateStreakFromSolvedDates(
      ['2026-02-16', '2026-02-17', '2026-02-18'],
      '2026-02-18'
    )
    expect(streak.current).toBe(3)
    expect(streak.longest).toBe(3)
    expect(streak.isActiveToday).toBe(true)
  })

  it('resets streak when there is a date gap', () => {
    const streak = calculateStreakFromSolvedDates(
      ['2026-02-14', '2026-02-16', '2026-02-18'],
      '2026-02-18'
    )
    expect(streak.current).toBe(1)
    expect(streak.longest).toBe(1)
  })

  it('splits long series into week columns', () => {
    const weeks = splitIntoWeeks(Array.from({ length: 366 }, (_, i) => i), 7)
    expect(weeks.length).toBe(53)
    expect(weeks[0].length).toBe(7)
  })
})
