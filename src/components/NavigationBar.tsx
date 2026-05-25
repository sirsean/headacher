import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import IdentityBadges from './IdentityBadges'
import AuthButtons from './AuthButtons'
import { useAuth } from '../hooks/useAuth'

type NavItem = { to: string; label: string }

const BASE_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/entry', label: 'Entry' },
  { to: '/history', label: 'History' },
]

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M6.4 4.9 4.9 6.4 10.6 12l-5.7 5.6 1.5 1.5L12 13.5l5.6 5.6 1.5-1.5-5.6-5.6 5.6-5.7-1.5-1.5L12 10.6 6.4 4.9z" />
    </svg>
  )
}

function NavigationBar() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems: NavItem[] = isAuthenticated
    ? [...BASE_NAV, { to: '/settings', label: 'Settings' }]
    : BASE_NAV

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const baseClasses = 'btn-ghost px-3 py-2 rounded-md transition-colors'
  const activeClasses = 'text-[--color-neon-cyan] underline underline-offset-4'
  const inactiveClasses = 'text-[--color-foreground-muted] hover:text-[--color-foreground]'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [baseClasses, isActive ? activeClasses : inactiveClasses].join(' ')

  return (
    <nav className="w-full border-b border-[--color-border] mb-4">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <NavLink to="/" className="hover:opacity-80 transition-opacity p-0 m-0 shrink-0">
            <img src="/android-chrome-512x512.png" alt="Headacher" className="h-12 w-12 p-0 m-0" />
          </NavLink>

          <div className="hidden sm:flex items-center gap-4">
            <div className="flex gap-4">
              {navItems.map(({ to, label }) => (
                <NavLink key={to} to={to} className={linkClass}>
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <IdentityBadges />
              <AuthButtons />
            </div>
          </div>

          <div className="flex sm:hidden items-center gap-2 min-w-0">
            <IdentityBadges />
            <AuthButtons />
            <button
              type="button"
              className={`${baseClasses} p-2 shrink-0`}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-nav-menu"
            className="sm:hidden mt-3 pt-3 border-t border-[--color-border] flex flex-col gap-1"
          >
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

export default NavigationBar
