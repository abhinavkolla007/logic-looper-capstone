import CryptoJS from 'crypto-js'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import dayOfYear from 'dayjs/plugin/dayOfYear'
import { env } from '../utils/env'

dayjs.extend(dayOfYear)
dayjs.extend(utc)

const SEED_NAMESPACE = env.puzzleSeedNamespace

export type PuzzleType = 'matrix' | 'sequence' | 'pattern' | 'deduction' | 'binary'

export interface Puzzle {
  id: string
  type: PuzzleType
  date: string
  seed: string
  difficulty: number
  data: unknown
  solution: { answer: string }
}

export interface AdaptivePerformanceSample {
  solved: boolean
  score: number
  timeTaken: number
}

export interface PuzzleGenerationOptions {
  difficultyAdjustment?: number
}

type GeneratorOutput = {
  data: unknown
  solution: { answer: string }
}

export function calculateDifficultyAdjustmentFromPerformance(
  recentActivities: AdaptivePerformanceSample[]
): number {
  const solved = recentActivities.filter((activity) => activity.solved)
  if (solved.length < 3) return 0

  const avgScore = solved.reduce((sum, activity) => sum + activity.score, 0) / solved.length
  const avgTimeMs = solved.reduce((sum, activity) => sum + activity.timeTaken, 0) / solved.length

  if (avgScore >= 90 && avgTimeMs <= 90_000) return 1
  if (avgScore <= 65 || avgTimeMs >= 300_000) return -1
  return 0
}

export function generatePuzzle(date: Date = new Date(), options: PuzzleGenerationOptions = {}): Puzzle {
  const dateStr = dayjs(date).format('YYYY-MM-DD')
  const seed = generateSeed(dateStr)
  const dayNum = dayjs(date).dayOfYear()
  const type = getPuzzleType(dayNum)
  const difficulty = calculateDifficulty(dayNum, options.difficultyAdjustment ?? 0)
  const generated = generateByType(type, seed, difficulty)

  return {
    id: `puzzle-${dateStr}`,
    type,
    date: dateStr,
    seed,
    difficulty,
    data: generated.data,
    solution: generated.solution,
  }
}

function generateSeed(dateStr: string): string {
  return CryptoJS.SHA256(`${SEED_NAMESPACE}:${dateStr}`).toString()
}

function getPuzzleType(dayNum: number): PuzzleType {
  const types: PuzzleType[] = ['matrix', 'sequence', 'pattern', 'deduction', 'binary']
  return types[(dayNum - 1) % types.length]
}

function calculateDifficulty(dayNum: number, adjustment: number): number {
  const base = 1 + Math.floor((dayNum - 1) / 73)
  return Math.min(5, Math.max(1, base + ((dayNum % 3) - 1) + adjustment))
}

function generateByType(type: PuzzleType, seed: string, difficulty: number): GeneratorOutput {
  const rng = seededRandom(parseInt(seed.substring(0, 8), 16))

  switch (type) {
    case 'matrix':
      return generateMatrix(rng, difficulty)
    case 'sequence':
      return generateSequence(rng, difficulty)
    case 'pattern':
      return generatePattern(rng, difficulty)
    case 'deduction':
      return generateDeduction(rng, difficulty)
    case 'binary':
      return generateBinary(rng, difficulty)
  }
}

function seededRandom(seed: number) {
  let mW = seed
  let mZ = 987654321
  const mask = 0xffffffff

  return function next() {
    mZ = (36969 * (mZ & 65535) + (mZ >> 16)) & mask
    mW = (18000 * (mW & 65535) + (mW >> 16)) & mask
    let result = ((mZ << 16) + (mW & 65535)) >>> 0
    result /= 4294967296
    return result
  }
}

function generateMatrix(rng: () => number, difficulty: number): GeneratorOutput {
  const size = difficulty >= 4 ? 4 : 3
  const start = Math.floor(rng() * 6) + 1
  const step = Math.floor(rng() * 4) + 1
  const matrix: number[] = []

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      matrix.push(start + r * step + c * (step + 1))
    }
  }

  const missing = matrix.length - 1
  const answer = matrix[missing]
  matrix[missing] = 0

  return {
    data: { size, matrix, missing },
    solution: { answer: String(answer) },
  }
}

function generateSequence(rng: () => number, difficulty: number): GeneratorOutput {
  const length = 5 + difficulty
  const start = Math.floor(rng() * 20) + 1
  const step = Math.floor(rng() * 6) + 1
  const series: number[] = []

  for (let i = 0; i < length; i++) {
    series.push(start + i * step)
  }

  const answer = series[length - 1]
  return {
    data: { sequence: series.slice(0, -1), nextIndex: length - 1 },
    solution: { answer: String(answer) },
  }
}

function generatePattern(rng: () => number, difficulty: number): GeneratorOutput {
  const shapes = ['o', 's', 't', 'd', 'x']
  const cycle = 2 + Math.floor(rng() * 2)
  const length = 4 + difficulty
  const start = Math.floor(rng() * shapes.length)
  const pattern: string[] = []

  for (let i = 0; i < length; i++) {
    pattern.push(shapes[(start + (i % cycle)) % shapes.length])
  }

  const answer = pattern[length - 1]
  pattern[length - 1] = '?'

  return {
    data: { pattern, missing: length - 1, options: shapes },
    solution: { answer },
  }
}

function generateDeduction(rng: () => number, difficulty: number): GeneratorOutput {
  const people = ['Alice', 'Bob', 'Carol', 'Dave']
  const items = ['Red', 'Blue', 'Green', 'Yellow']
  const shuffledPeople = shuffleDeterministic(people, rng)
  const shuffledItems = shuffleDeterministic(items, rng)

  const mapping = new Map<string, string>()
  for (let i = 0; i < shuffledPeople.length; i++) {
    mapping.set(shuffledPeople[i], shuffledItems[i])
  }

  const targetItem = shuffledItems[Math.floor(rng() * shuffledItems.length)]
  const answer = [...mapping.entries()].find(([, item]) => item === targetItem)?.[0] ?? shuffledPeople[0]
  const clues = [...mapping.entries()].map(([person, item]) =>
    difficulty >= 4 ? `${person} definitely has ${item}` : `${person} has ${item}`
  )

  return {
    data: { clues, question: `Who has ${targetItem}?`, options: shuffledPeople },
    solution: { answer },
  }
}

function shuffleDeterministic<T>(source: T[], rng: () => number): T[] {
  const arr = [...source]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function generateBinary(rng: () => number, difficulty: number): GeneratorOutput {
  const size = difficulty >= 4 ? 5 : 4
  const grid: number[] = []

  for (let i = 0; i < size * size; i++) {
    grid.push(Math.floor(rng() * 2))
  }

  // Last value equals parity of first row.
  const firstRow = grid.slice(0, size)
  const answer = firstRow.reduce((acc, n) => acc ^ n, 0)
  grid[size * size - 1] = -1

  return {
    data: { size, grid, rule: 'Use XOR parity of first row for missing value' },
    solution: { answer: String(answer) },
  }
}

export function validateSolution(
  puzzle: Puzzle,
  userSolution: unknown
): { valid: boolean; score: number } {
  const userAnswer =
    typeof userSolution === 'object' && userSolution !== null && 'answer' in userSolution
      ? String((userSolution as { answer: unknown }).answer).trim().toLowerCase()
      : String(userSolution).trim().toLowerCase()

  const expectedAnswer = String(puzzle.solution.answer).trim().toLowerCase()
  const valid = userAnswer === expectedAnswer
  const score = valid ? Math.max(60, 120 - puzzle.difficulty * 10) : 0
  return { valid, score }
}
