import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, sepolia } from 'viem/chains'
import { signMessage, getAccount, disconnect as wagmiDisconnect, getChainId, watchAccount } from '@wagmi/core'
import { SiweMessage } from 'siwe'
import { AuthContext } from './AuthContext'

type AuthProvider = 'SIWE' | 'GOOGLE' | null

interface TokenInfo {
  valid: boolean
  authProvider: AuthProvider
}

// Decode JWT and extract auth provider and validity info
function getAuthProviderFromToken(token: string | null): TokenInfo {
  if (!token) {
    return { valid: false, authProvider: null }
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert to milliseconds
    const valid = Date.now() < exp
    const authProvider = (payload.auth_provider === 'SIWE' || payload.auth_provider === 'GOOGLE') 
      ? payload.auth_provider 
      : null
    return { valid, authProvider }
  } catch {
    return { valid: false, authProvider: null }
  }
}

// Get project ID from environment
const projectId = '3ad651703bdec3b682ddb69769af9fff'

// Set up the Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet, sepolia],
  projectId,
})

// Create the AppKit instance
const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: [mainnet, sepolia],
  projectId,
  metadata: {
    name: 'Headacher',
    description: 'Headache tracking application',
    url: window.location.origin,
    icons: [`${window.location.origin}/favicon.ico`]
  },
  features: {
    analytics: true // Optional: enable analytics
  }
})

// Get the wagmi config from the adapter
const config = wagmiAdapter.wagmiConfig

