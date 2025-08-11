import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createHeadache, deleteHeadache, createEvent, deleteEvent } from '../api'
import type { EventItem, Headache } from '../types'

interface MutationsContextValue {
  addHeadache: (h: Pick<Headache, 'severity' | 'aura'>) => Promise<void>
  removeHeadache: (id: number) => Promise<void>
  addEvent: (e: Pick<EventItem, 'event_type' | 'value'>) => Promise<void>
  removeEvent: (id: number) => Promise<void>
  error: string | null
  setError: (msg: string | null) => void
}

const MutationsContext = createContext<MutationsContextValue | undefined>(undefined)

export function useMutations() {
  const ctx = useContext(MutationsContext)
  if (!ctx) throw new Error('useMutations must be used within <MutationsProvider>')
  return ctx
}

export function MutationsProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null)

  async function addHeadache(h: Pick<Headache, 'severity' | 'aura'>) {
    setError(null)
    await createHeadache(h)
  }

  async function removeHeadache(id: number) {
    setError(null)
    await deleteHeadache(id)
  }

  async function addEvent(e: Pick<EventItem, 'event_type' | 'value'>) {
    setError(null)
    await createEvent(e)
  }

  async function removeEvent(id: number) {
    setError(null)
    await deleteEvent(id)
  }

  const value = useMemo(() => ({ addHeadache, removeHeadache, addEvent, removeEvent, error, setError }), [error])

  return (
    <MutationsContext.Provider value={value}>
      {children}
    </MutationsContext.Provider>
  )
}

