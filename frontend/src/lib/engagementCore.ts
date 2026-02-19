export interface CoreDailyActivity {
  date: string
  solved: boolean
  score: number
  timeTaken: number
  difficulty: number
}

export interface CoreHeatmapCellData {
  date: string
  intensity: 0 | 1 | 2 | 3 | 4
  solved: boolean
  score: number
  timeTaken: number
  difficulty: number
}

export interface CoreStreakInfo {
  current: number
  longest: number
  lastPlayedDate: string | null
  isActiveToday: boolean
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true
  if (year % 100 === 0) return false
  return year % 4 === 0
}

function toIsoLocalDate(input: Date): string {
  const y = input.getFullYear()
  const m = String(input.getMonth() + 1).padStart(2, '0')
  const d = String(input.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

export function calculateIntensityFromActivity(activity?: CoreDailyActivity): 0 | 1 | 2 | 3 | 4 {
  if (!activity?.solved) return 0

  const score = activity.score
  const timeTaken = activity.timeTaken
  const difficulty = activity.difficulty

  if (score >= 95 && difficulty >= 4 && timeTaken > 0 && timeTaken <= 120000) return 4
  if (difficulty >= 4 || (score >= 85 && timeTaken <= 180000)) return 3
  if (difficulty >= 3 || score >= 70 || timeTaken <= 300000) return 2
  return 1
}

export function buildHeatmapCellsForYear(
  activities: CoreDailyActivity[],
  year: number
): CoreHeatmapCellData[] {
  const activityMap = new Map(activities.map((a) => [a.date, a]))
  const totalDays = getDaysInYear(year)
  const start = new Date(year, 0, 1)
  const cells: CoreHeatmapCellData[] = []

  for (let i = 0; i < totalDays; i++) {
    const date = toIsoLocalDate(addLocalDays(start, i))
    const activity = activityMap.get(date)
    const intensity = calculateIntensityFromActivity(activity)
    cells.push({
      date,
      intensity,
      solved: Boolean(activity?.solved),
      score: activity?.score ?? 0,
      timeTaken: activity?.timeTaken ?? 0,
      difficulty: activity?.difficulty ?? 0,
    })
  }

  return cells
}

export function splitIntoWeeks<T>(cells: T[], daysPerWeek = 7): T[][] {
  const weeks: T[][] = []
  for (let i = 0; i < cells.length; i += daysPerWeek) {
    weeks.push(cells.slice(i, i + daysPerWeek))
  }
  return weeks
}

export function calculateStreakFromSolvedDates(
  solvedDatesInput: string[],
  todayDate: string
): CoreStreakInfo {
  const solvedDates = [...new Set(solvedDatesInput)].sort((a, b) => a.localeCompare(b))
  const solvedSet = new Set(solvedDates)
  const isActiveToday = solvedSet.has(todayDate)

  let current = 0
  let cursor = new Date(`${todayDate}T00:00:00`)
  while (solvedSet.has(toIsoLocalDate(cursor))) {
    current += 1
    cursor = addLocalDays(cursor, -1)
  }

  let longest = 0
  let run = 0
  let prevDate: Date | null = null
  for (const d of solvedDates) {
    const currentDate = new Date(`${d}T00:00:00`)
    if (!prevDate) {
      run = 1
    } else {
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      run = diffDays === 1 ? run + 1 : 1
    }
    if (run > longest) longest = run
    prevDate = currentDate
  }

  const lastPlayedDate = solvedDates.length > 0 ? solvedDates[solvedDates.length - 1] : null
  return { current, longest, lastPlayedDate, isActiveToday }
}
