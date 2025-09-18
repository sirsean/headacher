import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import type { Identity } from './types'
import AuthButtons from './components/AuthButtons'

export default function SettingsPage() {
  const { linkWithGoogle, linkWithSiwe, isAuthenticated, identities: cachedIdentities, refreshIdentities } = useAuth()
  const [identities, setIdentities] = useState<Identity[]>(cachedIdentities ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<'google' | 'siwe' | null>(null)

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
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load identities')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (isAuthenticated) load()
    return () => { mounted = false }
  }, [isAuthenticated, refreshIdentities, cachedIdentities])

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

  const onLinkGoogle = async () => {
    setLinking('google')
    setError(null)
    try {
      await linkWithGoogle()
      await refreshIdentities()
      setIdentities((cachedIdentities ?? []) as Identity[])
    } catch (e: any) {
      setError(e?.message || 'Failed to link Google')
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
    } catch (e: any) {
      setError(e?.message || 'Failed to link wallet')
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
