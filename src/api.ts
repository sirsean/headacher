import type { Headache, EventItem } from './types'

const API_BASE = '' // same-origin

// Utility: handle JSON with error shape { error: { status, message, details } }
async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as any)?.error ?? { status: res.status, message: res.statusText }
    const e = new Error(err.message || 'Request failed') as Error & { status?: number; details?: unknown }
    e.status = err.status ?? res.status
    e.details = err.details
    throw e
  }
  return data as T
}

// Headaches
export interface ListHeadachesParams {
  since?: string
  until?: string
  severity_min?: number
  severity_max?: number
  limit?: number
  offset?: number
}

export async function listHeadaches(params: ListHeadachesParams = {}): Promise<{ items: Headache[] }> {
  const u = new URL('/api/headaches', window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  })
  const res = await fetch(u.toString())
  return handleJson(res)
}

export async function createHeadache(h: Pick<Headache, 'severity' | 'aura'>): Promise<Headache> {
  const res = await fetch(`${API_BASE}/api/headaches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(h),
  })
  return handleJson(res)
}

export async function getHeadache(id: number): Promise<Headache> {
  const res = await fetch(`${API_BASE}/api/headaches/${id}`)
  return handleJson(res)
}

export async function updateHeadache(id: number, patch: Partial<Omit<Headache, 'id'>>): Promise<Headache> {
  const res = await fetch(`${API_BASE}/api/headaches/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return handleJson(res)
}

export async function deleteHeadache(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/headaches/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) await handleJson(res)
}

// Events
export interface ListEventsParams {
  since?: string
  until?: string
  type?: string // event_type
  limit?: number
  offset?: number
}

export async function listEvents(params: ListEventsParams = {}): Promise<{ items: EventItem[] }> {
  const u = new URL('/api/events', window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  })
  const res = await fetch(u.toString())
  return handleJson(res)
}

export async function createEvent(e: Pick<EventItem, 'event_type' | 'value'>): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(e),
  })
  return handleJson(res)
}

export async function getEvent(id: number): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/api/events/${id}`)
  return handleJson(res)
}

export async function updateEvent(id: number, patch: Partial<Omit<EventItem, 'id'>>): Promise<EventItem> {
  const res = await fetch(`${API_BASE}/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return handleJson(res)
}

export async function deleteEvent(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/events/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) await handleJson(res)
}

// Dashboard
export interface DashboardData {
  days_requested: number
  start_date: string
  end_date: string
  headaches: Array<{
    timestamp: string
    severity: number
    aura: number
  }>
  events: Array<{
    event_type: string
    value: string
    timestamp: string
  }>
}

export async function getDashboardData(days: number = 30): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/api/dashboard?days=${days}`)
  return handleJson(res)
}
