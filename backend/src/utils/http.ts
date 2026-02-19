import { Response } from 'express'

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'

export type ApiErrorBody = {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    requestId?: string
  }
}

export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string
): Response<ApiErrorBody> {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      requestId,
    },
  })
}

export function sendSuccess<T>(res: Response, body: T): Response<T & { success: true }> {
  return res.json({
    success: true,
    ...body,
  })
}
