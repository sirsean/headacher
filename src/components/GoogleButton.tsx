import { useAuth } from '../hooks/useAuth'

export default function GoogleButton({ className = '' }: { className?: string }) {
  const { loginWithGoogle, loading } = useAuth()
  return (
    <button
      onClick={() => loginWithGoogle()}
      disabled={loading}
      className={`px-4 py-2 bg-white text-[#1a73e8] border border-[#1a73e8] rounded-md hover:bg-[#e8f0fe] disabled:opacity-50 transition-colors text-sm font-medium ${className}`}
    >
      {loading ? 'Signing in…' : 'Sign in with Google'}
    </button>
  )
}
