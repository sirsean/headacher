import { createContext } from 'react'
import type { EventItem, Headache } from '../types'

export interface MutationsContextValue {
  addHeadache: (h: Pick<Headache, 'severity' | 'aura'>) => Promise<void>
  removeHeadache: (id: number) => Promise<void>
  addEvent: (e: Pick<EventItem, 'event_type' | 'value'>) => Promise<void>
  removeEvent: (id: number) => Promise<void>
  error: string | null
  setError: (msg: string | null) => void
}

export const MutationsContext = createContext<MutationsContextValue | undefined>(undefined)
