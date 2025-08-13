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
      
      // Set the authenticated address
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
        setAddress(account.address)
      } else if (token && !isTokenValid(token)) {
        // Clear expired token
        localStorage.removeItem('auth_token')
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
      setAddress(null)
      // Only redirect if we're not already on the home page
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }

    return response
  }, [])

  const value = useMemo(() => ({
    connect,
    disconnect,
    address,
    loading,
    fetchWithAuth,
  }), [connect, disconnect, address, loading, fetchWithAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
