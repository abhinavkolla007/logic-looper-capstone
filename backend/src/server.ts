import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import app from './app.ts'
import { env } from './config/env.ts'
import { logError, logInfo, logWarn } from './utils/logger.ts'

const prisma = new PrismaClient()

async function startServer() {
  try {
    try {
      await prisma.$queryRaw`SELECT 1`
      logInfo('db.connected')
    } catch (_dbError) {
      logWarn('db.unavailable_demo_mode')
      logWarn('db.sync_not_persisted')
    }

    app.listen(env.port, () => {
      logInfo('server.started', {
        port: env.port,
        frontendOrigins: env.frontendOriginsRaw || 'http://localhost:5173',
      })
    })
  } catch (error) {
    logError('server.start_failed', error)
    process.exit(1)
  }
}

startServer()

process.on('SIGINT', async () => {
  logInfo('server.shutting_down')
  await prisma.$disconnect()
  process.exit(0)
})
