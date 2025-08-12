import { useState } from 'react'
import { useMutations } from '../hooks/useMutations'
import { useNotifications } from '../hooks/useNotifications'
import TypeaheadInput from './TypeaheadInput'

interface EventEntryFormProps {
  onSuccess?: () => void
  showTitle?: boolean
  compact?: boolean
}

export default function EventEntryForm({ 
  onSuccess, 
  showTitle = true, 
  compact = false 
}: EventEntryFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ event_type: '', value: '' })
  const [typeaheadReload, setTypeaheadReload] = useState(0)
  const { addEvent } = useMutations()
  const { success, error: showError } = useNotifications()

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
      setNewEvent({ event_type: '', value: '' })
      setTypeaheadReload(r => r + 1)
      onSuccess?.()
    } catch (e: unknown) {
      const errorMsg = (e instanceof Error ? e.message : String(e)) || 'Failed to create event'
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
            New Event
          </h2>
        )}
        <form onSubmit={onCreateEvent} className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[--color-subtle]">Type</span>
            <TypeaheadInput
              value={newEvent.event_type}
              onChange={(v) => setNewEvent({ ...newEvent, event_type: v })}
              reloadSignal={typeaheadReload}
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
          <div className="sm:col-span-2">
            <button type='submit' className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
