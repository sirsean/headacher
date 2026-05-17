import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  listHeadaches,
  listEvents,
  listHrv,
  type ListHeadachesParams,
  type ListEventsParams,
  type ListHrvParams,
  type HrvDaily,
} from '../api'
import { useAuth } from './useAuth'
import type { EventItem, Headache } from '../types'

const DEFAULT_HEADACHES_PARAMS: ListHeadachesParams = { limit: 50 };
const DEFAULT_EVENTS_PARAMS:   ListEventsParams   = { limit: 50 };

export interface UseHeadacheEntriesOptions {
  headachesParams?: ListHeadachesParams
  eventsParams?: ListEventsParams
  hrvParams?: ListHrvParams | null
}

export function useHeadacheEntries(options: UseHeadacheEntriesOptions = {}) {
  const {
    headachesParams = DEFAULT_HEADACHES_PARAMS,
    eventsParams    = DEFAULT_EVENTS_PARAMS,
    hrvParams       = null,
  } = options;

  // Memoize parameters to avoid unnecessary re-renders
  const headachesParamsKey = JSON.stringify(headachesParams)
  const eventsParamsKey = JSON.stringify(eventsParams)
  const hrvParamsKey = JSON.stringify(hrvParams)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHeadachesParams = useMemo(() => headachesParams, [headachesParamsKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedEventsParams = useMemo(() => eventsParams, [eventsParamsKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHrvParams = useMemo(() => hrvParams, [hrvParamsKey])

  const [headaches, setHeadaches] = useState<Headache[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [hrv, setHrv] = useState<HrvDaily[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth } = useAuth()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const requests: [
        Promise<{ items: Headache[] }>,
        Promise<{ items: EventItem[] }>,
        Promise<{ items: HrvDaily[] }> | null,
      ] = [
        listHeadaches(memoizedHeadachesParams, fetchWithAuth),
        listEvents(memoizedEventsParams, fetchWithAuth),
        memoizedHrvParams != null ? listHrv(memoizedHrvParams, fetchWithAuth) : null,
      ]
      const [h, e, hrvRes] = await Promise.all([
        requests[0],
        requests[1],
        requests[2] ?? Promise.resolve({ items: [] as HrvDaily[] }),
      ])
      setHeadaches(h.items)
      setEvents(e.items)
      setHrv(hrvRes.items)
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [memoizedHeadachesParams, memoizedEventsParams, memoizedHrvParams, fetchWithAuth])

  useEffect(() => {
    // Fetch only when the page that uses this hook mounts
    refresh()
  }, [refresh])

  return {
    headaches,
    events,
    hrv,
    loading,
    error,
    refresh,
    setHeadaches,
    setEvents,
    setHrv,
    setError,
  }
}

