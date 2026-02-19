import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { verifyFirebaseToken } from '../utils/firebase.ts'
import { verifyTruecallerIdentity } from '../utils/truecaller.ts'
import { env } from '../config/env.ts'
import { sendError, sendSuccess } from '../utils/http.ts'
import { getRequestLogMeta, logError, logInfo } from '../utils/logger.ts'

const prisma = new PrismaClient()
const TRUECALLER_PENDING_TTL_MS = 10 * 60 * 1000

type PendingTruecallerVerification = {
  requestNonce: string
  phoneNumber?: string
  name?: string
  accessToken?: string
  authorizationCode?: string
  receivedAt: number
}

const pendingTruecallerVerifications = new Map<string, PendingTruecallerVerification>()

function cleanupPendingTruecallerVerifications() {
  const now = Date.now()
  for (const [key, value] of pendingTruecallerVerifications.entries()) {
    if (now - value.receivedAt > TRUECALLER_PENDING_TTL_MS) {
      pendingTruecallerVerifications.delete(key)
    }
  }
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function validateGoogleLoginPayload(payload: unknown): payload is { token: string } {
  if (typeof payload !== 'object' || payload === null) return false
  const token = (payload as Record<string, unknown>).token
  if (typeof token !== 'string') return false
  const normalized = token.trim()
  if (normalized.length < 20) return false
  const segments = normalized.split('.')
  if (segments.length !== 3) return false
  return segments.every((segment) => /^[A-Za-z0-9_-]+$/.test(segment))
}

type TruecallerLoginPayload = {
  phoneNumber?: string
  name?: string
  accessToken?: string
  authorizationCode?: string
}

export function validateTruecallerLoginPayload(payload: unknown): payload is TruecallerLoginPayload {
  if (typeof payload !== 'object' || payload === null) return false
  const body = payload as Record<string, unknown>
  const phoneNumber = coerceString(body.phoneNumber)
  const accessToken = coerceString(body.accessToken)
  const authorizationCode = coerceString(body.authorizationCode)
  const hasVerifier = Boolean(accessToken || authorizationCode || phoneNumber)
  if (!hasVerifier) return false
  if (phoneNumber && !/^\+?[1-9]\d{7,14}$/.test(phoneNumber)) return false
  if (accessToken && accessToken.length < 10) return false
  if (authorizationCode && authorizationCode.length < 6) return false
  const name = coerceString(body.name)
  if (name && name.length > 120) return false
  return true
}

export async function loginGoogle(req: Request, res: Response) {
  try {
    if (!validateGoogleLoginPayload(req.body)) {
      return sendError(res, 400, 'BAD_REQUEST', 'Valid Firebase token required', req.requestId)
    }
    const firebaseToken = req.body.token.trim()

    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(firebaseToken)
    const uid = decodedToken.uid
    const email = decodedToken.email || ''
    if (!email) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Google account email is required', req.requestId)
    }
    if ('email_verified' in decodedToken && decodedToken.email_verified === false) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Google email is not verified', req.requestId)
    }
    const name = decodedToken.name || 'User'

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
      },
      create: {
        email,
        name,
        authType: 'google',
      },
    })

    // Generate JWT token for backend
    const jwtToken = jwt.sign({ userId: user.id, firebaseUid: uid }, env.jwtSecret, {
      expiresIn: '30d',
    })

    sendSuccess(res, {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: unknown) {
    logError('auth.google_login_failed', error, getRequestLogMeta(req))
    const errorMessage = error instanceof Error ? error.message : 'Login failed'
    sendError(res, 401, 'UNAUTHORIZED', errorMessage, req.requestId)
  }
}

