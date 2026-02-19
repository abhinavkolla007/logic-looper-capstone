import './App.css'
import { Suspense, lazy, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from './features/store'
import { setGuestMode, setLoading, setUser } from './features/authSlice'
import { setPuzzle } from './features/gameSlice'
import { authAPI } from './utils/api'

const PuzzleView = lazy(() => import('./components/PuzzleView'))
const HeatmapView = lazy(() => import('./components/HeatmapView'))
const LeaderboardView = lazy(() => import('./components/LeaderboardView'))
const AchievementsView = lazy(() => import('./components/AchievementsView'))
const StreakBar = lazy(() => import('./components/StreakBar'))
const AuthScreen = lazy(() => import('./components/AuthScreen'))

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated)
  const authLoading = useSelector((state: RootState) => state.auth.loading)

  useEffect(() => {
    const bootstrapAuth = async () => {
      dispatch(setLoading(true))
      const token = localStorage.getItem('authToken')
      const guestId = localStorage.getItem('guestId')

      if (token) {
        try {
          const res = await authAPI.verifyToken()
          const user = res.data?.user
          if (user?.id) {
            localStorage.setItem('userId', user.id)
            dispatch(setUser({
              id: user.id,
              email: user.email || '',
              name: user.name || undefined,
              authType: user.authType === 'guest' ? 'guest' : user.authType === 'truecaller' ? 'truecaller' : 'google',
            }))
            return
          }
        } catch {
          localStorage.removeItem('authToken')
          localStorage.removeItem('userId')
        }
      }

      if (guestId) {
        dispatch(setGuestMode(guestId))
      } else {
        dispatch(setLoading(false))
      }
    }

    void bootstrapAuth()
  }, [dispatch])

  useEffect(() => {
    if (!isAuthenticated) return

    const initGame = async () => {
      try {
        const userId = localStorage.getItem('userId') || localStorage.getItem('guestId')
        if (!userId) return
        const runtime = await import('./utils/appRuntime')
        await runtime.initializeGameForUser(dispatch, userId)
      } catch (error) {
        console.error('Game init failed, falling back to generated puzzle:', error)
        const today = new Date().toISOString().slice(0, 10)
        const { generatePuzzle } = await import('./engines/puzzleEngine')
        dispatch(setPuzzle(generatePuzzle(new Date(today))))
      }
    }

    void initGame()
  }, [dispatch, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const userId = localStorage.getItem('userId')
    if (!userId) return

    let cleanup = () => {}
    void import('./utils/appRuntime').then((runtime) => {
      cleanup = runtime.registerOnlineSyncHandlers(userId)
    })
    return () => {
      cleanup()
    }
  }, [isAuthenticated])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#F6F5F5] to-[#DDF2FD]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#414BEA] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-[#190482] font-semibold text-lg">
            Loading Logic Looper...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F6F5F5]" />}>
        <AuthScreen />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F5] font-poppins text-[#222222]">
      <header className="sticky top-0 z-50 bg-[#F8EDFF] border-b border-[#D9E2FF] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold text-[#190482] tracking-tight">
              Logic Looper
            </h1>
            <span className="text-xs text-[#525CEB] -mt-1">
              Daily mindful logic training
            </span>
          </div>
          <Suspense fallback={<div className="text-sm text-[#525CEB]">Loading...</div>}>
            <StreakBar />
          </Suspense>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-8 py-16 w-full">
        <div className="grid lg:grid-cols-3 gap-14">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-2xl border border-[#D9E2FF] p-12 transition hover:shadow-[0_20px_60px_rgba(25,4,130,0.08)]">
              <Suspense fallback={<div className="text-center text-[#3D3B40]">Loading puzzle...</div>}>
                <PuzzleView />
              </Suspense>
            </div>
          </div>
          <aside>
            <div className="bg-white rounded-3xl shadow-2xl border border-[#D9E2FF] p-10 transition hover:shadow-[0_20px_60px_rgba(25,4,130,0.08)]">
              <Suspense fallback={<div className="text-center text-[#3D3B40]">Loading heatmap...</div>}>
                <HeatmapView />
              </Suspense>
              <Suspense fallback={<div className="text-center text-[#3D3B40]">Loading leaderboard...</div>}>
                <LeaderboardView />
              </Suspense>
              <Suspense fallback={<div className="text-center text-[#3D3B40]">Loading achievements...</div>}>
                <AchievementsView />
              </Suspense>
            </div>
          </aside>
        </div>
      </main>

      <footer className="mt-20 border-t border-[#D9E2FF] py-8 text-center text-sm text-[#3D3B40] bg-white">
        (c) {new Date().getFullYear()} Logic Looper - Designed for daily growth
      </footer>
    </div>
  )
}

export default App
