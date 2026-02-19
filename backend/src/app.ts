import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import syncRoutes from './routes/sync.ts'
import authRoutes from './routes/auth.ts'
import leaderboardRoutes from './routes/leaderboard.ts'
import metricsRoutes from './routes/metrics.ts'
import { env } from './config/env.ts'
import { sendError } from './utils/http.ts'
import { getRequestLogMeta, logError, logInfo } from './utils/logger.ts'

const app = express()

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

const allowedOrigins = env.allowedOrigins.map((origin) => normalizeOrigin(origin))

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true)
      callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '64kb' }))
app.use(express.urlencoded({ extended: true, limit: '64kb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use((req: Request, res: Response, next: NextFunction) => {
  const inbound = req.headers['x-request-id']
  const inboundId = typeof inbound === 'string' ? inbound.trim() : ''
  req.requestId = inboundId || randomUUID()
  res.setHeader('x-request-id', req.requestId)

  const start = Date.now()
  res.on('finish', () => {
    logInfo('request.completed', {
      ...getRequestLogMeta(req),
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    })
  })
  next()
})

app.use(apiLimiter)
app.use('/sync', syncLimiter, syncRoutes)
app.use('/auth', authLimiter, authRoutes)
app.use('/api/auth', authLimiter, authRoutes)
app.use('/leaderboard', leaderboardRoutes)
app.use('/metrics', metricsRoutes)

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  logError('request.unhandled_error', err, {
    requestId: _req.requestId,
    method: _req.method,
    path: _req.path,
  })
  if (err.message.startsWith('CORS blocked for origin:')) {
    sendError(res, 403, 'FORBIDDEN', err.message, _req.requestId)
    return
  }
  sendError(res, 500, 'INTERNAL_ERROR', err.message || 'Internal server error', _req.requestId)
})

export default app
