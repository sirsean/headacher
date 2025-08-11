import { useState } from 'react'
import { useHeadacheEntries } from './hooks/useHeadacheEntries'
import { useMutations } from './context/MutationsContext'

function getSeverityColor(sev) {
  if (sev <= 3) return 'var(--color-neon-lime)'
  if (sev <= 6) return 'var(--color-attention)'
  if (sev <= 8) return 'var(--color-warn)'
  return 'var(--color-alert)'
}

function formatLocal(ts) {
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

export default function HistoryPage() {
  const [showDeleteHeadaches, setShowDeleteHeadaches] = useState(false)
  const [showDeleteEvents, setShowDeleteEvents] = useState(false)

  const { headaches, events, loading, error, setHeadaches, setEvents, setError } = useHeadacheEntries()
  const { removeHeadache, removeEvent } = useMutations()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {loading && <span className="text-sm text-[--color-subtle]">Loading…</span>}
        {error && <p className="text-sm text-[--color-neon-pink]">Error: {error}</p>}
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
                        await removeHeadache(h.id)
                        setHeadaches((prev) => prev.filter((x) => x.id !== h.id))
                      } catch (e) {
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
                        await removeEvent(e.id)
                        setEvents((prev) => prev.filter((x) => x.id !== e.id))
                      } catch (err) {
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