export async function loginTruecaller(req: Request, res: Response) {
  try {
    if (!validateTruecallerLoginPayload(req.body)) {
      return sendError(res, 400, 'BAD_REQUEST', 'Invalid Truecaller login payload', req.requestId)
    }

    const verified = await verifyTruecallerIdentity(req.body as {
      phoneNumber?: string
      name?: string
      accessToken?: string
      authorizationCode?: string
    })

    const emailAlias = `${verified.phoneNumber.replace('+', '')}@truecaller.local`
    const displayName = verified.name || 'Truecaller User'

    const user = await prisma.user.upsert({
      where: { email: emailAlias },
      update: {
        name: displayName,
        authType: 'truecaller',
      },
      create: {
        email: emailAlias,
        name: displayName,
        authType: 'truecaller',
      },
    })

    const jwtToken = jwt.sign({ userId: user.id, truecallerPhone: verified.phoneNumber }, env.jwtSecret, {
      expiresIn: '30d',
    })

    sendSuccess(res, {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: unknown) {
    logError('auth.truecaller_login_failed', error, getRequestLogMeta(req))
    const errorMessage = error instanceof Error ? error.message : 'Truecaller login failed'
    sendError(res, 401, 'UNAUTHORIZED', errorMessage, req.requestId)
  }
}

export async function truecallerCallback(req: Request, res: Response) {
  try {
    const payload = {
      ...(req.query as Record<string, unknown>),
      ...((req.body || {}) as Record<string, unknown>),
    } as Record<string, unknown>
    const requestNonce =
      coerceString(payload.requestNonce) || coerceString(payload.requestId) || coerceString(payload.nonce)

    if (!requestNonce) {
      return sendError(res, 400, 'BAD_REQUEST', 'requestNonce is required', req.requestId)
    }

    cleanupPendingTruecallerVerifications()

    const verification: PendingTruecallerVerification = {
      requestNonce,
      phoneNumber: coerceString(payload.phoneNumber) || coerceString(payload.mobile) || coerceString(payload.msisdn),
      name: coerceString(payload.name) || coerceString(payload.fullName),
      accessToken: coerceString(payload.accessToken) || coerceString(payload.token),
      authorizationCode: coerceString(payload.authorizationCode) || coerceString(payload.code),
      receivedAt: Date.now(),
    }

    pendingTruecallerVerifications.set(requestNonce, verification)
    logInfo('auth.truecaller_callback_received', {
      ...getRequestLogMeta(req),
      requestNonce: verification.requestNonce,
      hasPhoneNumber: Boolean(verification.phoneNumber),
      hasAccessToken: Boolean(verification.accessToken),
      hasAuthorizationCode: Boolean(verification.authorizationCode),
    })
    sendSuccess(res, { message: 'Received successfully' })
  } catch (error: unknown) {
    logError('auth.truecaller_callback_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to process Truecaller callback', req.requestId)
  }
}

export async function getTruecallerVerificationStatus(req: Request, res: Response) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    const requestNonce = req.params.requestNonce?.trim()
    if (!requestNonce) {
      return sendError(res, 400, 'BAD_REQUEST', 'requestNonce is required', req.requestId)
    }

    cleanupPendingTruecallerVerifications()
    const verification = pendingTruecallerVerifications.get(requestNonce)

    if (!verification) {
      return sendSuccess(res, { status: 'pending' })
    }

    pendingTruecallerVerifications.delete(requestNonce)
    return sendSuccess(res, {
      status: 'verified',
      payload: {
        phoneNumber: verification.phoneNumber,
        name: verification.name,
        accessToken: verification.accessToken,
        authorizationCode: verification.authorizationCode,
      },
    })
  } catch (error: unknown) {
    logError('auth.truecaller_status_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to check Truecaller verification status', req.requestId)
  }
}

export async function createGuestSession(req: Request, res: Response) {
  try {
    const guestId = `guest-${Date.now()}`
    const user = await prisma.user.create({
      data: {
        email: `${guestId}@guest.local`,
        name: 'Guest User',
        authType: 'guest',
      },
    })

    const token = jwt.sign({ userId: user.id }, env.jwtSecret, {
      expiresIn: '7d',
    })

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        authType: 'guest',
      },
    })
  } catch (error) {
    logError('auth.guest_session_failed', error, getRequestLogMeta(req))
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create session', req.requestId)
  }
}

export async function verifyToken(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return sendError(res, 401, 'UNAUTHORIZED', 'No token provided', req.requestId)
    }

    const payload = jwt.verify(token, env.jwtSecret) as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })

    if (!user) {
      return sendError(res, 404, 'NOT_FOUND', 'User not found', req.requestId)
    }

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        authType: user.authType,
      },
    })
  } catch (error) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid token', req.requestId)
  }
}
