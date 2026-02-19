import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../features/store'
import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import {
  setPuzzleStarted,
  setActivity,
  setElapsedTime,
  setStreak,
  setHeatmapData,
  setPuzzle,
} from '../features/gameSlice'
import { storageManager, type DailyActivity } from '../storage/storageManager'
import { calculateStreakFromActivities, isPuzzleLocked } from '../engines/streakEngine'
import { unlockEligibleAchievements } from '../engines/achievementEngine'
import {
  calculateDifficultyAdjustmentFromPerformance,
  generatePuzzle,
  validateSolution,
  type Puzzle,
} from '../engines/puzzleEngine'
import { flushPendingSyncWithOptions } from '../utils/syncManager'

interface SequencePuzzleData {
  sequence: number[]
  nextIndex: number
}
interface MatrixPuzzleData {
  size: number
  matrix: number[]
  missing: number
}
interface PatternPuzzleData {
  pattern: string[]
  missing: number
  options: string[]
}
interface DeductionPuzzleData {
  clues: string[]
  options: string[]
  question: string
}
interface BinaryPuzzleData {
  size: number
  grid: number[]
  rule: string
}

const MAX_DAILY_HINTS = 3
const LOAD_TIMEOUT_MS = 1500
const TIMED_MODE_BUFFER_SECONDS = 35
type PlayMode = 'standard' | 'timed'

type SharedChallengeState = {
  date: string
  answer: string
  elapsedTime: number
  hintsUsed: number
  puzzleStarted: boolean
  mode: PlayMode
}

function getInitialSelectedDate(): string {
  const today = dayjs().format('YYYY-MM-DD')
  try {
    const url = new URL(window.location.href)
    const challengeDate = url.searchParams.get('challengeDate')
    if (!challengeDate) return today
    const parsed = dayjs(challengeDate, 'YYYY-MM-DD', true)
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : today
  } catch {
    return today
  }
}

function encodeShareState(state: SharedChallengeState): string {
  const raw = JSON.stringify(state)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeShareState(encoded: string): SharedChallengeState | null {
  try {
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4)
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(atob(base64)) as Partial<SharedChallengeState>
    if (
      !parsed ||
      typeof parsed.date !== 'string' ||
      typeof parsed.answer !== 'string' ||
      typeof parsed.elapsedTime !== 'number' ||
      typeof parsed.hintsUsed !== 'number' ||
      typeof parsed.puzzleStarted !== 'boolean' ||
      (parsed.mode !== 'standard' && parsed.mode !== 'timed')
    ) {
      return null
    }
    return parsed as SharedChallengeState
  } catch {
    return null
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then((value) => resolve(value))
      .catch((err) => reject(err))
      .finally(() => window.clearTimeout(timer))
  })
}

function hasArrayProp<T extends object>(obj: unknown, prop: keyof T): obj is T {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    prop in obj &&
    Array.isArray((obj as Record<string, unknown>)[String(prop)])
  )
}

function isSequencePuzzleData(data: unknown): data is SequencePuzzleData {
  return hasArrayProp<SequencePuzzleData>(data, 'sequence')
}

function isMatrixPuzzleData(data: unknown): data is MatrixPuzzleData {
  return hasArrayProp<MatrixPuzzleData>(data, 'matrix') && 'size' in (data as object)
}

function isPatternPuzzleData(data: unknown): data is PatternPuzzleData {
  return hasArrayProp<PatternPuzzleData>(data, 'pattern') && hasArrayProp<PatternPuzzleData>(data, 'options')
}

function isDeductionPuzzleData(data: unknown): data is DeductionPuzzleData {
  return hasArrayProp<DeductionPuzzleData>(data, 'clues') && hasArrayProp<DeductionPuzzleData>(data, 'options')
}

function isBinaryPuzzleData(data: unknown): data is BinaryPuzzleData {
  return hasArrayProp<BinaryPuzzleData>(data, 'grid') && 'size' in (data as object)
}

function getHintForPuzzle(puzzle: Puzzle): string {
  switch (puzzle.type) {
    case 'matrix':
      return 'Rows and columns follow a stable arithmetic rule.'
    case 'sequence':
      return 'Look for a fixed increment between consecutive terms.'
    case 'pattern':
      return 'The symbols repeat in a short cycle.'
    case 'deduction':
      return 'Match each clue directly; one option satisfies all clues.'
    case 'binary':
      return 'Use XOR parity from the first row to derive the missing bit.'
  }
}

