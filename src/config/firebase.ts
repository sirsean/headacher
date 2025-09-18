// src/config/firebase.ts
// Initializes the Firebase client using Vite env vars
// On mobile we can use redirect, on desktop popup. Analytics is optional.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  // Optional
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
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
