import { useContext } from 'react'
import { MutationsContext } from '../context/MutationsContext'

export function useMutations() {
  const ctx = useContext(MutationsContext)
  if (!ctx) throw new Error('useMutations must be used within <MutationsProvider>')
  return ctx
}
