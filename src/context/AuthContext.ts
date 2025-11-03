import { createContext } from 'react'

export interface AuthContextValue {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  address: string | null
  isAuthenticated: boolean
  loading: boolean
  authProvider: 'SIWE' | 'GOOGLE' | null
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
  loginWithGoogle: () => Promise<void>
  linkWithGoogle: () => Promise<boolean>
  linkWithSiwe: () => Promise<boolean>
  identities: import('../types').Identity[] | null
  refreshIdentities: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
