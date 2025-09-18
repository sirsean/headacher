import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { Identity } from '../types'

function formatAddress(addr: string) {
  if (!addr?.startsWith('0x') || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function GoogleIcon() {
  // Simple Google "G" styled icon (monochrome for simplicity)
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
      <path fill="#1a73e8" d="M21.35 11.1H12v2.9h5.3c-.23 1.3-1.6 3.8-5.3 3.8-3.19 0-5.8-2.63-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.05.77 3.75 1.44l2.56-2.47C16.71 3.1 14.57 2 12 2 6.98 2 2.9 6.03 2.9 11s4.08 9 9.1 9c5.25 0 8.7-3.69 8.7-8.9 0-.6-.06-1.02-.15-1.99Z"/>
    </svg>
  )
}

function EthIcon() {
  // Minimal Ethereum diamond icon
  return (
    <svg viewBox="0 0 256 417" width="12" height="12" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M127.9 0l-1.7 6.2v276.4l1.7 1.7 127.9-75.6L127.9 0z"/>
      <path fill="currentColor" d="M127.9 0L0 208.7l127.9 75.6V0z"/>
      <path fill="currentColor" d="M127.9 305.5l-1 1.2v108.1l1 2.9 128-180.3-128 68.1z"/>
      <path fill="currentColor" d="M127.9 417.7V305.5L0 235.3l127.9 182.4z"/>
    </svg>
  )
}

export default function IdentityBadges() {
  const { isAuthenticated, identities, refreshIdentities } = useAuth()

  useEffect(() => {
    if (isAuthenticated && identities == null) {
      refreshIdentities().catch(() => {/* noop */})
    }
  }, [isAuthenticated, identities, refreshIdentities])

  if (!isAuthenticated) return null

  // Skeleton badges to avoid layout shifts during initial fetch
  if (identities == null) {
    return (
      <div className="flex flex-col items-end gap-1 sm:gap-1">
        <span className="h-5 sm:h-6 w-24 sm:w-28 rounded-full border border-[--color-border] bg-[--color-surface] animate-pulse"/>
        <span className="h-5 sm:h-6 w-20 sm:w-24 rounded-full border border-[--color-border] bg-[--color-surface] animate-pulse"/>
      </div>
    )
  }

  if (identities.length === 0) return null

  return (
    <div className="flex flex-col items-end gap-1 sm:gap-1 text-[10px] sm:text-xs">
      {identities.map((i: Identity, idx: number) => (
        <span
          key={`${i.provider}-${i.identifier}-${idx}`}
          className={[
            'px-2 py-1 rounded-full border inline-flex items-center gap-1',
            i.provider === 'GOOGLE'
              ? 'bg-white/80 border-[#1a73e8] text-[#1a73e8]'
              : 'bg-[--color-surface] border-[--color-border] text-[--color-foreground]'
          ].join(' ')}
          title={i.provider === 'GOOGLE' ? (i.email || i.identifier) : i.identifier}
        >
          <span className="inline-flex items-center justify-center h-3 w-3 sm:h-3.5 sm:w-3.5">
            {i.provider === 'GOOGLE' ? <GoogleIcon /> : <EthIcon />}
          </span>
          <span className="max-w-[92px] sm:max-w-[140px] truncate">
            {i.provider === 'GOOGLE' ? (i.email || i.identifier) : formatAddress(i.identifier)}
          </span>
        </span>
      ))}
    </div>
  )
}