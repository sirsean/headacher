import { useState, useEffect } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, ReferenceDot } from 'recharts'
import { getDashboardData, type DashboardData } from '../api'
import { useAuth } from '../context/AuthContext'

// Helper function to get local date string from UTC timestamp
function getLocalDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function to aggregate data by local date
function aggregateDataByLocalDate(headaches: DashboardData['headaches'], events: DashboardData['events'], daysRequested: number) {
  // Group headaches by local date
  const headachesByDate = headaches.reduce((acc, headache) => {
    const localDate = getLocalDateString(headache.timestamp)
    if (!acc[localDate]) acc[localDate] = []
    acc[localDate].push(headache)
    return acc
  }, {} as Record<string, typeof headaches>)

  // Group events by local date
  const eventsByDate = events.reduce((acc, event) => {
    const localDate = getLocalDateString(event.timestamp)
    if (!acc[localDate]) acc[localDate] = []
    acc[localDate].push(event)
    return acc
  }, {} as Record<string, typeof events>)

  // Generate all dates in range using local time
  const result = []
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - daysRequested + 1) // Include today

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = getLocalDateString(d.toISOString())
    const dayHeadaches = headachesByDate[dateStr] || []
    const dayEvents = eventsByDate[dateStr] || []
    
    // Calculate stats for this day
    const severities = dayHeadaches.map(h => h.severity)
    const minSeverity = severities.length > 0 ? Math.min(...severities) : null
    const maxSeverity = severities.length > 0 ? Math.max(...severities) : null
    const avgSeverity = severities.length > 0 ? Math.round((severities.reduce((sum, s) => sum + s, 0) / severities.length) * 10) / 10 : null
    const auraCount = dayHeadaches.filter(h => h.aura === 1).length
    
    result.push({
      date: dateStr,
      displayDate: new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      min_severity: minSeverity,
      max_severity: maxSeverity,
      avg_severity: avgSeverity,
      headache_count: dayHeadaches.length,
      aura_count: auraCount,
      has_aura: auraCount > 0,
      events_count: dayEvents.length,
      events: dayEvents
    })
  }

  return result
}

interface ChartDataPoint {
  date: string
  displayDate: string
  min_severity: number | null
  max_severity: number | null
  avg_severity: number | null
  headache_count: number
  aura_count: number
  has_aura: boolean
  events_count: number
  events: Array<{
    event_type: string
    value: string
    timestamp: string
  }>
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  
  const data = payload[0].payload as ChartDataPoint
  
