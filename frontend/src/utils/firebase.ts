import { initializeApp } from 'firebase/app'
import {
  Auth,
  AuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { env } from './env'

console.log('Firebase config:', {
  apiKey: env.firebase.apiKey ? 'OK' : 'MISSING',
  authDomain: env.firebase.authDomain ? 'OK' : 'MISSING',
  projectId: env.firebase.projectId ? 'OK' : 'MISSING',
  appId: env.firebase.appId ? 'OK' : 'MISSING',
})

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  appId: env.firebase.appId,
}

let app
let auth: Auth
let googleProvider: AuthProvider

try {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  googleProvider = new GoogleAuthProvider()
  console.log('Firebase initialized successfully')
} catch (error) {
  console.error('Firebase initialization failed:', error)
}

export { app, auth, googleProvider }

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user
    const token = await user.getIdToken()

    return {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      token,
      photoURL: user.photoURL,
    }
  } catch (error) {
    console.error('Google signin error:', error)
    throw error
  }
}

export async function startGoogleRedirectSignIn(): Promise<void> {
  await signInWithRedirect(auth, googleProvider)
}

export async function getGoogleRedirectResult() {
  const result = await getRedirectResult(auth)
  if (!result?.user) return null
  const user = result.user
  const token = await user.getIdToken()

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    token,
    photoURL: user.photoURL,
  }
}

export async function waitForUserToken(timeoutMs: number = 5000): Promise<string | null> {
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken()
  }

  return await new Promise<string | null>((resolve) => {
    let unsubscribe = () => {}
    const timer = window.setTimeout(() => {
      unsubscribe()
      resolve(null)
    }, timeoutMs)

    unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      window.clearTimeout(timer)
      unsubscribe()
      resolve(await user.getIdToken())
    })
  })
}

export async function logout() {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Logout error:', error)
    throw error
  }
}

export async function getTokenForUser() {
  if (!auth.currentUser) return null
  return await auth.currentUser.getIdToken()
}

export default app
