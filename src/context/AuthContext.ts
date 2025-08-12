import { createContext } from 'react'

export interface AuthContextValue {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  address: string | null
  loading: boolean
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
