import { useEffect, useState, useCallback } from 'react'
import { listHeadaches, listEvents, type ListHeadachesParams, type ListEventsParams } from '../api'
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

  const [headaches, setHeadaches] = useState<Headache[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, e] = await Promise.all([
        listHeadaches(headachesParams),
        listEvents(eventsParams),
      ])
      setHeadaches(h.items)
      setEvents(e.items)
    } catch (err: any) {
      setError(err?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [headachesParams, eventsParams])

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

