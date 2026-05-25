import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getGoogleHealthAuthorizeUrl, getGoogleHealthStatus } from '../api'

export default function GoogleHealthReauthBanner() {
  const { fetchWithAuth, identities, isAuthenticated } = useAuth()
  const [needsReauth, setNeedsReauth] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasGoogleIdentity = (identities ?? []).some((i) => i.provider === 'GOOGLE')

  useEffect(() => {
    if (!isAuthenticated || !hasGoogleIdentity) {
      setNeedsReauth(false)
      setLastError(null)
      setLoading(false)
      return
    }

    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const s = await getGoogleHealthStatus(fetchWithAuth)
        if (!mounted) return
        setNeedsReauth(s.connected && s.needsReauth)
        setLastError(s.lastError)
      } catch {
        if (mounted) {
          setNeedsReauth(false)
          setLastError(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [isAuthenticated, hasGoogleIdentity, fetchWithAuth])

  const onReauthenticate = async () => {
    setLinking(true)
    setError(null)
    try {
      const { authorizeUrl } = await getGoogleHealthAuthorizeUrl(fetchWithAuth)
      window.location.assign(authorizeUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Google Health re-authentication')
      setLinking(false)
    }
  }

  if (loading || !needsReauth) return null

  return (
    <div
      role="alert"
      className="panel border border-amber-500/60 bg-[color:color-mix(in_oklch,var(--color-attention)_12%,transparent)]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-amber-300">
            Google Health connection expired — HRV sync is paused.
          </p>
          <p className="text-[--color-subtle]">
            Re-authenticate with Google to resume pulling heart rate variability into your charts.
          </p>
          {lastError && (
            <p className="text-amber-400/80 text-xs">Refresh error: {lastError}</p>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <button
          type="button"
          onClick={onReauthenticate}
          disabled={linking}
          className="shrink-0 px-4 py-2 bg-[#7c3aed] text-white rounded-md hover:bg-[#6d28d9] disabled:opacity-50 text-sm font-medium"
        >
          {linking ? 'Redirecting…' : 'Re-authenticate'}
        </button>
      </div>
    </div>
  )
}
