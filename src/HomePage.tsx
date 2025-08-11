import { NavLink } from 'react-router-dom'

export default function HomePage() {
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

      <div className="panel">
        <h3 className="font-display text-lg mb-3 text-[--color-neon-violet]">Get Started</h3>
        <div className="flex gap-3">
          <NavLink 
            to="/entry" 
            className="btn btn-primary"
          >
            Start Tracking
          </NavLink>
          <NavLink 
            to="/history" 
            className="btn-ghost hover:text-[--color-neon-cyan] transition-colors"
          >
            View History
          </NavLink>
        </div>
      </div>
    </div>
  )
}
