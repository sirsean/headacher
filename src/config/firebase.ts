// src/config/firebase.ts
// Initializes the Firebase client using Vite env vars
// On mobile we can use redirect, on desktop popup. Analytics is optional.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics'

const FIREBASE_SETUP_HELP =
  'Create a Web app in the Firebase console, enable Google as a sign-in provider, add this dev origin under Authentication → Settings → Authorized domains, then put VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID in .env.local (see docs/DUAL_AUTH.md). Use the same project ID the Worker verifies (FIREBASE_PROJECT_ID in wrangler).'

function readFirebaseEnv() {
  return {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() ?? '',
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim() ?? '',
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim() ?? '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined)?.trim() ?? '',
    measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined)?.trim() || undefined,
  }
}

/** True when all required Vite Firebase env vars are set (Google sign-in will not work without them). */
export function isFirebaseConfigured(): boolean {
  const e = readFirebaseEnv()
  return Boolean(e.apiKey && e.authDomain && e.projectId && e.appId)
}

let app: FirebaseApp

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(`Firebase is not configured. ${FIREBASE_SETUP_HELP}`)
  }
  if (!app) {
    const e = readFirebaseEnv()
    const firebaseConfig = {
      apiKey: e.apiKey,
      authDomain: e.authDomain,
      projectId: e.projectId,
      appId: e.appId,
      measurementId: e.measurementId,
    }
    app = getApps()[0] ?? initializeApp(firebaseConfig)
    // Analytics is optional and only works in browser contexts
    analyticsIsSupported().then((ok) => {
      if (ok) {
        try { getAnalytics(app) } catch { /* noop */ }
      }
    })
  }
  return app
}

export function getFirebaseAuth() {
  const a = getAuth(getFirebaseApp())
  a.useDeviceLanguage()
  return a
}

export const googleProvider = new GoogleAuthProvider()

// Helpers for UI flows
export async function signInWithGooglePopup() {
  const auth = getFirebaseAuth()
  const cred = await signInWithPopup(auth, googleProvider)
  const idToken = await cred.user.getIdToken(true)
  return { idToken, user: cred.user }
}

export async function signInWithGoogleRedirect() {
  const auth = getFirebaseAuth()
  await signInWithRedirect(auth, googleProvider)
}

// Handle redirect result after user returns from Google sign-in
export async function handleRedirectResult(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth()
    const result = await getRedirectResult(auth)
    if (result?.user) {
      const idToken = await result.user.getIdToken(true)
      return idToken
    }
    return null
  } catch (error) {
    console.error('Error handling redirect result:', error)
    return null
  }
}

// Set up Firebase auth state listener
export function setupAuthStateListener(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, callback)
}

// Configure Firebase Auth persistence (call once on app init)
export async function configureAuthPersistence(): Promise<void> {
  try {
    const auth = getFirebaseAuth()
    await setPersistence(auth, indexedDBLocalPersistence)
  } catch (error) {
    console.error('Error configuring Firebase persistence:', error)
  }
}

// Sign out from Firebase
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth()
  await firebaseSignOut(auth)
}
