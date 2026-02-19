import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../features/store'
import { logout as reduxLogout } from '../features/authSlice'
import { resetGame } from '../features/gameSlice'
import { logout as firebaseLogout } from '../utils/firebase'

export default function StreakBar() {
  const dispatch = useDispatch<AppDispatch>()
  const streak = useSelector((state: RootState) => state.game.streak)
  const user = useSelector((state: RootState) => state.auth.user)
  const isGuest = useSelector((state: RootState) => state.auth.isGuest)
  const currentStreak = streak?.current ?? 0
  const longestStreak = streak?.longest ?? 0

  const handleShareStreak = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 500
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#F8EDFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#190482'
    ctx.font = 'bold 52px sans-serif'
    ctx.fillText('Logic Looper Streak', 60, 90)

    ctx.font = '600 34px sans-serif'
    ctx.fillStyle = '#414BEA'
    ctx.fillText(`Current: ${currentStreak} day(s)`, 60, 210)
    ctx.fillText(`Longest: ${longestStreak} day(s)`, 60, 280)

    ctx.font = '500 24px sans-serif'
    ctx.fillStyle = '#3D3B40'
    ctx.fillText(`Shared by ${isGuest ? 'Guest' : user?.email?.split('@')[0] || 'Player'}`, 60, 360)
    ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 60, 400)

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'logic-looper-streak.png'
    link.click()
  }

  const handleLogout = async () => {
    try {
      if (!isGuest) {
        await firebaseLogout()
      }
      localStorage.removeItem('authToken')
      localStorage.removeItem('userId')
      localStorage.removeItem('guestId')
      dispatch(reduxLogout())
      dispatch(resetGame())
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="flex items-center gap-8 text-sm">
      {/* Current Streak */}
      <div className="text-center">
        <div className="text-xs text-[#525CEB]">Current Streak</div>
        <div key={currentStreak} className="text-2xl font-bold text-[#190482] transition-transform duration-200 flex items-center justify-center gap-2">
          <span>{currentStreak}</span>
          {currentStreak > 0 && (
            <span className="rounded-full bg-[#FFF2CD] px-2 py-0.5 text-[10px] font-semibold text-[#8A6A00]">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-[#D9E2FF]" />

      {/* Longest Streak */}
      <div className="text-center">
        <div className="text-xs text-[#525CEB]">Longest Streak</div>
        <div className="text-lg font-semibold text-[#414BEA]">
          {longestStreak}
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-[#D9E2FF]" />

      {/* User Info */}
      <div className="flex items-center gap-3">

        <div className="text-right">
          <div className="text-xs text-[#525CEB]">
            {isGuest ? 'Guest' : 'Logged in'}
          </div>

          {!isGuest && (
            <div className="text-sm font-medium text-[#190482]">
              {user?.email?.split('@')[0]}
            </div>
          )}
        </div>

        <button
          onClick={handleShareStreak}
          className="px-3 py-1.5 rounded-lg border border-[#414BEA] text-[#190482] text-xs transition hover:bg-[#D9E2FF]"
        >
          Share
        </button>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg bg-[#190482] hover:bg-[#414BEA] text-white text-xs transition"
        >
          Sign out
        </button>

      </div>
    </div>
  )
}
