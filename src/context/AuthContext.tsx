import { createContext, useContext, useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createConfig, http, connect as wagmiConnect, disconnect as wagmiDisconnect, signMessage, getAccount } from '@wagmi/core'
import { mainnet, sepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'
import { SiweMessage } from 'siwe'

// Configure wagmi with WalletConnect for mobile support
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId,
      metadata: {
        name: 'Headacher',
        description: 'Headache tracking application',
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`]
      }
    })
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

interface AuthContextValue {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  address: string | null
  loading: boolean
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check for existing auth on mount
  useEffect(() => {
    const account = getAccount(config)
    if (account.address) {
      setAddress(account.address)
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      setLoading(true)

      // Try to connect with injected wallet first
      const result = await wagmiConnect(config, { connector: injected() })
      
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
      console.log('Got nonce:', nonce)
      console.log('Chain ID:', result.chainId)
      console.log('Domain:', window.location.host)
      console.log('Address:', userAddress)

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
      console.log('SIWE message object created')
      console.log(siweMessage);

      const message = siweMessage.prepareMessage()
      console.log('SIWE message prepared:', message)
      console.log('Message lines:', message.split('\n').length)

      // Sign message
      console.log('About to sign message...')
      const signature = await signMessage(config, { message })
      console.log('Message signed, signature:', signature)

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