export function AuthProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authProvider, setAuthProvider] = useState<AuthProvider>(null)

  // Handle SIWE authentication when wallet connects
  const authenticateWithSiwe = useCallback(async (userAddress: string, chainId: number) => {
    try {
      setLoading(true)

      // Get nonce from server
      const nonceResponse = await fetch(`/api/auth/nonce?address=${encodeURIComponent(userAddress)}`, {
        method: 'GET',
      })

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce')
      }

      const { nonce } = await nonceResponse.json()

      // Create SIWE message
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: userAddress,
        statement: `Sign in with Ethereum.`,
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      })

      const message = siweMessage.prepareMessage()

      // Sign message
      const signature = await signMessage(config, { message })

      // Verify signature and get JWT
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature,
          address: userAddress,
        }),
      })

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify signature')
      }

      const { token } = await verifyResponse.json()

      // Store JWT in localStorage
      localStorage.setItem('auth_token', token)
      
      // Set authenticated state
      setIsAuthenticated(true)
      setAddress(userAddress)
      setAuthProvider('SIWE')
      
      return true
    } catch (error) {
      console.error('SIWE authentication failed:', error)
      // Don't disconnect on SIWE failure, just clear our auth state
      setAddress(null)
      localStorage.removeItem('auth_token')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle account changes and trigger auth if needed
  const handleAccountChange = useCallback(async (account: { address?: `0x${string}`, isConnected: boolean }) => {
    // Don't process wallet changes if authenticated via Firebase
    if (authProvider === 'GOOGLE') {
      return
    }
    
    if (!account.isConnected || !account.address) {
      setAddress(null)
      return
    }

    const token = localStorage.getItem('auth_token')
    const tokenInfo = getAuthProviderFromToken(token)
    
    if (token && tokenInfo.valid && tokenInfo.authProvider === 'SIWE') {
      setIsAuthenticated(true)
      setAddress(account.address)
      setAuthProvider('SIWE')
    } else {
      try {
        const chainId = getChainId(config)
        await authenticateWithSiwe(account.address, chainId)
      } catch (error) {
        console.error('Authentication failed on account change:', error)
        setAddress(null)
      }
    }
  }, [authenticateWithSiwe, authProvider])

  // Helper to exchange Firebase ID token for app JWT
  const exchangeFirebaseTokenForJWT = useCallback(async (idToken: string) => {
    const resp = await fetch('/api/auth/google/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!resp.ok) throw new Error('Google verify failed')
    const { token } = await resp.json()
    localStorage.setItem('auth_token', token)
    setIsAuthenticated(true)
    setAddress(getAccount(config)?.address ?? null)
    setAuthProvider('GOOGLE')
  }, [])

  // Initialize auth state on mount and handle session restoration
  useEffect(() => {
    let mounted = true
    let unsubscribeAuthState: (() => void) | null = null
    
    const initializeAuth = async () => {
      // Configure Firebase persistence first
      try {
        const { configureAuthPersistence } = await import('../config/firebase')
        await configureAuthPersistence()
      } catch (error) {
        console.error('Failed to configure Firebase persistence:', error)
      }

      // Check for Firebase redirect result first (mobile flow)
      try {
        const { handleRedirectResult } = await import('../config/firebase')
        const firebaseToken = await handleRedirectResult()
        if (firebaseToken && mounted) {
          console.log('Redirect result detected, exchanging token')
          await exchangeFirebaseTokenForJWT(firebaseToken)
          return // Early exit, we're authenticated
        }
      } catch (error) {
        console.error('Failed to handle redirect result:', error)
      }

      // Set up Firebase auth state listener
      try {
        const { setupAuthStateListener } = await import('../config/firebase')
        unsubscribeAuthState = setupAuthStateListener(async (user) => {
          if (!mounted) return
          
          const token = localStorage.getItem('auth_token')
          const tokenInfo = getAuthProviderFromToken(token)
          
          // If Firebase user exists but we don't have a valid JWT, exchange tokens
          if (user && (!token || !tokenInfo.valid)) {
            try {
              console.log('Firebase user detected without valid JWT, exchanging token')
              const idToken = await user.getIdToken(true)
              await exchangeFirebaseTokenForJWT(idToken)
            } catch (error) {
              console.error('Failed to exchange Firebase token:', error)
            }
          }
        })
      } catch (error) {
        console.error('Failed to set up auth state listener:', error)
      }

      if (!mounted) return
      
      // Check existing token and determine auth flow
      const token = localStorage.getItem('auth_token')
      const tokenInfo = getAuthProviderFromToken(token)
      
      // Firebase auth flow: token exists and is GOOGLE provider
      if (tokenInfo.valid && tokenInfo.authProvider === 'GOOGLE') {
        console.log('Restoring Firebase auth session')
        setIsAuthenticated(true)
        setAuthProvider('GOOGLE')
        setAddress(null) // Firebase auth doesn't require wallet
        return // Exit early, skip all wallet checks
      }
      
      // SIWE auth flow or no auth: check wallet connection
      // Wait a bit for wallet connection state to be restored by AppKit/Wagmi
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!mounted) return
      
      const account = getAccount(config)
      
      // Clear expired token
      if (token && !tokenInfo.valid) {
        localStorage.removeItem('auth_token')
        setIsAuthenticated(false)
        setAddress(null)
        setAuthProvider(null)
      }
      
      // SIWE token exists and is valid, restore session
      if (account?.address && tokenInfo.valid && tokenInfo.authProvider === 'SIWE') {
        console.log('Restoring SIWE auth session')
        setIsAuthenticated(true)
        setAddress(account.address)
        setAuthProvider('SIWE')
      } else if (account?.address && !tokenInfo.valid) {
        // Wallet connected but no valid token - trigger SIWE authentication
        try {
          const chainId = getChainId(config)
          await authenticateWithSiwe(account.address, chainId)
        } catch (error) {
          console.error('Initial authentication failed:', error)
          setAddress(null)
        }
      } else {
        // No wallet connected and no valid token
        setAddress(null)
      }
    }
    
    initializeAuth()
    
    return () => {
      mounted = false
      if (unsubscribeAuthState) {
        unsubscribeAuthState()
      }
    }
  }, [exchangeFirebaseTokenForJWT, authenticateWithSiwe])
  
  // Set up account watcher for real-time updates
  useEffect(() => {
    // Only watch account changes when authenticated via SIWE
    if (authProvider !== 'SIWE') {
      return
    }
    
    const unwatch = watchAccount(config, {
      onChange: handleAccountChange,
    })
    
    return unwatch
  }, [handleAccountChange, authProvider])

  const connect = useCallback(async () => {
    try {
      setLoading(true)
      
      // If already authenticated via Firebase, this is likely for linking wallet - proceed
      // If already authenticated via SIWE, this is likely reconnecting - proceed
      // Otherwise, this is a new wallet connection attempt
      
      // Check current account state first
      const currentAccount = getAccount(config)
      const currentToken = localStorage.getItem('auth_token')
      const tokenInfo = getAuthProviderFromToken(currentToken)
      
      // If already connected with valid SIWE auth, don't need to do anything
      if (currentAccount?.address && tokenInfo.valid && tokenInfo.authProvider === 'SIWE') {
        setAddress(currentAccount.address)
        return
      }
      
      // If account is connected but no valid token (or token is not SIWE), authenticate directly
      if (currentAccount?.address && (!tokenInfo.valid || tokenInfo.authProvider !== 'SIWE')) {
        try {
          const chainId = getChainId(config)
          await authenticateWithSiwe(currentAccount.address, chainId)
          return
        } catch (error) {
          console.error('Direct authentication failed, opening modal:', error)
          // Fall through to modal opening
        }
      }

      // Open the AppKit modal for wallet connection
      modal.open()
      
    } catch (error) {
      console.error('Connection failed:', error)
      setAddress(null)
      throw error
    } finally {
      setLoading(false)
    }
  }, [authenticateWithSiwe])


  const disconnect = useCallback(async () => {
    try {
      setLoading(true)
      
      // If authenticated via SIWE, disconnect wallet
      if (authProvider === 'SIWE') {
        await wagmiDisconnect(config)
      }
      
      // If authenticated via Firebase, sign out
      if (authProvider === 'GOOGLE') {
        const { signOut } = await import('../config/firebase')
        await signOut()
      }
      
      // Clear only app-specific localStorage keys instead of clearing everything
      localStorage.removeItem('auth_token')
      
      setAddress(null)
      setIsAuthenticated(false)
      setAuthProvider(null)
    } catch (error) {
      console.error('Disconnect failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [authProvider])

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token')
    
    const headers = {
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Handle 401 responses by auto-logout
    if (response.status === 401) {
      localStorage.removeItem('auth_token')
      
      // Sign out Firebase if authenticated via Google
      if (authProvider === 'GOOGLE') {
        const { signOut } = await import('../config/firebase')
        await signOut().catch(console.error)
      }
      
      setIsAuthenticated(false)
      setAddress(null)
      setAuthProvider(null)
      
      // Only redirect if we're not already on the home page
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }

    return response
  }, [authProvider])

  // Google login via Firebase -> exchange for app JWT
  const loginWithGoogle = useCallback(async () => {
    try {
      setLoading(true)
      const isNarrow = window.matchMedia('(max-width: 640px)').matches
      const { signInWithGooglePopup, signInWithGoogleRedirect, getFirebaseAuth } = await import('../config/firebase')
      let idToken: string | null = null

      if (isNarrow) {
        // For redirect flow, we need to handle the result after redirect.
        // Here, prefer popup for simplicity; if blocked, fallback to redirect.
        try {
          const r = await signInWithGooglePopup()
          idToken = r.idToken
        } catch {
          await signInWithGoogleRedirect()
          // After redirect back, Firebase will have a currentUser; get token then
          const auth = getFirebaseAuth()
          if (auth.currentUser) idToken = await auth.currentUser.getIdToken(true)
        }
      } else {
        const r = await signInWithGooglePopup()
        idToken = r.idToken
      }

      if (!idToken) throw new Error('Failed to obtain Google ID token')

      await exchangeFirebaseTokenForJWT(idToken)
    } catch (error) {
      console.error('Google login failed:', error)
      setAuthProvider(null)
      throw error
    } finally {
      setLoading(false)
    }
  }, [exchangeFirebaseTokenForJWT])

  // Link Google to current logged-in account (does not change current JWT)
  const linkWithGoogle = useCallback(async () => {
    try {
      setLoading(true)
      const { signInWithGooglePopup } = await import('../config/firebase')
      const r = await signInWithGooglePopup()
      const idToken = r.idToken
      const resp = await fetch('/api/auth/link/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}) },
        body: JSON.stringify({ idToken }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Failed to link Google account')
      }
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  // Link SIWE to current logged-in account (does not change current JWT)
  const linkWithSiwe = useCallback(async () => {
    try {
      setLoading(true)
      const account = getAccount(config)
      if (!account?.address) throw new Error('Connect your wallet first in order to link it')
      const userAddress = account.address
      const chainId = getChainId(config)

      // Get nonce
      const nonceRes = await fetch(`/api/auth/nonce?address=${encodeURIComponent(userAddress)}`)
      if (!nonceRes.ok) throw new Error('Failed to get nonce')
      const { nonce } = await nonceRes.json()

      // Build SIWE message
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: userAddress,
        statement: 'Link wallet to your Headacher account.',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      })
      const message = siweMessage.prepareMessage()
      const signature = await signMessage(config, { message })

      // Call link endpoint with current JWT
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/auth/link/siwe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message, signature }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Failed to link wallet')
      }
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  // Identities cache for nav/settings
  const [identities, setIdentities] = useState<import('../types').Identity[] | null>(null)
  const refreshIdentities = useCallback(async () => {
    const res = await fetchWithAuth('/api/auth/identities')
    const data = await res.json().catch(() => ({})) as { identities?: import('../types').Identity[] }
    setIdentities(data.identities ?? [])
  }, [fetchWithAuth])

  useEffect(() => {
    if (isAuthenticated) {
      refreshIdentities().catch(() => setIdentities([]))
    } else {
      setIdentities(null)
    }
  }, [isAuthenticated, refreshIdentities])

  const value = useMemo(() => ({
    connect,
    disconnect,
    address,
    isAuthenticated,
    loading,
    authProvider,
    fetchWithAuth,
    loginWithGoogle,
    linkWithGoogle,
    linkWithSiwe,
    identities,
    refreshIdentities,
  }), [connect, disconnect, address, isAuthenticated, loading, authProvider, fetchWithAuth, loginWithGoogle, linkWithGoogle, linkWithSiwe, identities, refreshIdentities])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
