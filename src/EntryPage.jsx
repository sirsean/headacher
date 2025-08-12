import { useAuth } from './hooks/useAuth'
import HeadacheEntryForm from './components/HeadacheEntryForm'
import EventEntryForm from './components/EventEntryForm'
import WalletButton from './components/WalletButton'

export default function EntryPage() {
  const { address } = useAuth()

  // Show login required state when not authenticated
  if (!address) {
    return (
      <div className="space-y-6">
        <div className="panel text-center">
          <h2 className="font-display text-2xl mb-4 text-[--color-neon-violet]">Authentication Required</h2>
          <div className="space-y-4">
            <p className="text-[--color-subtle] text-lg">
              You need to connect your wallet to track headaches and events.
            </p>
            <p className="text-[--color-subtle]">
              Your data will be securely associated with your wallet address, ensuring privacy and data ownership.
            </p>
            <WalletButton className="mx-auto" />
          </div>
        </div>
        
        <div className="panel">
          <h3 className="font-display text-lg mb-3 text-[--color-attention]">What You Can Track:</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-display text-base mb-2 text-[--color-neon-cyan]">Headache Entries</h4>
              <ul className="space-y-1 text-sm text-[--color-subtle]">
                <li>• Severity level (0-10 scale)</li>
                <li>• Presence of aura symptoms</li>
                <li>• Date and time of occurrence</li>
                <li>• Optional notes and details</li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-base mb-2 text-[--color-neon-cyan]">Event Logging</h4>
              <ul className="space-y-1 text-sm text-[--color-subtle]">
                <li>• Potential triggers (food, stress, etc.)</li>
                <li>• Medication taken</li>
                <li>• Sleep patterns</li>
                <li>• Environmental factors</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show authenticated entry forms
  return (
    <div className="space-y-6">
      <HeadacheEntryForm showTitle={true} compact={true} />
      <EventEntryForm showTitle={true} compact={false} />
    </div>
  )
}

