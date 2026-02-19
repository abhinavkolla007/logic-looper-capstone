import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setUser, setGuestMode } from '../features/authSlice'
import { authAPI, getApiErrorMessage } from '../utils/api'
import {
  isTruecallerSupportedDevice,
  startTruecallerVerification,
  waitForTruecallerVerification,
} from '../utils/truecaller'
import type { AppDispatch } from '../features/store'

const GOOGLE_REDIRECT_PENDING_KEY = 'googleRedirectPending'
let firebaseModulePromise: Promise<typeof import('../utils/firebase')> | null = null

function loadFirebaseUtils() {
  if (!firebaseModulePromise) {
    firebaseModulePromise = import('../utils/firebase')
  }
  return firebaseModulePromise
}

function shouldFallbackToRedirect(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('popup') ||
    message.includes('operation-not-supported-in-this-environment') ||
    message.includes('auth/web-storage-unsupported') ||
    message.includes('auth/cancelled-popup-request')
  )
}

export default function AuthScreen() {
  const dispatch = useDispatch<AppDispatch>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const truecallerSupported = isTruecallerSupportedDevice()

  const completeGoogleBackendLogin = useCallback(async (firebaseToken: string) => {
    const response = await authAPI.loginGoogle(firebaseToken)
    const backendToken = response.data?.token as string | undefined
    const backendUser = response.data?.user as {
      id: string
      email: string
      name?: string
    } | undefined

    if (!backendToken || !backendUser?.id) {
      throw new Error('Backend login failed')
    }

    localStorage.setItem('authToken', backendToken)
    localStorage.setItem('userId', backendUser.id)
    localStorage.removeItem('guestId')

    dispatch(setUser({
      id: backendUser.id,
      email: backendUser.email || '',
      name: backendUser.name || undefined,
      authType: 'google',
    }))
  }, [dispatch])

  useEffect(() => {
    const completeRedirect = async () => {
      const hadPendingRedirect = sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1'
      if (!hadPendingRedirect) return
      try {
        const firebaseUtils = await loadFirebaseUtils()
        const firebaseUser = await firebaseUtils.getGoogleRedirectResult()
        let token = firebaseUser?.token || null

        // Redirect result can be null in some browser flows while Firebase still
        // keeps the authenticated user in memory.
        if (!token && !localStorage.getItem('authToken')) {
          token = await firebaseUtils.getTokenForUser()
        }

        // After a redirect return, auth state can hydrate slightly later.
        if (!token && hadPendingRedirect && !localStorage.getItem('authToken')) {
          token = await firebaseUtils.waitForUserToken(6000)
        }

        if (!token) {
          if (hadPendingRedirect) {
            setError('Google sign-in could not be completed. Please try again.')
          }
          return
        }
        setLoading(true)
        setError(null)
        await completeGoogleBackendLogin(token)
        sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
      } catch (err) {
        const errorMsg = getApiErrorMessage(err, 'Google login failed')
        setError(errorMsg)
        console.error('Google redirect completion error:', err)
        sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
      } finally {
        setLoading(false)
      }
    }

    void completeRedirect()
  }, [completeGoogleBackendLogin])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const firebaseUtils = await loadFirebaseUtils()
      const firebaseUser = await firebaseUtils.signInWithGoogle()
      await completeGoogleBackendLogin(firebaseUser.token)
    } catch (err) {
      if (shouldFallbackToRedirect(err)) {
        try {
          sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1')
          const firebaseUtils = await loadFirebaseUtils()
          await firebaseUtils.startGoogleRedirectSignIn()
          return
        } catch (redirectError) {
          const errorMsg = getApiErrorMessage(redirectError, 'Google login failed')
          setError(errorMsg)
          console.error('Google redirect fallback error:', redirectError)
          sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
        }
      } else {
        const errorMsg = getApiErrorMessage(err, 'Google login failed')
        setError(errorMsg)
        console.error('Google login error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGuestLogin = () => {
    const guestId = localStorage.getItem('guestId') || `guest-${Date.now()}`
    localStorage.setItem('guestId', guestId)
    localStorage.removeItem('userId')
    localStorage.removeItem('authToken')
    dispatch(setGuestMode(guestId))
  }

  const handleTruecallerLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const requestNonce = startTruecallerVerification()
      const profile = await waitForTruecallerVerification(requestNonce)
      const response = await authAPI.loginTruecaller(profile)
      const backendToken = response.data?.token as string | undefined
      const backendUser = response.data?.user as {
        id: string
        email: string
        name?: string
      } | undefined

      if (!backendToken || !backendUser?.id) {
        throw new Error('Truecaller backend login failed')
      }

      localStorage.setItem('authToken', backendToken)
      localStorage.setItem('userId', backendUser.id)
      localStorage.removeItem('guestId')

      dispatch(
        setUser({
          id: backendUser.id,
          email: backendUser.email || '',
          name: backendUser.name || undefined,
          authType: 'truecaller',
        })
      )
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, 'Truecaller login failed')
      setError(errorMsg)
      console.error('Truecaller login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F6F5F5] font-poppins">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-10 h-72 w-72 rounded-full bg-[#525CEB]/25 blur-3xl" />
        <div className="absolute -right-20 -top-16 h-80 w-80 rounded-full bg-[#7752FE]/30 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-[#DDF2FD] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#D9E2FF] bg-white/90 p-7 shadow-[0_20px_60px_rgba(25,4,130,0.14)] backdrop-blur-xl sm:p-9">
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-to-r from-[#190482] via-[#414BEA] to-[#7752FE] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              Logic Looper
            </h1>
            <p className="mt-2 text-sm text-[#3D3B40]">Daily logic challenges built for consistency and streak growth</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#414BEA] px-6 py-3 font-semibold text-white shadow-[0_8px_24px_rgba(65,75,234,0.34)] transition hover:-translate-y-0.5 hover:bg-[#525CEB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </>
              ) : (
                <>
                  <i className="fa-brands fa-google text-base" />
                  Continue with Google
                </>
              )}
            </button>

            <button
              onClick={handleTruecallerLogin}
              disabled={loading || !truecallerSupported}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] px-6 py-3 font-semibold text-white shadow-[0_8px_24px_rgba(0,168,132,0.26)] transition hover:-translate-y-0.5 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fa-solid fa-phone" />
              Continue with Truecaller
            </button>

            {!truecallerSupported && (
              <p className="rounded-lg border border-[#D9E2FF] bg-[#F6F5F5] px-3 py-2 text-xs text-[#3D3B40]">
                Truecaller is available only on Android mobile browsers.
              </p>
            )}

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#C2D9FF] bg-[#F8EDFF] px-6 py-3 font-semibold text-[#190482] transition hover:-translate-y-0.5 hover:border-[#7752FE] hover:bg-[#EFE2FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fa-solid fa-user" />
              Play as Guest
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-[#F05537]/30 bg-[#F05537]/10 p-3 text-sm text-[#B63A25]">
              <i className="fa-solid fa-triangle-exclamation mr-2" />
              {error}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[#3D3B40]">
            <i className="fa-solid fa-shield-halved mr-1 text-[#414BEA]" />
            Your progress is stored locally and synced securely
          </p>
        </div>
      </div>
    </div>
  )
}
