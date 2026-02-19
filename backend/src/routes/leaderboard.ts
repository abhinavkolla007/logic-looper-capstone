import { Router } from 'express'
import { getDailyLeaderboard } from '../controllers/leaderboardController.ts'

const router = Router()

router.get('/daily', getDailyLeaderboard)

export default router
