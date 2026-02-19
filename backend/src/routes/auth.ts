import { Router } from 'express'
import {
  loginGoogle,
  loginTruecaller,
  truecallerCallback,
  getTruecallerVerificationStatus,
  createGuestSession,
  verifyToken,
} from '../controllers/authController.ts'
const router = Router()

// Google login
router.post('/google', loginGoogle)

// Truecaller login
router.post('/truecaller', loginTruecaller)
router.post('/truecaller/callback', truecallerCallback)
router.get('/truecaller/callback', truecallerCallback)
router.get('/truecaller/status/:requestNonce', getTruecallerVerificationStatus)

// Guest session
router.post('/guest', createGuestSession)

// Verify token
router.get('/verify', verifyToken)

export default router
