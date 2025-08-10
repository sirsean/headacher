import { useEffect, useMemo, useState } from 'react'
import type { Headache, EventItem } from './types'
import {
  listHeadaches,
  listEvents,
  createHeadache,
  createEvent,
  deleteHeadache,
  deleteEvent,
} from './api'

function useNowIso() {
  return useMemo(() => new Date().toISOString().slice(0, 19) + 'Z', [])
}

function App() {
  const [headaches, setHeadaches] = useState<Headache[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newHeadache, setNewHeadache] = useState<Omit<Headache, 'id'>>({ timestamp: useNowIso(), severity: 5, aura: 0 })
  const [newEvent, setNewEvent] = useState<Omit<EventItem, 'id'>>({ timestamp: useNowIso(), event_type: 'note', value: '' })

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [h, e] = await Promise.all([
        listHeadaches({ limit: 50 }),
        listEvents({ limit: 50 }),
      ])
      setHeadaches(h.items)
      setEvents(e.items)
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onCreateHeadache(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    try {
      const created = await createHeadache(newHeadache)
      setHeadaches((prev) => [created, ...prev])
    } catch (e: any) {
      setError(e?.message || 'Failed to create headache')
    }
  }

  async function onCreateEvent(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    try {
      const created = await createEvent(newEvent)
      setEvents((prev) => [created, ...prev])
    } catch (e: any) {
      setError(e?.message || 'Failed to create event')
    }
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Headacher</h1>

      <div className="flex items-center gap-3">
        <button className="inline-flex items-center rounded-md bg-neutral-900 text-white px-3 py-2 text-sm disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                onClick={refresh} disabled={loading} aria-label='refresh'>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {error && <p className="text-sm text-red-600">Error: {error}</p>}
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <h2 className="text-xl font-medium mb-3">New Headache</h2>
        <form onSubmit={onCreateHeadache} className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Timestamp</span>
            <input
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
              type='datetime-local'
              value={newHeadache.timestamp.replace('Z', '')}
              onChange={(e) => setNewHeadache({ ...newHeadache, timestamp: new Date(e.target.value).toISOString() })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Severity</span>
            <input
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
              type='number' min={0} max={10}
              value={newHeadache.severity}
              onChange={(e) => setNewHeadache({ ...newHeadache, severity: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Aura</span>
            <select
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
              value={newHeadache.aura}
              onChange={(e) => setNewHeadache({ ...newHeadache, aura: Number(e.target.value) as 0 | 1 })}
            >
              <option value={0}>No</option>
              <option value={1}>Yes</option>
            </select>
          </label>
          <div className="sm:col-span-3">
            <button type='submit' className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm">
              Create
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <h2 className="text-xl font-medium mb-3">Headaches</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {headaches.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2">
              <span className="text-sm">
                {h.timestamp} — sev {h.severity} — aura {h.aura}
              </span>
              <button className="text-sm text-red-600 hover:underline" aria-label={`delete-${h.id}`} onClick={async () => {
                try {
                  await deleteHeadache(h.id!)
                  setHeadaches((prev) => prev.filter((x) => x.id !== h.id))
                } catch (e: any) {
                  setError(e?.message || 'Failed to delete')
                }
              }}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <h2 className="text-xl font-medium mb-3">New Event</h2>
        <form onSubmit={onCreateEvent} className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Timestamp</span>
            <input
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
              type='datetime-local'
              value={newEvent.timestamp.replace('Z', '')}
              onChange={(e) => setNewEvent({ ...newEvent, timestamp: new Date(e.target.value).toISOString() })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Type</span>
            <input
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
              type='text'
              value={newEvent.event_type}
              onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Value</span>
            <input
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
              type='text'
              value={newEvent.value}
              onChange={(e) => setNewEvent({ ...newEvent, value: e.target.value })}
            />
          </label>
          <div className="sm:col-span-3">
            <button type='submit' className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm">
              Create
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <h2 className="text-xl font-medium mb-3">Events</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <span className="text-sm">
                {e.timestamp} — [{e.event_type}] {e.value}
              </span>
              <button className="text-sm text-red-600 hover:underline" aria-label={`delete-event-${e.id}`} onClick={async () => {
                try {
                  await deleteEvent(e.id!)
                  setEvents((prev) => prev.filter((x) => x.id !== e.id))
                } catch (err: any) {
                  setError(err?.message || 'Failed to delete')
                }
              }}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default App
