import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import styled from 'styled-components'
import { getApiErrorMessage, leaderboardAPI } from '../utils/api'

type LeaderboardEntry = {
  rank: number
  userId: string
  displayName: string
  score: number
  timeTaken: number
}

type CachedLeaderboardPayload = {
  cachedAt: number
  entries: LeaderboardEntry[]
}

const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000

const LeaderboardShell = styled.div`
  border: 1px solid #d9e2ff;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.8);
  padding: 1rem;
  margin-top: 1.5rem;
`

export default function LeaderboardView() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = dayjs().format('YYYY-MM-DD')
  const cacheKey = `leaderboard:${today}`

  const loadLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    const cachedRaw = localStorage.getItem(cacheKey)
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as CachedLeaderboardPayload
        if (
          Array.isArray(cached.entries) &&
          typeof cached.cachedAt === 'number' &&
          Date.now() - cached.cachedAt < LEADERBOARD_CACHE_TTL_MS
        ) {
          setEntries(cached.entries)
          setLoading(false)
          return
        }
      } catch {
        localStorage.removeItem(cacheKey)
      }
    }

    try {
      const res = await leaderboardAPI.getDaily(today)
      const rows = (res.data?.entries as LeaderboardEntry[] | undefined) ?? []
      const nextEntries = rows.slice(0, 10)
      setEntries(nextEntries)
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            cachedAt: Date.now(),
            entries: nextEntries,
          } satisfies CachedLeaderboardPayload)
        )
      } catch {
        // Non-blocking: leaderboard can still render even if cache write fails.
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to load leaderboard')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, today])

  useEffect(() => {
    void loadLeaderboard()
  }, [loadLeaderboard])

  return (
    <LeaderboardShell>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#190482]">Daily Leaderboard</h4>
        <span className="text-[11px] text-[#525CEB]">{today}</span>
      </div>

      {loading && <p className="text-xs text-[#3D3B40]">Loading leaderboard...</p>}
      {error && (
        <div className="space-y-2">
          <p className="text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            className="rounded-md border border-[#C2D9FF] px-2 py-1 text-[11px] text-[#190482] hover:bg-[#F6F5F5]"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <p className="text-xs text-[#3D3B40]">No synced scores yet.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={`${entry.userId}-${entry.rank}`}
              className="flex items-center justify-between rounded-lg bg-[#F6F5F5] px-2 py-1 text-xs"
            >
              <span className="text-[#190482] font-semibold">#{entry.rank} {entry.displayName}</span>
              <span className="text-[#3D3B40]">{entry.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </LeaderboardShell>
  )
}
