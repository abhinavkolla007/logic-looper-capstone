import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { RootState } from '../features/store'
import { storageManager } from '../storage/storageManager'
import { getAchievementStatuses } from '../engines/achievementEngine'

export default function AchievementsView() {
  const heatmapData = useSelector((state: RootState) => state.game.heatmapData)
  const streakCurrent = useSelector((state: RootState) => state.game.streak?.current ?? 0)
  const [persistedIds, setPersistedIds] = useState<Set<string>>(new Set())
  const userId = localStorage.getItem('userId') || localStorage.getItem('guestId') || 'guest'

  useEffect(() => {
    const loadAchievements = async () => {
      const rows = await storageManager.getAchievements(userId)
      setPersistedIds(new Set(rows.map((row) => row.achievementId)))
    }
    void loadAchievements()
  }, [heatmapData, streakCurrent, userId])

  const statuses = useMemo(
    () => getAchievementStatuses(heatmapData, streakCurrent, persistedIds),
    [heatmapData, streakCurrent, persistedIds]
  )
  const unlockedCount = statuses.filter((status) => status.unlocked).length

  return (
    <motion.div
      className="mt-6 space-y-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#190482]">Achievements</h4>
        <span className="text-[11px] text-[#525CEB]">{unlockedCount}/{statuses.length}</span>
      </div>

      <div className="space-y-2">
        {statuses.map((status) => (
          <motion.div
            key={status.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`rounded-lg border px-3 py-2 text-xs ${
              status.unlocked
                ? 'border-[#C2D9FF] bg-[#F8EDFF]'
                : 'border-[#E8EAF4] bg-[#F6F7FB] opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#190482]">{status.name}</span>
              <span className="text-[#525CEB]">{status.value}/{status.target}</span>
            </div>
            <p className="text-[#3D3B40] mt-1">{status.description}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
