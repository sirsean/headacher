import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import DashboardChart from './components/DashboardChart'
import HeadacheEntryForm from './components/HeadacheEntryForm'
import type { DashboardData } from './api'

export default function HomePage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const handleEntrySuccess = () => {
    // Trigger a refresh of the dashboard data when a new entry is created
    // The chart component will handle the refresh automatically
  }

  return (
    <div className="space-y-6">
      <div className="panel">
        <h2 className="font-display text-2xl mb-4 text-[--color-neon-violet]">Welcome to Headacher</h2>
        <div className="space-y-4 text-[--color-ink]">
          <p className="text-lg leading-relaxed">
            Headacher is a personal headache tracking application designed to help you monitor and understand your headache patterns over time.
          </p>
          
          <div className="space-y-3">
            <h3 className="font-display text-lg text-[--color-attention]">What You Can Do:</h3>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-[--color-neon-lime] mt-1">•</span>
                <span><strong className="text-[--color-neon-cyan]">Track Headaches:</strong> Record headache severity (0-10 scale) and whether you experienced an aura</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[--color-neon-lime] mt-1">•</span>
                <span><strong className="text-[--color-neon-cyan]">Log Events:</strong> Note potential triggers, medications, or other relevant events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[--color-neon-lime] mt-1">•</span>
                <span><strong className="text-[--color-neon-cyan]">Review History:</strong> View your complete headache and event timeline to identify patterns</span>
              </li>
            </ul>
          </div>

          <div className="bg-[color:color-mix(in_oklch,var(--color-neon-violet)_10%,transparent)] rounded-lg p-4 border border-[color:color-mix(in_oklch,var(--color-neon-violet)_25%,transparent)]">
            <p className="text-sm text-[--color-subtle] italic">
              💡 <strong>Tip:</strong> Consistent tracking can help you and your healthcare provider identify triggers, evaluate treatment effectiveness, and make informed decisions about your headache management.
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Chart */}
      <DashboardChart 
        days={7}
        height={280}
        compact={true}
        showTitle={true}
        showControls={false}
        onDataChange={setDashboardData}
      />

      {/* Quick Entry Form */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display text-lg mb-3 text-[--color-neon-violet]">Quick Entry</h3>
          <HeadacheEntryForm 
            compact={true}
            showTitle={false}
            onSuccess={handleEntrySuccess}
          />
        </div>
        
        <div className="panel">
          <h3 className="font-display text-lg mb-3 text-[--color-attention]">Quick Stats</h3>
          {dashboardData ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Total Headaches:</span>
                <span>{dashboardData.headaches.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Total Events:</span>
                <span>{dashboardData.events.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Avg Severity:</span>
                <span>
                  {dashboardData.headaches.length > 0
                    ? Math.round((dashboardData.headaches.reduce((sum, h) => sum + h.severity, 0) / dashboardData.headaches.length) * 10) / 10
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Headaches/Day:</span>
                <span>
                  {dashboardData.days_requested > 0
                    ? Math.round((dashboardData.headaches.length / dashboardData.days_requested) * 100) / 100
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[--color-subtle]">Aura Frequency:</span>
                <span>
                  {dashboardData.headaches.length > 0
                    ? `${Math.round((dashboardData.headaches.filter(h => h.aura === 1).length / dashboardData.headaches.length) * 100)}%`
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[--color-subtle] text-sm">Loading stats...</p>
          )}

          <div className="mt-4 pt-4 border-t border-[--color-neon-violet]">
            <h4 className="font-display text-sm mb-2 text-[--color-attention]">Actions</h4>
            <div className="flex gap-2 flex-wrap">
              <NavLink 
                to="/entry" 
                className="btn-ghost text-xs hover:text-[--color-neon-cyan] transition-colors"
              >
                Full Entry
              </NavLink>
              <NavLink 
                to="/dashboard" 
                className="btn-ghost text-xs hover:text-[--color-neon-cyan] transition-colors"
              >
                Full Dashboard
              </NavLink>
              <NavLink 
                to="/history" 
                className="btn-ghost text-xs hover:text-[--color-neon-cyan] transition-colors"
              >
                View History
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
