import admin from 'firebase-admin'
import { env } from '../config/env.ts'
import { logError } from './logger.ts'

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: env.firebaseProjectId || 'logic-looper-963d8',
  })
}

export const firebaseApp = admin.app()

/**
 * Verify Firebase ID token
 */
export async function verifyFirebaseToken(token: string) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    return decodedToken
  } catch (error) {
    logError('firebase.token_verify_failed', error)
    throw error
  }
}

export default admin
