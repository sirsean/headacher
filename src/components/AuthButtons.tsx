import { useAuth } from '../hooks/useAuth'

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill="#1a73e8" d="M21.35 11.1H12v2.9h5.3c-.23 1.3-1.6 3.8-5.3 3.8-3.19 0-5.8-2.63-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.05.77 3.75 1.44l2.56-2.47C16.71 3.1 14.57 2 12 2 6.98 2 2.9 6.03 2.9 11s4.08 9 9.1 9c5.25 0 8.7-3.69 8.7-8.9 0-.6-.06-1.02-.15-1.99Z"/>
    </svg>
  )
}

function EthIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 256 417" width={size} height={size} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M127.9 0l-1.7 6.2v276.4l1.7 1.7 127.9-75.6L127.9 0z"/>
      <path fill="currentColor" d="M127.9 0L0 208.7l127.9 75.6V0z"/>
      <path fill="currentColor" d="M127.9 305.5l-1 1.2v108.1l1 2.9 128-180.3-128 68.1z"/>
      <path fill="currentColor" d="M127.9 417.7V305.5L0 235.3l127.9 182.4z"/>
    </svg>
  )
}

interface Props {
  className?: string
  size?: 'sm' | 'md'
}

export default function AuthButtons({ className = '', size = 'sm' }: Props) {
  const { isAuthenticated, loading, connect, loginWithGoogle, disconnect } = useAuth()

  const btnBase = 'inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
  const iconSize = size === 'sm' ? 16 : 18
  const spacing = size === 'sm' ? 'gap-2' : 'gap-3'
  const container = `flex ${spacing} items-center ${className}`
  const pill = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'

  if (isAuthenticated) {
    return (
      <div className={container}>
        <button
          onClick={() => disconnect()}
          disabled={loading}
          className={`${btnBase} ${pill} bg-red-600 text-white hover:bg-red-700 disabled:opacity-50`}
          title="Log out"
          aria-label="Log out"
        >
          {/* Simple power icon */}
          <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} aria-hidden>
            <path fill="currentColor" d="M13 3h-2v10h2V3zm-1 18c-4.41 0-8-3.59-8-8 0-3.73 2.55-6.86 6-7.75v2.09A6.003 6.003 0 0 0 6 13c0 3.31 2.69 6 6 6s6-2.69 6-6c0-2.77-1.89-5.1-4.47-5.79V5.25C18.53 6.14 21 9.27 21 13c0 4.41-3.59 8-8 8z"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className={container}>
      <button
        onClick={() => connect()}
        disabled={loading}
        className={`${btnBase} ${pill} bg-[--color-ink] text-white hover:bg-[color:color-mix(in_oklch,var(--color-ink)_85%,white)] disabled:opacity-50`}
        title="Sign in with Ethereum"
        aria-label="Sign in with Ethereum"
      >
        <EthIcon size={iconSize} />
      </button>
      <button
        onClick={() => loginWithGoogle()}
        disabled={loading}
        className={`${btnBase} ${pill} bg-white text-[#1a73e8] border border-[#1a73e8] hover:bg-[#e8f0fe] disabled:opacity-50`}
        title="Sign in with Google"
        aria-label="Sign in with Google"
      >
        <GoogleIcon size={iconSize} />
      </button>
    </div>
  )
}