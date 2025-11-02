import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutations } from '../hooks/useMutations'
import { useNotifications } from '../hooks/useNotifications'
import TypeaheadInput from './TypeaheadInput'

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
  const [newHeadache, setNewHeadache] = useState({ severity: 5, aura: 0 as 0 | 1 })
  const [newEvent, setNewEvent] = useState({ event_type: '', value: '' })
  const [typeaheadReload, setTypeaheadReload] = useState(0)
  const { addHeadache, addEvent } = useMutations()
  const { success, error: showError } = useNotifications()
  const [isDragging, setIsDragging] = useState(false)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  async function onCreateHeadache(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    try {
      await addHeadache(newHeadache)
      setNewHeadache({ severity: 5, aura: 0 as 0 | 1 })
      success(`Headache recorded (severity: ${newHeadache.severity}${newHeadache.aura ? ', with aura' : ''})`)
      onSuccess?.()
    } catch (e: unknown) {
      const errorMsg = (e instanceof Error ? e.message : String(e)) || 'Failed to create headache'
      setError(errorMsg)
      showError(errorMsg)
    }
  }

  const handleDragStart = useCallback((value: number) => {
    setIsDragging(true)
    setNewHeadache((prev) => ({ ...prev, severity: value }))
  }, [])

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    // Get the position from mouse or touch
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    
    // Find which button we're over
    for (let i = 0; i < buttonRefs.current.length; i++) {
      const button = buttonRefs.current[i]
      if (!button) continue
      
      const rect = button.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        setNewHeadache((prev) => ({ ...prev, severity: i }))
        break
      }
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Setup global mouse/touch listeners for dragging
  useEffect(() => {
    if (isDragging) {
      const onMove = (e: Event) => handleDragMove(e as MouseEvent | TouchEvent)
      const onEnd = () => handleDragEnd()
      
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
      
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

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
            New Headache
          </h2>
        )}
        <form onSubmit={onCreateHeadache} className="flex flex-col gap-3">
          {/* Row 1: LED Score buttons spanning full width */}
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[--color-subtle]">Severity</span>
              <span className="text-sm font-mono">{newHeadache.severity}</span>
            </div>
            <div className="flex gap-1 w-full">
              {Array.from({ length: 11 }, (_, i) => {
                const value = i;
                const color = getSeverityColor(value);
                const isLit = value <= newHeadache.severity;
                const isActive = value === newHeadache.severity;
                
                let className = 'btn-led ';
                if (isActive) {
                  className += 'btn-led-active';
                } else if (isLit) {
                  className += 'btn-led-lit';
                } else {
                  className += 'btn-led-dim';
                }
                
                return (
                  <button
                    key={value}
                    ref={(el) => { buttonRefs.current[value] = el }}
                    type="button"
                    className={className}
                    style={{ ['--sev-color' as string]: color } as React.CSSProperties}
                    onClick={() => setNewHeadache({ ...newHeadache, severity: value })}
                    onMouseDown={() => handleDragStart(value)}
                    onTouchStart={() => handleDragStart(value)}
                    aria-label={`Severity ${value}`}
                    aria-pressed={isActive}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </label>

          {/* Row 2: Aura toggle (left) and Submit button (right) */}
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1 flex-shrink-0">
              <span className="text-sm text-[--color-subtle]">Aura</span>
              <button
                type="button"
                className={`inline-flex items-center justify-center w-20 rounded-full px-3 py-1.5 border transition-colors ${
                  newHeadache.aura === 1 
                    ? 'border-[var(--color-neon-lime)] bg-[var(--color-neon-lime)] text-[#0b0b12]' 
                    : 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white'
                }`}
                onClick={() => setNewHeadache({ ...newHeadache, aura: (newHeadache.aura === 1 ? 0 : 1) as 0 | 1 })}
                aria-pressed={newHeadache.aura === 1}
                aria-label="Toggle aura"
              >
                <span className="text-xs font-semibold tracking-wide">
                  {newHeadache.aura === 1 ? 'YES' : 'NO'}
                </span>
              </button>
            </div>
            
            <button type='submit' className="btn btn-primary flex-1">Create</button>
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
              <TypeaheadInput
                value={newEvent.event_type}
                onChange={(value) => setNewEvent({ ...newEvent, event_type: value })}
                placeholder="Enter event type..."
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
            <div className="sm:col-span-3">
              <button type='submit' className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
