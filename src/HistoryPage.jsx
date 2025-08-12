import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useHeadacheEntries } from './hooks/useHeadacheEntries'
import { useMutations } from './hooks/useMutations'
import WalletButton from './components/WalletButton'
import DatePicker from './components/DatePicker'
import { dayToUtcRange } from './utils/dateRange'

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
  const { address } = useAuth()
  
  // Show login required state when not authenticated
  if (!address) {
    return (
      <div className="space-y-6">
        <div className="panel text-center">
          <h2 className="font-display text-2xl mb-4 text-[--color-neon-violet]">Authentication Required</h2>
          <div className="space-y-4">
            <p className="text-[--color-subtle] text-lg">
              You need to connect your wallet to view your history.
            </p>
            <p className="text-[--color-subtle]">
              Your history shows all your tracked headaches and events, allowing you to review patterns and make data-driven health decisions.
            </p>
            <WalletButton className="mx-auto" />
          </div>
        </div>
        
        <div className="panel">
          <h3 className="font-display text-lg mb-3 text-[--color-attention]">What You'll Find:</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-display text-base mb-2 text-[--color-neon-cyan]">Headache History</h4>
              <ul className="space-y-1 text-sm text-[--color-subtle]">
                <li>• Complete chronological list</li>
                <li>• Severity levels with color coding</li>
                <li>• Aura indicators</li>
                <li>• Detailed timestamps</li>
                <li>• Edit and delete capabilities</li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-base mb-2 text-[--color-neon-cyan]">Event Timeline</h4>
              <ul className="space-y-1 text-sm text-[--color-subtle]">
                <li>• All recorded events and triggers</li>
                <li>• Categorized by event type</li>
                <li>• Searchable and filterable</li>
                <li>• Full edit and management tools</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const [showDeleteHeadaches, setShowDeleteHeadaches] = useState(false)
  const [showDeleteEvents, setShowDeleteEvents] = useState(false)

  const [params, setParams] = useSearchParams();
  const dateParam = params.get('date') ?? '';
  const [selectedDate, setSelectedDate] = useState(dateParam);

  const dateRange = selectedDate ? dayToUtcRange(selectedDate) : {};

  const headachesParams = useMemo(() => ({ ...dateRange, limit: 50 }), [selectedDate]);
  const eventsParams = useMemo(() => ({ ...dateRange, limit: 50 }), [selectedDate]);

  const { headaches, events, loading, error, setHeadaches, setEvents, setError } = useHeadacheEntries({
    headachesParams,
    eventsParams
  })
  const { removeHeadache, removeEvent } = useMutations()

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <DatePicker
              value={selectedDate}
              onChange={(date) => {
                setSelectedDate(date);
                if (date) {
                  params.set('date', date);
                } else {
                  params.delete('date');
                }
                setParams(params);
              }}
              placeholder="Filter by date..."
            />
          </div>
          {selectedDate && (
            <div className="hidden lg:block text-xs text-[--color-subtle] max-w-48">
              Showing entries for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          )}
        </div>
      </div>
      
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

