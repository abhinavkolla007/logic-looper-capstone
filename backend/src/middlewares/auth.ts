import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.ts'
import { sendError } from '../utils/http.ts'

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return sendError(res, 401, 'UNAUTHORIZED', 'No token provided')
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string }
    req.user = { id: payload.userId }
    next()
  } catch (error) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid token')
  }
}
