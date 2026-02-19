import { describe, expect, it } from 'vitest'
import { generatePuzzle, validateSolution } from './puzzleEngine'

describe('puzzleEngine', () => {
  it('generates same puzzle for same date', () => {
    const d = new Date('2026-02-16')
    const a = generatePuzzle(d)
    const b = generatePuzzle(d)

    expect(a.type).toBe(b.type)
    expect(a.difficulty).toBe(b.difficulty)
    expect(a.data).toEqual(b.data)
    expect(a.solution).toEqual(b.solution)
  })

  it('accepts correct answer and rejects incorrect answer', () => {
    const puzzle = generatePuzzle(new Date('2026-02-17'))
    const ok = validateSolution(puzzle, { answer: puzzle.solution.answer })
    const bad = validateSolution(puzzle, { answer: 'wrong-answer' })

    expect(ok.valid).toBe(true)
    expect(ok.score).toBeGreaterThan(0)
    expect(bad.valid).toBe(false)
    expect(bad.score).toBe(0)
  })
})
