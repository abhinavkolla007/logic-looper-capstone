import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeaderboardView from './LeaderboardView'
import { leaderboardAPI } from '../utils/api'

vi.mock('../utils/api', () => ({
  leaderboardAPI: {
    getDaily: vi.fn(),
  },
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

describe('LeaderboardView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(leaderboardAPI.getDaily).mockReset()
  })

  it('renders leaderboard entries when API returns data', async () => {
    vi.mocked(leaderboardAPI.getDaily).mockResolvedValue({
      data: {
        entries: [
          { rank: 1, userId: 'u1', displayName: 'Alice', score: 120, timeTaken: 32000 },
          { rank: 2, userId: 'u2', displayName: 'Bob', score: 110, timeTaken: 35000 },
        ],
      },
    } as never)

    render(<LeaderboardView />)
    await waitFor(() => expect(screen.getByText('#1 Alice')).toBeTruthy())
    expect(screen.getByText('120 pts')).toBeTruthy()
    expect(screen.getByText('#2 Bob')).toBeTruthy()
  })

  it('renders API error message on failure', async () => {
    vi.mocked(leaderboardAPI.getDaily).mockRejectedValue(new Error('Leaderboard down'))
    render(<LeaderboardView />)
    await waitFor(() => expect(screen.getByText('Leaderboard down')).toBeTruthy())
  })

  it('uses local cache and skips API call when cache is fresh', async () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(
      `leaderboard:${today}`,
      JSON.stringify({
        cachedAt: Date.now(),
        entries: [{ rank: 1, userId: 'u1', displayName: 'Cached', score: 90, timeTaken: 40000 }],
      })
    )

    render(<LeaderboardView />)
    await waitFor(() => expect(screen.getByText('#1 Cached')).toBeTruthy())
    expect(leaderboardAPI.getDaily).not.toHaveBeenCalled()
  })
})