export default function PuzzleView() {
  const dispatch = useDispatch<AppDispatch>()
  const puzzle = useSelector((state: RootState) => state.game.currentPuzzle) as Puzzle | null
  const activity = useSelector((state: RootState) => state.game.userActivity)
  const heatmapData = useSelector((state: RootState) => state.game.heatmapData)
  const puzzleStarted = useSelector((state: RootState) => state.game.puzzleStarted)
  const elapsedTime = useSelector((state: RootState) => state.game.elapsedTime)
  const isGuest = useSelector((state: RootState) => state.auth.isGuest)

  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintText, setHintText] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [isDateLoading, setIsDateLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getInitialSelectedDate)
  const [playMode, setPlayMode] = useState<PlayMode>('standard')
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([])
  const today = dayjs().format('YYYY-MM-DD')
  const userId = localStorage.getItem('userId') || localStorage.getItem('guestId') || 'guest'
  const sharedStateFromUrl = useMemo(() => {
    try {
      const url = new URL(window.location.href)
      const encoded = url.searchParams.get('challengeState')
      return encoded ? decodeShareState(encoded) : null
    } catch {
      return null
    }
  }, [])

  const dateOptions = useMemo(
    () => Array.from({ length: 8 }, (_, i) => dayjs().subtract(7 - i, 'day').format('YYYY-MM-DD')),
    []
  )

  const activityMap = useMemo(() => new Map(heatmapData.map((a) => [a.date, a])), [heatmapData])
  const timedLimitSeconds = useMemo(() => Math.max(45, puzzle ? puzzle.difficulty * 45 + TIMED_MODE_BUFFER_SECONDS : 90), [puzzle])

  useEffect(() => {
    const loadDateState = async () => {
      setIsDateLoading(true)
      try {
        setHintText('')
        dispatch(setPuzzleStarted(false))
        dispatch(setElapsedTime(0))
        setAnswer('')

        const recentActivities = await withTimeout(
          storageManager.getRecentActivities(userId, 14),
          LOAD_TIMEOUT_MS,
          'get recent activities'
        )
        const difficultyAdjustment = calculateDifficultyAdjustmentFromPerformance(recentActivities)

        let currentPuzzle =
          (await withTimeout(
            storageManager.getPuzzle<Puzzle>(selectedDate),
            LOAD_TIMEOUT_MS,
            'get cached puzzle'
          )) ?? null
        if (!currentPuzzle) {
          currentPuzzle = generatePuzzle(new Date(selectedDate), { difficultyAdjustment })
          const daysAhead = dayjs(selectedDate).diff(dayjs(today), 'day')
          if (daysAhead >= 0 && daysAhead <= 7) {
            // Cache write is best-effort; do not fail view load if IndexedDB is slow.
            void storageManager.savePuzzle(selectedDate, currentPuzzle).catch((error) => {
              console.warn('save puzzle failed (non-blocking):', error)
            })
          }
        }
        dispatch(setPuzzle(currentPuzzle))

        const locked = await withTimeout(isPuzzleLocked(userId, selectedDate), LOAD_TIMEOUT_MS, 'lock check')
        setIsLocked(locked)

        const dateActivity = await withTimeout(
          storageManager.getActivity(userId, selectedDate),
          LOAD_TIMEOUT_MS,
          'get activity'
        )
        dispatch(setActivity(dateActivity ?? null))

        if (selectedDate === today && !dateActivity?.solved && !locked) {
          const progress = await withTimeout(
            storageManager.getProgress(userId, selectedDate),
            LOAD_TIMEOUT_MS,
            'get progress'
          )
          if (progress) {
            setAnswer(progress.answer || '')
            setHintsUsed(progress.hintsUsed || 0)
            dispatch(setElapsedTime(progress.elapsedTime || 0))
            dispatch(setPuzzleStarted(!!progress.puzzleStarted))
            setPlayMode(progress.playMode === 'timed' ? 'timed' : 'standard')
          } else {
            if (sharedStateFromUrl?.date === selectedDate) {
              setAnswer(sharedStateFromUrl.answer)
              setHintsUsed(sharedStateFromUrl.hintsUsed)
              dispatch(setElapsedTime(sharedStateFromUrl.elapsedTime))
              dispatch(setPuzzleStarted(sharedStateFromUrl.puzzleStarted))
              setPlayMode(sharedStateFromUrl.mode)
            } else {
              setHintsUsed(0)
              setPlayMode('standard')
            }
          }
        } else {
          setHintsUsed(dateActivity?.hintsUsed ?? 0)
        }
      } catch (error) {
        console.error('Failed to load puzzle state:', error)
        const fallbackPuzzle = generatePuzzle(new Date(selectedDate))
        dispatch(setPuzzle(fallbackPuzzle))
        dispatch(setActivity(null))
        setIsLocked(false)
      } finally {
        setIsDateLoading(false)
      }
    }

    void loadDateState()
  }, [dispatch, selectedDate, sharedStateFromUrl, today, userId])

  useEffect(() => {
    if (selectedDate !== today || !puzzle || activity?.solved || isLocked) return
    if (!puzzleStarted && !answer && elapsedTime === 0 && hintsUsed === 0) return
    void storageManager.saveProgress({
      userId,
      date: selectedDate,
      answer,
      elapsedTime,
      hintsUsed,
      puzzleStarted,
      playMode,
    })
  }, [activity?.solved, answer, elapsedTime, hintsUsed, isLocked, playMode, puzzle, puzzleStarted, selectedDate, today, userId])

  useEffect(() => {
    if (!puzzleStarted || activity?.solved || selectedDate !== today || isLocked) return
    const interval = setInterval(() => {
      dispatch(setElapsedTime(elapsedTime + 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [puzzleStarted, elapsedTime, activity?.solved, dispatch, selectedDate, today, isLocked])

  const handleStartPuzzle = () => {
    if (selectedDate !== today || isLocked) return
    setNewlyUnlocked([])
    dispatch(setPuzzleStarted(true))
    if (!answer) {
      dispatch(setElapsedTime(0))
      setHintsUsed(0)
    }
  }

  const remainingHints = useMemo(() => Math.max(0, MAX_DAILY_HINTS - hintsUsed), [hintsUsed])

  const handleUseHint = () => {
    if (!puzzle || remainingHints <= 0 || selectedDate !== today || isLocked) return
    setHintsUsed((prev) => prev + 1)
    setHintText(getHintForPuzzle(puzzle))
  }

  const handleShareChallenge = async () => {
    if (!puzzle) return
    const url = new URL(window.location.href)
    url.searchParams.set('challengeDate', selectedDate)
    url.searchParams.set('challengeType', puzzle.type)
    url.searchParams.set(
      'challengeState',
      encodeShareState({
        date: selectedDate,
        answer,
        elapsedTime,
        hintsUsed,
        puzzleStarted,
        mode: playMode,
      })
    )
    try {
      await navigator.clipboard.writeText(url.toString())
      alert('Challenge link copied!')
    } catch {
      alert(`Share this challenge link:\n${url.toString()}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!puzzle || submitting || selectedDate !== today || isLocked) return
    setSubmitting(true)

    try {
      const result = validateSolution(puzzle, { answer })
      if (result.valid) {
        const baseScore = Math.max(10, result.score - elapsedTime - hintsUsed * 10)
        const timedBonus =
          playMode === 'timed' ? Math.max(0, Math.min(25, timedLimitSeconds - elapsedTime)) : 0
        const score = Math.min(120, baseScore + timedBonus)
        const newActivity: DailyActivity = {
          userId,
          date: selectedDate,
          solved: true,
          score,
          timeTaken: elapsedTime * 1000,
          difficulty: puzzle.difficulty,
          hintsUsed,
          synced: false,
          completedAt: new Date().toISOString(),
        }

        await storageManager.saveActivity(newActivity)
        await storageManager.clearProgress(userId, selectedDate)
        await storageManager.addToSyncQueue('daily_score', {
          userId,
          date: selectedDate,
          score,
          timeTaken: elapsedTime * 1000,
          timedBonus,
        })

        dispatch(setActivity(newActivity))
        dispatch(setPuzzleStarted(false))
        setIsLocked(false)

        const updatedActivities = await storageManager.getYearActivities(userId)
        dispatch(setHeatmapData(updatedActivities))
        const updatedStreak = calculateStreakFromActivities(updatedActivities, today)
        dispatch(setStreak(updatedStreak))
        const unlocked = await unlockEligibleAchievements(userId, updatedActivities, updatedStreak.current)
        setNewlyUnlocked(unlocked.map((achievement) => achievement.name))

        if (!isGuest) {
          await flushPendingSyncWithOptions(userId, { force: false, batchSize: 5 })
        }

        setAnswer('')
        setPlayMode('standard')
      } else {
        alert('Incorrect answer. Try again!')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!puzzle || isDateLoading) {
    return <div className="text-center text-[#3D3B40]">Loading puzzle...</div>
  }

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {newlyUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="rounded-xl border border-[#B9F3E4] bg-[#E9FFF8] px-4 py-3"
          >
            <p className="text-sm font-semibold text-[#0F766E]">
              New achievement unlocked: {newlyUnlocked.join(', ')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-[#190482]">Daily Challenge</h2>
          <p className="text-sm text-[#525CEB]">{dayjs(selectedDate).format('dddd, MMMM D')}</p>
          <button
            type="button"
            onClick={handleShareChallenge}
            className="mt-2 text-xs rounded-md border border-[#C2D9FF] px-2 py-1 text-[#190482] hover:bg-[#F6F5F5]"
          >
            Share Challenge Link
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {dateOptions.map((date) => {
            const completed = !!activityMap.get(date)?.solved
            const locked = date < today && !completed
            const isToday = date === today
            const selected = date === selectedDate
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-2 rounded-lg text-xs border transition whitespace-nowrap ${
                  selected ? 'bg-[#190482] text-white border-[#190482]' : 'bg-white text-[#190482] border-[#C2D9FF]'
                }`}
              >
                {dayjs(date).format('MMM D')}
                {isToday ? ' - Today' : completed ? ' - Done' : locked ? ' - Locked' : ''}
              </button>
            )
          })}
        </div>
      </div>

      {isLocked ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-[#FFF4E6] border border-[#FFD8A8] rounded-2xl p-8 text-center"
        >
          <h3 className="text-xl font-bold text-[#8F5B00]">Locked Puzzle</h3>
          <p className="text-[#6B4F1D] mt-2">
            Past puzzles unlock only after completion on that day. Select another completed date or play today&apos;s puzzle.
          </p>
        </motion.div>
      ) : activity?.solved ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="bg-[#F8EDFF] border border-[#7752FE]/40 rounded-2xl p-10 text-center shadow-lg"
        >
          <div className="text-5xl mb-4">Completed</div>
          <h3 className="text-xl font-bold text-[#190482] mb-4">Puzzle Completed!</h3>
          <p className="text-[#3D3B40]">
            Score: <span className="font-bold text-[#414BEA]">{activity.score}</span>
          </p>
          <p className="text-[#3D3B40] mt-2">Time: {(activity.timeTaken / 1000).toFixed(1)}s</p>
          <p className="text-[#3D3B40] mt-2">Hints used: {activity.hintsUsed}</p>
        </motion.div>
      ) : !puzzleStarted || selectedDate !== today ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-[#DDF2FD] border border-[#C2D9FF] rounded-2xl p-8 text-center space-y-4"
        >
          <p className="font-semibold text-[#190482]">Difficulty: {puzzle.difficulty}/5</p>
          <p className="text-sm text-[#3D3B40] capitalize">Type: {puzzle.type}</p>
          {selectedDate === today && (
            <div className="space-y-2">
              <p className="text-xs text-[#525CEB]">Play Mode</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlayMode('standard')}
                  className={`px-3 py-1 rounded-md text-xs border ${
                    playMode === 'standard'
                      ? 'bg-[#190482] text-white border-[#190482]'
                      : 'bg-white text-[#190482] border-[#C2D9FF]'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setPlayMode('timed')}
                  className={`px-3 py-1 rounded-md text-xs border ${
                    playMode === 'timed'
                      ? 'bg-[#190482] text-white border-[#190482]'
                      : 'bg-white text-[#190482] border-[#C2D9FF]'
                  }`}
                >
                  Timed (+Bonus)
                </button>
              </div>
              {playMode === 'timed' && (
                <p className="text-xs text-[#525CEB]">Finish within {timedLimitSeconds}s for extra points.</p>
              )}
            </div>
          )}
          {selectedDate === today ? (
            <button
              onClick={handleStartPuzzle}
              className="w-full bg-[#190482] hover:bg-[#525CEB] text-white font-semibold py-3 rounded-xl transition"
            >
              Start Puzzle
            </button>
          ) : (
            <p className="text-sm text-[#525CEB]">Only today&apos;s puzzle can be actively played.</p>
          )}
        </motion.div>
      ) : (
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="space-y-8"
        >
          <div className="flex justify-between items-center bg-[#DDF2FD] p-4 rounded-xl">
            <span className="text-sm font-medium text-[#190482] capitalize">
              {puzzle.type} ({playMode})
            </span>
            <span className="text-xl font-bold text-[#414BEA]">
              {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
            </span>
          </div>
          {playMode === 'timed' && (
            <p className="text-sm text-[#525CEB]">
              Bonus window: {Math.max(0, timedLimitSeconds - elapsedTime)}s remaining
            </p>
          )}

          <div className="bg-[#F6F5F5] border border-[#BFCFE7] rounded-2xl p-8 text-center space-y-6">
            {puzzle.type === 'sequence' && isSequencePuzzleData(puzzle.data) && (
              <div className="flex justify-center gap-3 flex-wrap">
                {puzzle.data.sequence.map((num, i) => (
                  <div key={i} className="px-4 py-2 rounded-lg bg-[#C2D9FF] text-[#190482] font-semibold">
                    {num}
                  </div>
                ))}
                <div className="px-4 py-2 rounded-lg bg-[#190482] text-white font-semibold">?</div>
              </div>
            )}

            {puzzle.type === 'matrix' && isMatrixPuzzleData(puzzle.data) && (
              <div className="flex justify-center">
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${puzzle.data.size}, 1fr)` }}>
                  {puzzle.data.matrix.map((num, i) => (
                    <div
                      key={i}
                      className="w-12 h-12 flex items-center justify-center rounded-lg bg-[#D9E2FF] text-[#190482] font-bold"
                    >
                      {num === 0 ? '?' : num}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {puzzle.type === 'pattern' && isPatternPuzzleData(puzzle.data) && (
              <div className="space-y-4">
                <div className="flex justify-center gap-2 flex-wrap">
                  {puzzle.data.pattern.map((token, i) => (
                    <div key={i} className="px-3 py-2 rounded-md bg-[#D9E2FF] text-[#190482] font-semibold uppercase">
                      {token}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-[#525CEB]">Options: {puzzle.data.options.join(', ')}</div>
              </div>
            )}

            {puzzle.type === 'deduction' && isDeductionPuzzleData(puzzle.data) && (
              <div className="space-y-3 text-left">
                {puzzle.data.clues.map((clue, i) => (
                  <p key={i} className="text-sm text-[#3D3B40]">- {clue}</p>
                ))}
                <p className="font-semibold text-[#190482]">{puzzle.data.question}</p>
                <p className="text-xs text-[#525CEB]">Options: {puzzle.data.options.join(', ')}</p>
              </div>
            )}

            {puzzle.type === 'binary' && isBinaryPuzzleData(puzzle.data) && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${puzzle.data.size}, 1fr)` }}>
                    {puzzle.data.grid.map((n, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 flex items-center justify-center rounded-md bg-[#D9E2FF] text-[#190482] font-bold"
                      >
                        {n === -1 ? '?' : n}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#525CEB]">{puzzle.data.rule}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#190482]">Your Answer</label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full border border-[#C2D9FF] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#414BEA] outline-none"
              placeholder="Enter answer..."
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUseHint}
                disabled={remainingHints <= 0}
                className="px-3 py-2 rounded-lg bg-[#525CEB] text-white text-sm disabled:opacity-40"
              >
                Use Hint ({remainingHints} left)
              </button>
              {hintText && <p className="text-sm text-[#3D3B40]">{hintText}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={!answer.trim() || submitting}
            className="w-full bg-[#190482] hover:bg-[#414BEA] text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {submitting ? 'Checking...' : 'Submit Answer'}
          </button>
        </motion.form>
      )}
    </div>
  )
}