  return (
    <div className="panel bg-[--color-panel] border border-[--color-neon-violet] p-3 rounded-lg shadow-lg">
      <p className="text-sm font-display text-[--color-neon-cyan] mb-2">{data.displayDate}</p>
      
      {data.headache_count > 0 ? (
        <div className="space-y-1 text-xs">
          <p><span className="text-[--color-subtle]">Count:</span> {data.headache_count} headache{data.headache_count > 1 ? 's' : ''}</p>
          <p><span className="text-[--color-subtle]">Severity:</span> {data.min_severity === data.max_severity ? data.min_severity : `${data.min_severity} - ${data.max_severity}`}</p>
          <p><span className="text-[--color-subtle]">Average:</span> {data.avg_severity}</p>
          {data.has_aura && <p className="text-[--color-alert]">🌟 Aura present</p>}
        </div>
      ) : (
        <p className="text-xs text-[--color-subtle]">No headaches</p>
      )}
      
      {data.events.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[--color-neon-violet]">
          <p className="text-xs text-[--color-attention] mb-1">Events ({data.events.length}):</p>
          {data.events.slice(0, 3).map((event, i) => (
            <p key={i} className="text-xs text-[--color-subtle]">
              • [{event.event_type}] {event.value.length > 20 ? event.value.substring(0, 20) + '...' : event.value}
            </p>
          ))}
          {data.events.length > 3 && (
            <p className="text-xs text-[--color-subtle] italic">...and {data.events.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  )
}

interface DashboardChartProps {
  days?: number
  height?: number
  showControls?: boolean
  showTitle?: boolean
  compact?: boolean
  onDataChange?: (data: DashboardData | null) => void
}

export default function DashboardChart({ 
  days: initialDays = 30,
  height = 320,
  showControls = false,
  showTitle = true,
  compact = false,
  onDataChange
}: DashboardChartProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(initialDays)
  const { fetchWithAuth } = useAuth()

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const dashboardData = await getDashboardData(days, fetchWithAuth)
      setData(dashboardData)
      onDataChange?.(dashboardData)
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard data')
      onDataChange?.(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [days])

  const chartData: ChartDataPoint[] = data ? aggregateDataByLocalDate(data.headaches, data.events, data.days_requested) : []

  if (loading) {
    return (
      <div className="panel text-center py-8">
        <p className="text-[--color-subtle]">Loading dashboard data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <p className="text-[--color-alert]">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-4">
        {showTitle && (
          <h3 className={`font-display ${compact ? 'text-lg' : 'text-xl'} text-[--color-attention]`}>
            {compact ? 'Recent Trends' : 'Headache Severity Trends'}
          </h3>
        )}
        {showControls && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-[--color-subtle]">
              Days:
              <select 
                value={days} 
                onChange={(e) => setDays(Number(e.target.value))}
                className="ml-2 rounded-md border border-[color:color-mix(in_oklch,var(--color-neon-cyan)_22%,transparent)] bg-transparent px-2 py-1 text-[--color-ink]"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
            <button 
              onClick={loadData}
              className="btn-ghost text-sm hover:text-[--color-neon-cyan] transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </div>

      <div className="w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="color-mix(in oklch, var(--color-neon-violet) 20%, transparent)"
            />
            <XAxis 
              dataKey="displayDate" 
              stroke="var(--color-subtle)"
              fontSize={compact ? 10 : 12}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="var(--color-subtle)"
              fontSize={compact ? 10 : 12}
              domain={[0, 10]}
            />
            <Tooltip content={<CustomTooltip />} />
            {!compact && <Legend />}
            
            {/* Severity range bars */}
            <Bar 
              dataKey={(entry: ChartDataPoint) => entry.max_severity ? entry.max_severity - (entry.min_severity || 0) : 0}
              stackId="severity"
              fill="color-mix(in oklch, var(--color-neon-cyan) 30%, transparent)"
              name="Severity Range"
            />
            <Bar 
              dataKey="min_severity"
              stackId="severity"
              fill="var(--color-neon-cyan)"
              name="Min Severity"
            />
            
            {/* Average line */}
            <Line 
              type="monotone" 
              dataKey="avg_severity" 
              stroke="var(--color-attention)" 
              strokeWidth={2}
              dot={{ fill: 'var(--color-attention)', strokeWidth: 2, r: compact ? 2 : 3 }}
              name="Average Severity"
            />
            
            {/* Aura indicators */}
            {chartData.map((entry, index) => 
              entry.has_aura ? (
                <ReferenceDot 
                  key={`aura-${index}`}
                  x={entry.displayDate}
                  y={entry.max_severity || 0}
                  r={compact ? 4 : 6}
                  fill="var(--color-alert)"
                  stroke="var(--color-bg)"
                  strokeWidth={1}
                />
              ) : null
            )}
            
            {/* Event indicators */}
            {chartData.map((entry, index) => 
              entry.events_count > 0 ? (
                <ReferenceDot 
                  key={`events-${index}`}
                  x={entry.displayDate}
                  y={-0.5}
                  r={compact ? 3 : 4}
                  fill="var(--color-neon-lime)"
                  stroke="var(--color-bg)"
                  strokeWidth={1}
                />
              ) : null
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {!compact && (
        <div className="mt-4 text-xs text-[--color-subtle] space-y-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-alert)]"></div>
              <span>Aura present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-neon-lime)]"></div>
              <span>Events recorded</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
