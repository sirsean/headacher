import { useState } from 'react'
import TypeaheadInput from './TypeaheadInput'

export default function TypeaheadExample() {
  const [eventType, setEventType] = useState('')
  const [refreshCounter, setRefreshCounter] = useState(0)

  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1)
  }

  return (
    <div className="panel space-y-4">
      <h2 className="font-display text-xl text-[--color-neon-violet]">
        TypeaheadInput Example
      </h2>
      
      <div className="space-y-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[--color-subtle]">Event Type</span>
          <TypeaheadInput
            value={eventType}
            onChange={setEventType}
            placeholder="Start typing... (e.g. medication, trigger, note)"
            reloadSignal={refreshCounter}
          />
        </label>
        
        <button 
          onClick={handleRefresh}
          className="btn btn-secondary text-sm"
        >
          Refresh Types List (reloadSignal: {refreshCounter})
        </button>
        
        {eventType && (
          <p className="text-sm text-[--color-subtle]">
            Selected: <span className="text-[--color-neon-cyan]">{eventType}</span>
          </p>
        )}
      </div>
    </div>
  )
}
