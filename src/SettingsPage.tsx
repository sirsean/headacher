import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import type { Identity } from './types'
import AuthButtons from './components/AuthButtons'
import { getGoogleHealthAuthorizeUrl, getGoogleHealthStatus } from './api'

export default function SettingsPage() {
  const { linkWithGoogle, linkWithSiwe, isAuthenticated, identities: cachedIdentities, refreshIdentities, fetchWithAuth } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [identities, setIdentities] = useState<Identity[]>(cachedIdentities ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<'google' | 'siwe' | null>(null)
  const [ghStatus, setGhStatus] = useState<{ connected: boolean; lastSyncAt: string | null; lastError: string | null } | null>(null)
  const [ghLoading, setGhLoading] = useState(false)
  const [ghLinking, setGhLinking] = useState(false)
  const [ghBanner, setGhBanner] = useState<string | null>(null)

  // Hooks must be called unconditionally. Only perform work inside the effect based on auth.
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        if (!cachedIdentities) {
          await refreshIdentities()
        }
        if (mounted) setIdentities((cachedIdentities ?? []) as Identity[])
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load identities')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (isAuthenticated) load()
    return () => { mounted = false }
  }, [isAuthenticated, refreshIdentities, cachedIdentities])

  const hasGoogleIdentity = identities.some((i) => i.provider === 'GOOGLE')

  useEffect(() => {
    const g = searchParams.get('google_health')
    if (!g) return
    if (g === 'connected') {
      setGhBanner('Google Health connected. HRV will sync on the hourly schedule (and was queued in the background).')
    } else if (g === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown'
      const detail = searchParams.get('detail')
      const hint =
        reason === 'token_exchange_failed' && detail === 'redirect_uri_mismatch'
          ? ' Add this exact redirect URI in the Health GCP OAuth client: https://headacher.sirsean.me/api/integrations/google-health/callback'
          : reason === 'token_exchange_failed' && detail === 'invalid_client'
            ? ' Check GOOGLE_OAUTH_CLIENT_SECRET on the production Worker matches the client ID in wrangler.toml.'
            : ''
      setGhBanner(
        `Google Health connection failed (${reason}${detail ? `: ${detail}` : ''}).${hint} Try again or check server OAuth configuration.`,
      )
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!isAuthenticated || loading || !hasGoogleIdentity) {
      setGhStatus(null)
      return
    }
    let mounted = true
    const loadGh = async () => {
      setGhLoading(true)
      try {
        const s = await getGoogleHealthStatus(fetchWithAuth)
        if (mounted) setGhStatus(s)
      } catch {
        if (mounted) setGhStatus(null)
      } finally {
        if (mounted) setGhLoading(false)
      }
    }
    void loadGh()
    return () => { mounted = false }
  }, [isAuthenticated, loading, hasGoogleIdentity, fetchWithAuth])

  if (!isAuthenticated) {
    return (
      <div className="panel space-y-4">
        <h2 className="font-display text-2xl text-[--color-neon-violet]">Settings</h2>
        <p className="text-[--color-subtle]">You need to be authenticated to manage your identities.</p>
        <div className="pt-1">
          <div className="flex justify-start"><AuthButtons size="md" /></div>
        </div>
      </div>
    )
  }

  const hasGoogle = identities.some(i => i.provider === 'GOOGLE')
  const hasSiwe = identities.some(i => i.provider === 'SIWE')

  const onConnectGoogleHealth = async () => {
    setGhLinking(true)
    setError(null)
    try {
      const { authorizeUrl } = await getGoogleHealthAuthorizeUrl(fetchWithAuth)
      window.location.assign(authorizeUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Google Health connection')
      setGhLinking(false)
    }
  }

  const onLinkGoogle = async () => {
    setLinking('google')
    setError(null)
    try {
      await linkWithGoogle()
      await refreshIdentities()
      setIdentities((cachedIdentities ?? []) as Identity[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link Google')
    } finally {
      setLinking(null)
    }
  }

  const onLinkSiwe = async () => {
    setLinking('siwe')
    setError(null)
    try {
      await linkWithSiwe()
      await refreshIdentities()
      setIdentities((cachedIdentities ?? []) as Identity[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link wallet')
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="panel space-y-4">
      <h2 className="font-display text-2xl text-[--color-neon-violet]">Settings</h2>

      {loading ? (
        <p className="text-[--color-subtle] text-sm">Loading…</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : (
        <div className="space-y-4">
          {ghBanner && (
            <p className="text-sm text-[--color-neon-cyan] border border-[--color-neon-violet] rounded-md px-3 py-2">
              {ghBanner}
            </p>
          )}
          <div>
            <h3 className="font-display text-lg mb-2">Linked identities</h3>
            <ul className="space-y-2">
              {identities.length === 0 && (
                <li className="text-[--color-subtle] text-sm">No identities linked yet.</li>
              )}
              {identities.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between border border-[--color-border] rounded-md px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium mr-2">{i.provider === 'SIWE' ? 'Ethereum (SIWE)' : 'Google'}</span>
                    {i.provider === 'GOOGLE' ? (
                      <span className="text-[--color-subtle]">{i.email ?? i.identifier}</span>
                    ) : (
                      <span className="text-[--color-subtle]">{i.identifier}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[--color-border] pt-4">
            <h3 className="font-display text-lg mb-2">Google Health (daily HRV)</h3>
            {!hasGoogle ? (
              <p className="text-[--color-subtle] text-sm">
                Link a Google account above first. Google Health data is tied to the same Google account as your Firebase sign-in.
              </p>
            ) : ghLoading ? (
              <p className="text-[--color-subtle] text-sm">Checking Google Health connection…</p>
            ) : ghStatus?.connected ? (
              <div className="text-sm space-y-1">
                <p className="text-[--color-neon-lime]">Connected to Google Health.</p>
                {ghStatus.lastSyncAt && (
                  <p className="text-[--color-subtle]">Last sync: {new Date(ghStatus.lastSyncAt).toLocaleString()}</p>
                )}
                {ghStatus.lastError && (
                  <p className="text-amber-400 text-xs">Last error: {ghStatus.lastError}</p>
                )}
                <button
                  type="button"
                  onClick={onConnectGoogleHealth}
                  disabled={ghLinking}
                  className="mt-2 px-3 py-2 bg-[#7c3aed] text-white rounded-md hover:bg-[#6d28d9] disabled:opacity-50 text-sm"
                >
                  {ghLinking ? 'Redirecting…' : 'Reconnect Google Health'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[--color-subtle] text-sm">
                  Connect to pull daily HRV from Google Health into your dashboard charts. You will be asked to grant read access to health metrics; refresh tokens stay on the server.
                </p>
                <button
                  type="button"
                  onClick={onConnectGoogleHealth}
                  disabled={ghLinking}
                  className="px-3 py-2 bg-[#7c3aed] text-white rounded-md hover:bg-[#6d28d9] disabled:opacity-50 text-sm"
                >
                  {ghLinking ? 'Redirecting…' : 'Connect Google Health'}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[--color-border] pt-4">
            <h3 className="font-display text-lg mb-2">Link another identity</h3>
            <div className="flex flex-wrap gap-2">
              {!hasGoogle && (
                <button onClick={onLinkGoogle} disabled={linking === 'google'} className="px-3 py-2 bg-white text-[#1a73e8] border border-[#1a73e8] rounded-md hover:bg-[#e8f0fe] disabled:opacity-50 text-sm">
                  {linking === 'google' ? 'Linking…' : 'Link Google account'}
                </button>
              )}
              {!hasSiwe && (
                <button onClick={onLinkSiwe} disabled={linking === 'siwe'} className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {linking === 'siwe' ? 'Linking…' : 'Link Ethereum wallet'}
                </button>
              )}
            </div>
            <p className="text-[--color-subtle] text-xs mt-2">You can’t unlink identities. Each identity may only belong to a single account.</p>
          </div>
        </div>
      )}
    </div>
  )
}
