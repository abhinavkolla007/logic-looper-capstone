import { Request } from 'express'
import { env } from '../config/env.ts'

type LogLevel = 'info' | 'warn' | 'error'

type LogMeta = Record<string, unknown>

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { value: String(error) }
}

function emit(level: LogLevel, event: string, meta?: LogMeta): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    service: 'logic-looper-backend',
    env: env.nodeEnv,
    ...meta,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function logInfo(event: string, meta?: LogMeta): void {
  emit('info', event, meta)
}

export function logWarn(event: string, meta?: LogMeta): void {
  emit('warn', event, meta)
}

export function logError(event: string, error: unknown, meta?: LogMeta): void {
  emit('error', event, {
    ...meta,
    error: serializeError(error),
  })
}

export function getRequestLogMeta(req: Request): LogMeta {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  }
}

