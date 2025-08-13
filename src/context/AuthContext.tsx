import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createConfig, http, connect as wagmiConnect, disconnect as wagmiDisconnect, signMessage, getAccount, watchAccount } from '@wagmi/core'
import { mainnet, sepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'
import { SiweMessage } from 'siwe'
import { AuthContext } from './AuthContext'
import { isMobile } from '../utils/isMobile'

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

// Configure wagmi with WalletConnect for mobile support
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// Create connector instances to reuse across config and connect calls
const injectedConnector = injected()
const walletConnectConnector = walletConnect({
  projectId,
  metadata: {
    name: 'Headacher',
    description: 'Headache tracking application',
    url: window.location.origin,
    icons: [`${window.location.origin}/favicon.ico`]
  }
})

const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injectedConnector,
    walletConnectConnector
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check for existing auth on mount and watch for account changes
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    
    // Function to sync auth state with current account
    const syncAuthState = (account: { address?: `0x${string}` } | undefined) => {
      if (account?.address && token && isTokenValid(token)) {
        // We have both a connected wallet and a valid token
        setAddress(account.address)
      } else if (token && !isTokenValid(token)) {
        // If we have an invalid/expired token, clear it
        localStorage.removeItem('auth_token')
        setAddress(null)
      } else if (!token) {
        // No token, make sure address is cleared
        setAddress(null)
      }
      // NOTE: If we have a valid token but no account.address yet,
      // we wait for the wallet to initialize via the account watcher
    }

    // Initial check
    const initialAccount = getAccount(config)
    syncAuthState(initialAccount)

    // Watch for account changes (connects, disconnects, switches)
    const unwatchAccount = watchAccount(config, {
      onChange: (account) => {
        const currentToken = localStorage.getItem('auth_token')
        
        if (account.address && currentToken && isTokenValid(currentToken)) {
          // Account connected and we have a valid token
          setAddress(account.address)
        } else if (account.address && currentToken && !isTokenValid(currentToken)) {
          // Account connected but token is expired/invalid
          localStorage.removeItem('auth_token')
          setAddress(null)
        } else if (!account.address && address) {
          // Account was disconnected (we had an address before, now we don't)
          if (currentToken) {
            localStorage.removeItem('auth_token')
          }
          setAddress(null)
        }
        // NOTE: We don't delete tokens just because account.address is undefined
        // during initialization - only when there's an explicit disconnect
      }
    })

    // Cleanup watcher on unmount
    return unwatchAccount
  }, [])

  const connect = useCallback(async () => {
    try {
      setLoading(true)

      // Choose connector based on device type
      const preferredConnector = isMobile ? walletConnectConnector : injectedConnector

      let result
      try {
        result = await wagmiConnect(config, { connector: preferredConnector })
      } catch {
        // graceful fallback: try the other connector
        const fallback = isMobile ? injectedConnector : walletConnectConnector
        result = await wagmiConnect(config, { connector: fallback })
      }
      
      if (!result.accounts[0]) {
        throw new Error('No account connected')
      }

      const userAddress = result.accounts[0]
      setAddress(userAddress)

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
        chainId: result.chainId,
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
      
      // Ensure address is still set after successful auth
      setAddress(userAddress)

    } catch (error) {
      console.error('Connection failed:', error)
      setAddress(null)
      // Disconnect on error
      await wagmiDisconnect(config)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      setLoading(true)
      // wagmiDisconnect automatically disconnects any active connector,
      // including WalletConnect sessions - no additional cleanup needed
      await wagmiDisconnect(config)
      setAddress(null)
      localStorage.removeItem('auth_token')
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
