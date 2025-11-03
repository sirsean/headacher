// src/config/firebase.ts
// Initializes the Firebase client using Vite env vars
// On mobile we can use redirect, on desktop popup. Analytics is optional.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  // Optional
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) || undefined,
}

let app: FirebaseApp

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
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
