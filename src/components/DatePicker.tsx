import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

export default function DatePicker({ value, onChange, placeholder = "Select date...", className = "" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayValue, setDisplayValue] = useState('')
  const [viewDate, setViewDate] = useState(() => {
    // Initialize view date to selected date or current date
    if (value) {
      const selected = new Date(value + 'T12:00:00')
      return new Date(selected.getFullYear(), selected.getMonth(), 1)
    }
    return new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // Format display value from YYYY-MM-DD to more readable format
  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value + 'T12:00:00') // Add time to avoid timezone issues
        setDisplayValue(date.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }))
        // Update view date to show the month of the selected date
        setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
      } catch {
        setDisplayValue(value)
      }
    } else {
      setDisplayValue('')
    }
  }, [value])

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Generate calendar grid
  const generateCalendar = () => {
    const today = new Date()
    const displayYear = viewDate.getFullYear()
    const displayMonth = viewDate.getMonth()

    const firstDay = new Date(displayYear, displayMonth, 1)
    const startCalendar = new Date(firstDay)
    startCalendar.setDate(startCalendar.getDate() - firstDay.getDay())

    const days = []
    const currentDate = new Date(startCalendar)
    
    // Generate 6 weeks of calendar
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const isCurrentMonth = currentDate.getMonth() === displayMonth
        const isToday = dateStr === today.toISOString().split('T')[0]
        const isSelected = dateStr === value
        
        days.push({
          date: new Date(currentDate),
          dateStr,
          isCurrentMonth,
          isToday,
          isSelected,
          display: currentDate.getDate()
        })
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    return {
      days,
      monthYear: `${new Date(displayYear, displayMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      displayYear,
      displayMonth
    }
  }

  const handleDateSelect = (dateStr: string) => {
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
  }

  const navigateMonth = (delta: number) => {
    setViewDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + delta)
      return newDate
    })
  }

  const { days, monthYear } = generateCalendar()

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-sm bg-transparent border border-[--color-neon-violet] rounded-md focus:outline-none focus:ring-2 focus:ring-[--color-neon-violet] focus:border-transparent text-left flex items-center justify-between hover:border-[--color-neon-cyan] transition-colors"
      >
        <span className={displayValue ? 'text-[--color-ink]' : 'text-[--color-subtle]'}>
          {displayValue || placeholder}
        </span>
        <span className="text-[--color-subtle] ml-2">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Calendar Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-[--color-bg] border border-[--color-neon-violet] rounded-lg shadow-xl z-50 p-4 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth(-1)}
                className="text-sm text-[--color-subtle] hover:text-[--color-neon-cyan] transition-colors p-1"
                title="Previous month"
              >
                ‹
              </button>
              <h3 className="font-display text-sm text-[--color-neon-cyan] font-semibold min-w-[140px] text-center">
                {monthYear}
              </h3>
              <button
                onClick={() => navigateMonth(1)}
                className="text-sm text-[--color-subtle] hover:text-[--color-neon-cyan] transition-colors p-1"
                title="Next month"
              >
                ›
              </button>
            </div>
            <div className="flex gap-2">
              {value && (
                <button
                  onClick={handleClear}
                  className="text-xs text-[--color-subtle] hover:text-[--color-neon-pink] transition-colors"
                  title="Clear date"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-[--color-subtle] hover:text-[--color-ink] transition-colors"
                title="Close calendar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-xs text-[--color-subtle] text-center py-1 font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <button
                key={index}
                onClick={() => handleDateSelect(day.dateStr)}
                className={`
                  text-xs p-2 rounded transition-all hover:bg-[color:color-mix(in_oklch,var(--color-neon-violet)_15%,transparent)]
                  ${day.isCurrentMonth 
                    ? 'text-[--color-ink]' 
                    : 'text-[--color-subtle] opacity-50'
                  }
                  ${day.isSelected 
                    ? 'bg-[--color-neon-violet] text-[--color-bg] font-semibold' 
                    : ''
                  }
                  ${day.isToday && !day.isSelected
                    ? 'bg-[color:color-mix(in_oklch,var(--color-attention)_20%,transparent)] text-[--color-attention] font-medium'
                    : ''
                  }
                `}
                title={day.date.toLocaleDateString()}
              >
                {day.display}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex justify-center mt-4 gap-3">
            <button
              onClick={() => handleDateSelect(new Date().toISOString().split('T')[0])}
              className="text-xs text-[--color-neon-cyan] hover:text-[--color-attention] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                handleDateSelect(yesterday.toISOString().split('T')[0])
              }}
              className="text-xs text-[--color-neon-cyan] hover:text-[--color-attention] transition-colors"
            >
              Yesterday
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
