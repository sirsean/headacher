import { useState } from 'react'
import { useMutations } from '../context/MutationsContext'
import { useNotifications } from '../context/NotificationContext'

function getSeverityColor(sev: number): string {
  if (sev <= 3) return 'var(--color-neon-lime)'
  if (sev <= 6) return 'var(--color-attention)'
  if (sev <= 8) return 'var(--color-warn)'
  return 'var(--color-alert)'
}

interface HeadacheEntryFormProps {
  onSuccess?: () => void
  showTitle?: boolean
  compact?: boolean
}

export default function HeadacheEntryForm({ 
  onSuccess, 
  showTitle = true, 
  compact = false 
}: HeadacheEntryFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [newHeadache, setNewHeadache] = useState({ severity: 5, aura: 0 })
  const [newEvent, setNewEvent] = useState({ event_type: 'note', value: '' })
  const { addHeadache, addEvent } = useMutations()
  const { success, error: showError } = useNotifications()

  async function onCreateHeadache(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    try {
      await addHeadache(newHeadache)
      setNewHeadache({ severity: 5, aura: 0 })
      success(`Headache recorded (severity: ${newHeadache.severity}${newHeadache.aura ? ', with aura' : ''})`)
      onSuccess?.()
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to create headache'
      setError(errorMsg)
      showError(errorMsg)
    }
  }

  async function onCreateEvent(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    
    // Validate form inputs
    if (!newEvent.event_type.trim()) {
      const errorMsg = 'Event type is required'
      setError(errorMsg)
      showError(errorMsg)
      return
    }
    
    if (!newEvent.value.trim()) {
      const errorMsg = 'Event value is required'
      setError(errorMsg)
      showError(errorMsg)
      return
    }
    
    try {
      await addEvent(newEvent)
      const shortValue = newEvent.value.length > 20 ? newEvent.value.substring(0, 20) + '...' : newEvent.value
      success(`Event logged: [${newEvent.event_type}] ${shortValue}`)
      setNewEvent({ event_type: 'note', value: '' })
      onSuccess?.()
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to create event'
      setError(errorMsg)
      showError(errorMsg)
    }
  }

  const containerClass = compact ? "space-y-4" : "space-y-6"
  const titleClass = compact ? "text-lg" : "text-xl"

  return (
    <div className={containerClass}>
      {error && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-[--color-neon-pink]">Error: {error}</p>
        </div>
      )}

      <div className="panel">
        {showTitle && (
          <h2 className={`font-display ${titleClass} mb-3 text-[--color-neon-violet]`}>
            New Headache
          </h2>
        )}
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
              style={{ 
                ['--percent' as any]: `${(newHeadache.severity / 10) * 100}%`, 
                ['--sev-color' as any]: getSeverityColor(newHeadache.severity) 
              }}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-[--color-subtle]">Aura</span>
            <button
              type="button"
              className={`inline-flex items-center justify-center w-28 rounded-full px-3 py-1.5 border transition-colors ${
                newHeadache.aura === 1 
                  ? 'border-[var(--color-neon-lime)] bg-[var(--color-neon-lime)] text-[#0b0b12]' 
                  : 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white'
              }`}
              onClick={() => setNewHeadache({ ...newHeadache, aura: newHeadache.aura === 1 ? 0 : 1 })}
              aria-pressed={newHeadache.aura === 1}
              aria-label="Toggle aura"
            >
              <span className="text-xs font-semibold tracking-wide">
                {newHeadache.aura === 1 ? 'YES' : 'NO'}
              </span>
            </button>
          </div>
          <div className="sm:col-span-3">
            <button type='submit' className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>

      {!compact && (
        <div className="panel">
          <h2 className={`font-display ${titleClass} mb-3 text-[--color-neon-violet]`}>
            New Event
          </h2>
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
      )}
    </div>
  )
}
