import { useAuth } from '../context/AuthContext'

interface WalletButtonProps {
  className?: string
}

function WalletButton({ className = '' }: WalletButtonProps) {
  const { connect, disconnect, address, loading } = useAuth()

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (address) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-[--color-foreground-muted] hidden sm:inline">
          {formatAddress(address)}
        </span>
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
