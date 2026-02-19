import { Router } from 'express'
import { syncDailyScores, syncAchievements } from '../controllers/syncController.ts'
import { authenticateToken } from '../middlewares/auth.ts'

const router = Router()

// Sync daily scores (protected)
router.post('/daily-scores', authenticateToken, syncDailyScores)

// Sync achievements (protected)
router.post('/achievements', authenticateToken, syncAchievements)

export default router
