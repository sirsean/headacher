import { NavLink } from 'react-router-dom'
import IdentityBadges from './IdentityBadges'
import AuthButtons from './AuthButtons'
import { useAuth } from '../hooks/useAuth'

function NavigationBar() {
  const { isAuthenticated } = useAuth()
  const baseClasses = 'btn-ghost px-3 py-2 rounded-md transition-colors'
  const activeClasses = 'text-[--color-neon-cyan] underline underline-offset-4'
  const inactiveClasses = 'text-[--color-foreground-muted] hover:text-[--color-foreground]'

  return (
    <nav className="w-full border-b border-[--color-border] mb-4">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 flex items-center justify-between">
        <NavLink to="/" className="hover:opacity-80 transition-opacity p-0 m-0">
          <img src="/android-chrome-512x512.png" alt="Headacher" className="h-12 w-12 p-0 m-0" />
        </NavLink>
        <div className="flex items-center gap-4">
          {/* Navigation links - hidden on mobile, shown on sm and up */}
          <div className="hidden sm:flex gap-4">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                [baseClasses, isActive ? activeClasses : inactiveClasses].join(' ')
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/entry"
              className={({ isActive }) =>
                [baseClasses, isActive ? activeClasses : inactiveClasses].join(' ')
              }
            >
              Entry
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                [baseClasses, isActive ? activeClasses : inactiveClasses].join(' ')
              }
            >
              History
            </NavLink>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  ['hidden sm:inline', baseClasses, isActive ? activeClasses : inactiveClasses].join(' ')
                }
              >
                Settings
              </NavLink>
            )}
            <IdentityBadges />
            <AuthButtons />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavigationBar

