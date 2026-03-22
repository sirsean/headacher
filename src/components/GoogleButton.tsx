import { useAuth } from '../hooks/useAuth'

export default function GoogleButton({ className = '' }: { className?: string }) {
  const { loginWithGoogle, loading, authError, clearAuthError } = useAuth()
  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <button
        onClick={() => void loginWithGoogle()}
        disabled={loading}
        className="px-4 py-2 bg-white text-[#1a73e8] border border-[#1a73e8] rounded-md hover:bg-[#e8f0fe] disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {authError ? (
        <p className="text-xs text-red-600" role="alert">
          {authError}{' '}
          <button type="button" className="underline" onClick={clearAuthError}>
            Dismiss
          </button>
        </p>
      ) : null}
    </div>
  )
}
