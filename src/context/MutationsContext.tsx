import { useMemo, useCallback, useState, type ReactNode } from 'react'
import { createHeadache, deleteHeadache, createEvent, deleteEvent } from '../api'
import { useAuth } from '../hooks/useAuth'
import { MutationsContext } from './MutationsContext.ts'
import type { EventItem, Headache } from '../types'

export function MutationsProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth } = useAuth()

  const addHeadache = useCallback(async (h: Pick<Headache, 'severity' | 'aura'>) => {
    setError(null)
    await createHeadache(h, fetchWithAuth)
  }, [fetchWithAuth])

  const removeHeadache = useCallback(async (id: number) => {
    setError(null)
    await deleteHeadache(id, fetchWithAuth)
  }, [fetchWithAuth])

  const addEvent = useCallback(async (e: Pick<EventItem, 'event_type' | 'value'>) => {
    setError(null)
    await createEvent(e, fetchWithAuth)
  }, [fetchWithAuth])

  const removeEvent = useCallback(async (id: number) => {
    setError(null)
    await deleteEvent(id, fetchWithAuth)
  }, [fetchWithAuth])

  const value = useMemo(() => ({ addHeadache, removeHeadache, addEvent, removeEvent, error, setError }), [addHeadache, removeHeadache, addEvent, removeEvent, error, setError])

  return (
    <MutationsContext.Provider value={value}>
      {children}
    </MutationsContext.Provider>
  )
}

