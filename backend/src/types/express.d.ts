declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string }
    requestId?: string
  }
}

export {}

