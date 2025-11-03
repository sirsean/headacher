import { useEffect, useState, useCallback, useMemo } from 'react'
import { listHeadaches, listEvents, type ListHeadachesParams, type ListEventsParams } from '../api'
import { useAuth } from './useAuth'
import type { EventItem, Headache } from '../types'

const DEFAULT_HEADACHES_PARAMS: ListHeadachesParams = { limit: 50 };
const DEFAULT_EVENTS_PARAMS:   ListEventsParams   = { limit: 50 };

export interface UseHeadacheEntriesOptions {
  headachesParams?: ListHeadachesParams
  eventsParams?: ListEventsParams
}

export function useHeadacheEntries(options: UseHeadacheEntriesOptions = {}) {
  const {
    headachesParams = DEFAULT_HEADACHES_PARAMS,
    eventsParams    = DEFAULT_EVENTS_PARAMS,
  } = options;

  // Memoize parameters to avoid unnecessary re-renders
  const headachesParamsKey = JSON.stringify(headachesParams)
  const eventsParamsKey = JSON.stringify(eventsParams)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHeadachesParams = useMemo(() => headachesParams, [headachesParamsKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedEventsParams = useMemo(() => eventsParams, [eventsParamsKey])

  const [headaches, setHeadaches] = useState<Headache[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth } = useAuth()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, e] = await Promise.all([
        listHeadaches(memoizedHeadachesParams, fetchWithAuth),
        listEvents(memoizedEventsParams, fetchWithAuth),
      ])
      setHeadaches(h.items)
      setEvents(e.items)
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [memoizedHeadachesParams, memoizedEventsParams, fetchWithAuth])

  useEffect(() => {
    // Fetch only when the page that uses this hook mounts
    refresh()
  }, [refresh])

  return {
    headaches,
    events,
    loading,
    error,
    refresh,
    setHeadaches,
    setEvents,
    setError,
  }
}

