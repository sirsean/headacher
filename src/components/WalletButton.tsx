import { useAuth } from '../hooks/useAuth'

interface WalletButtonProps {
  className?: string
}

function WalletButton({ className = '' }: WalletButtonProps) {
  const { connect, disconnect, isAuthenticated, loading } = useAuth()

  if (isAuthenticated) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => disconnect()}
          disabled={loading}
          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect()}
      disabled={loading}
      className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium ${className}`}
    >
      {loading ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}

export default WalletButton
