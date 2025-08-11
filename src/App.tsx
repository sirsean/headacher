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

function getSeverityColor(sev: number): string {
  if (sev <= 3) return 'var(--color-neon-lime)';
  if (sev <= 6) return 'var(--color-attention)';
  if (sev <= 8) return 'var(--color-warn)';
  return 'var(--color-alert)';
}

function formatLocal(ts: string): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${y}-${m}-${day} ${hours}:${minutes}${ampm}`
}

function App() {
  const [headaches, setHeadaches] = useState<Headache[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newHeadache, setNewHeadache] = useState<{ severity: number; aura: 0 | 1 }>({ severity: 5, aura: 0 })
  const [newEvent, setNewEvent] = useState<{ event_type: string; value: string }>({ event_type: 'note', value: '' })
  const [showDeleteHeadaches, setShowDeleteHeadaches] = useState(false)
  const [showDeleteEvents, setShowDeleteEvents] = useState(false)

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
      // Clear form fields on success
      setNewEvent({ event_type: '', value: '' })
    } catch (e: any) {
      setError(e?.message || 'Failed to create event')
    }
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="font-display text-4xl tracking-wider text-[--color-neon-cyan] drop-shadow-[0_0_12px_rgba(0,229,255,0.35)]">Headacher</h1>

      <div className="flex items-center gap-3">
        {loading && <span className="text-sm text-[--color-subtle]">Loading…</span>}
        {error && <p className="text-sm text-[--color-neon-pink]">Error: {error}</p>}
      </div>

      <div className="panel">
        <h2 className="font-display text-xl mb-3 text-[--color-neon-violet]">New Headache</h2>
        <form onSubmit={onCreateHeadache} className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[--color-subtle]">Severity</span>
              <span className="text-sm font-mono">{newHeadache.severity}</span>
            </div>
            <input
              className="range-severity"
              type='range' min={0} max={10} step={1}
              value={newHeadache.severity}
              onChange={(e) => setNewHeadache({ ...newHeadache, severity: Number(e.target.value) })}
              style={{ ['--percent' as any]: `${(newHeadache.severity / 10) * 100}%`, ['--sev-color' as any]: getSeverityColor(newHeadache.severity) }}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-[--color-subtle]">Aura</span>
            <button
              type="button"
className={`inline-flex items-center justify-center w-28 rounded-full px-3 py-1.5 border transition-colors ${newHeadache.aura === 1 ? 'border-[var(--color-neon-lime)] bg-[var(--color-neon-lime)] text-[#0b0b12]' : 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white'}`}
              onClick={() => setNewHeadache({ ...newHeadache, aura: newHeadache.aura === 1 ? 0 : 1 })}
              aria-pressed={newHeadache.aura === 1}
              aria-label="Toggle aura"
            >
              <span className="text-xs font-semibold tracking-wide">{newHeadache.aura === 1 ? 'YES' : 'NO'}</span>
            </button>
          </div>
          <div className="sm:col-span-3">
            <button type='submit' className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-[--color-neon-violet]">Headaches</h2>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setShowDeleteHeadaches(v => !v)}
            aria-pressed={showDeleteHeadaches}
            title={showDeleteHeadaches ? 'Hide delete' : 'Show delete'}
          >
            <span aria-hidden>{showDeleteHeadaches ? '🙈' : '👁️'}</span>
          </button>
        </div>
        <ul className="divide-y divide-[color:color-mix(in_oklch,var(--color-neon-violet)_18%,transparent)]">
          {headaches.map((h) => (
            <li key={h.id} className="flex items-center py-2">
              <span className="text-sm flex-1">
                <span style={{ color: getSeverityColor(h.severity) }}>sev {h.severity}</span>
                {h.aura === 1 && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-[var(--color-danger)] text-white ml-2 align-middle">AURA</span>
                )}
              </span>
              <div className="ml-3 flex items-center gap-2 shrink-0">
                <span className="text-xs text-[--color-subtle] font-mono whitespace-nowrap">
                  {formatLocal(h.timestamp)}
                </span>
                {showDeleteHeadaches && (
                  <button
                    className="btn-ghost p-1"
                    aria-label={`delete-${h.id}`}
                    title="Delete"
                    onClick={async () => {
                      try {
                        await deleteHeadache(h.id!)
                        setHeadaches((prev) => prev.filter((x) => x.id !== h.id))
                      } catch (e: any) {
                        setError(e?.message || 'Failed to delete')
                      }
                    }}
                  >
                    <span aria-hidden>🗑️</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 className="font-display text-xl mb-3 text-[--color-neon-violet]">New Event</h2>
        <form onSubmit={onCreateEvent} className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[--color-subtle]">Type</span>
            <input
              className="rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] bg-transparent px-2 py-1"
              type='text'
              value={newEvent.event_type}
              onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[--color-subtle]">Value</span>
            <input
              className="rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] bg-transparent px-2 py-1"
              type='text'
              value={newEvent.value}
              onChange={(e) => setNewEvent({ ...newEvent, value: e.target.value })}
            />
          </label>
          <div className="sm:col-span-3">
            <button type='submit' className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-[--color-neon-violet]">Events</h2>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setShowDeleteEvents(v => !v)}
            aria-pressed={showDeleteEvents}
            title={showDeleteEvents ? 'Hide delete' : 'Show delete'}
          >
            <span aria-hidden>{showDeleteEvents ? '🙈' : '👁️'}</span>
          </button>
        </div>
        <ul className="divide-y divide-[color:color-mix(in_oklch,var(--color-neon-violet)_18%,transparent)]">
          {events.map((e) => (
            <li key={e.id} className="flex items-center py-2">
              <span className="text-sm flex-1">
                [{e.event_type}] {e.value}
              </span>
              <div className="ml-3 flex items-center gap-2 shrink-0">
                <span className="text-xs text-[--color-subtle] font-mono whitespace-nowrap">
                  {formatLocal(e.timestamp)}
                </span>
                {showDeleteEvents && (
                  <button
                    className="btn-ghost p-1"
aria-label={`delete-event-${e.id}`}
                    title="Delete"
                    onClick={async () => {
                      try {
                        await deleteEvent(e.id!)
                        setEvents((prev) => prev.filter((x) => x.id !== e.id))
                      } catch (err: any) {
                        setError(err?.message || 'Failed to delete')
                      }
                    }}
                  >
                    <span aria-hidden>🗑️</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default App
