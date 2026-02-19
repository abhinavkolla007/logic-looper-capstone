import { Router } from 'express'
import { getDbWriteMetrics, getEngagementMetrics } from '../controllers/metricsController.ts'

const router = Router()

router.get('/db-writes', getDbWriteMetrics)
router.get('/engagement', getEngagementMetrics)

export default router
