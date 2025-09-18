import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, sepolia } from 'viem/chains'
import { signMessage, getAccount, disconnect as wagmiDisconnect, getChainId, watchAccount } from '@wagmi/core'
import { SiweMessage } from 'siwe'
import { AuthContext } from './AuthContext'

// Simple JWT token validation (check if expired)
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert to milliseconds
    return Date.now() < exp
  } catch {
    return false
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
    if (!account.isConnected || !account.address) {
      setAddress(null)
      return
    }

    const token = localStorage.getItem('auth_token')
    
    if (token && isTokenValid(token)) {
      setIsAuthenticated(true)
      setAddress(account.address)
    } else {
      try {
        const chainId = getChainId(config)
        await authenticateWithSiwe(account.address, chainId)
      } catch (error) {
        console.error('Authentication failed on account change:', error)
        setAddress(null)
      }
    }
  }, [authenticateWithSiwe])

  // Initialize auth state on mount and handle session restoration
  useEffect(() => {
    let mounted = true
    
    const initializeAuth = async () => {
      // Wait a bit for wallet connection state to be restored by AppKit/Wagmi
      // This is necessary because the wallet connection isn't immediately available on page load
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!mounted) return
      
      const account = getAccount(config)
      const token = localStorage.getItem('auth_token')
      
      if (account?.address && token && isTokenValid(token)) {
        // We have both a connected account and valid token - restore session
        setIsAuthenticated(true)
        setAddress(account.address)
      } else if (token && !isTokenValid(token)) {
        // Clear expired token
        localStorage.removeItem('auth_token')
        setIsAuthenticated(false)
        setAddress(null)
      } else if (account?.address && (!token || !isTokenValid(token))) {
        // Account is connected but no valid auth - trigger authentication
        try {
          const chainId = getChainId(config)
          await authenticateWithSiwe(account.address, chainId)
        } catch (error) {
          console.error('Initial authentication failed:', error)
          // Don't disconnect, just clear our auth state
          setAddress(null)
        }
      } else {
        setAddress(null)
        
        // If we have a valid token but no account detected yet, 
        // set up a retry mechanism to check again
        if (token && isTokenValid(token)) {
          const retryCount = 5
          const retryDelay = 500
          
          for (let i = 0; i < retryCount; i++) {
            if (!mounted) return
            
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            const retryAccount = getAccount(config)
            
            if (retryAccount?.address) {
              setIsAuthenticated(true)
              setAddress(retryAccount.address)
              return
            }
          }
        }
      }
    }
    
    initializeAuth()
    
    return () => {
      mounted = false
    }
  }, [])
  
  // Set up account watcher for real-time updates
  useEffect(() => {
    const unwatch = watchAccount(config, {
      onChange: handleAccountChange,
    })
    
    return unwatch
  }, [handleAccountChange])

  const connect = useCallback(async () => {
    try {
      setLoading(true)
      
      // Check current account state first
      const currentAccount = getAccount(config)
      const currentToken = localStorage.getItem('auth_token')
      
      // If already connected with valid auth, don't need to do anything
      if (currentAccount?.address && currentToken && isTokenValid(currentToken)) {
        setAddress(currentAccount.address)
        return
      }
      
      // If account is connected but no valid token, authenticate directly
      if (currentAccount?.address && (!currentToken || !isTokenValid(currentToken))) {
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
      // wagmiDisconnect automatically disconnects any active connector,
      // including WalletConnect sessions - no additional cleanup needed
      await wagmiDisconnect(config)
      setAddress(null)
      
      // Clear all localStorage to ensure clean state on next login
      localStorage.clear()
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Disconnect failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

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
      setIsAuthenticated(false)
      setAddress(null)
      // Only redirect if we're not already on the home page
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }

    return response
  }, [])

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
        } catch (e) {
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

      const resp = await fetch('/api/auth/google/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!resp.ok) throw new Error('Google verify failed')
      const { token } = await resp.json()
      localStorage.setItem('auth_token', token)

      // Mark authenticated; wallet may or may not be connected
      setIsAuthenticated(true)
      setAddress(getAccount(config)?.address ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

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
    fetchWithAuth,
    loginWithGoogle,
    linkWithGoogle,
    linkWithSiwe,
    identities,
    refreshIdentities,
  }), [connect, disconnect, address, isAuthenticated, loading, fetchWithAuth, loginWithGoogle, linkWithGoogle, linkWithSiwe, identities, refreshIdentities])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
