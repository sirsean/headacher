import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import DashboardChart from './components/DashboardChart'
import AuthButtons from './components/AuthButtons'
import type { DashboardData } from './api'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const { isAuthenticated } = useAuth()

  // Show login required state when not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="panel text-center">
          <h2 className="font-display text-2xl mb-4 text-[--color-neon-violet]">Authentication Required</h2>
          <div className="space-y-4">
            <p className="text-[--color-subtle] text-lg">
              You need to connect your wallet to view your dashboard.
            </p>
            <p className="text-[--color-subtle]">
              Your dashboard displays personalized headache patterns and trends based on your tracked data.
            </p>
            <div className="flex justify-center"><AuthButtons size="md" /></div>
          </div>
        </div>
        
        <div className="panel">
          <h3 className="font-display text-lg mb-3 text-[--color-attention]">What You'll See:</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-display text-base mb-2 text-[--color-neon-cyan]">Visual Charts</h4>
              <ul className="space-y-1 text-sm text-[--color-subtle]">
                <li>• Headache severity over time</li>
                <li>• Frequency patterns and trends</li>
                <li>• Aura occurrence visualization</li>
                <li>• Event correlation timeline</li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-base mb-2 text-[--color-neon-cyan]">Summary Statistics</h4>
              <ul className="space-y-1 text-sm text-[--color-subtle]">
                <li>• Average headache severity</li>
                <li>• Frequency per day/week/month</li>
                <li>• Aura occurrence percentage</li>
                <li>• Recent events and triggers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-[--color-neon-violet]">Dashboard</h2>
      </div>

      {/* Main Chart */}
      <DashboardChart 
        days={30}
        height={400}
        showControls={true}
        showTitle={true}
        compact={false}
        onDataChange={setData}
      />

      {/* Summary Panels */}
      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="panel">
            <h3 className="font-display text-lg mb-3 text-[--color-attention]">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Period:</span>
                <span>{data.start_date} to {data.end_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Total Days:</span>
                <span>{data.days_requested} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Total Headaches:</span>
                <span>{data.headaches.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Avg Severity:</span>
                <span>
                  {data.headaches.length > 0
                    ? Math.round((data.headaches.reduce((sum, h) => sum + h.severity, 0) / data.headaches.length) * 10) / 10
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Aura Frequency:</span>
                <span>
                  {data.headaches.length > 0
                    ? `${Math.round((data.headaches.filter(h => h.aura === 1).length / data.headaches.length) * 100)}%`
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Total Events:</span>
                <span>{data.events.length}</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="font-display text-lg mb-3 text-[--color-attention]">Recent Events</h3>
            <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {data.events
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 15)
                .map((event, i) => (
                  <div key={i} className="flex items-start gap-2 pb-2 border-b border-[color:color-mix(in_oklch,var(--color-neon-violet)_10%,transparent)] last:border-b-0">
                    <span className="text-[--color-neon-lime] text-xs mt-1">•</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[--color-neon-cyan] font-semibold">[{event.event_type}]</span>
                        <span className="text-[--color-subtle] text-xs">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[--color-ink]">{event.value}</p>
                    </div>
                  </div>
                ))}
              {data.events.length === 0 && (
                <p className="text-[--color-subtle] italic">No events recorded</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
