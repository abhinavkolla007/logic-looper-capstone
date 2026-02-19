import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { generatePuzzle, validateSolution, type Puzzle } from './puzzleEngine'

describe('puzzleEngine extended', () => {
  it('generates deterministic puzzle for same date', () => {
    const d = new Date('2026-02-17')
    const p1 = generatePuzzle(d)
    const p2 = generatePuzzle(d)
    expect(p1.seed).toBe(p2.seed)
    expect(p1.solution.answer).toBe(p2.solution.answer)
  })

  it('rotates through all puzzle types over days', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 15; i++) {
      const date = dayjs('2026-01-01').add(i, 'day').toDate()
      seen.add(generatePuzzle(date).type)
    }
    expect([...seen].sort()).toEqual(['binary', 'deduction', 'matrix', 'pattern', 'sequence'])
  })

  it('creates valid data payload shapes for each type', () => {
    const byType = new Map<string, Puzzle>()
    for (let i = 0; i < 25; i++) {
      const date = dayjs('2026-02-01').add(i, 'day').toDate()
      const p = generatePuzzle(date)
      byType.set(p.type, p)
    }

    const matrix = byType.get('matrix')
    const sequence = byType.get('sequence')
    const pattern = byType.get('pattern')
    const deduction = byType.get('deduction')
    const binary = byType.get('binary')
    expect(matrix).toBeDefined()
    expect(sequence).toBeDefined()
    expect(pattern).toBeDefined()
    expect(deduction).toBeDefined()
    expect(binary).toBeDefined()

    expect((matrix?.data as { matrix: unknown }).matrix).toBeTruthy()
    expect((sequence?.data as { sequence: unknown }).sequence).toBeTruthy()
    expect((pattern?.data as { options: unknown }).options).toBeTruthy()
    expect((deduction?.data as { clues: unknown }).clues).toBeTruthy()
    expect((binary?.data as { grid: unknown }).grid).toBeTruthy()
  })

  it('validates using object and primitive answers', () => {
    const puzzle = generatePuzzle(new Date('2026-02-17'))
    const goodObj = validateSolution(puzzle, { answer: puzzle.solution.answer })
    const goodPrimitive = validateSolution(puzzle, String(puzzle.solution.answer))
    const bad = validateSolution(puzzle, { answer: 'incorrect' })

    expect(goodObj.valid).toBe(true)
    expect(goodPrimitive.valid).toBe(true)
    expect(goodObj.score).toBeGreaterThan(0)
    expect(bad.valid).toBe(false)
    expect(bad.score).toBe(0)
  })
})
