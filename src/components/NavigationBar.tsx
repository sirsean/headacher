import { NavLink } from 'react-router-dom'

function NavigationBar() {
  const baseClasses = 'btn-ghost px-3 py-2 rounded-md transition-colors'
  const activeClasses = 'text-[--color-neon-cyan] underline underline-offset-4'
  const inactiveClasses = 'text-[--color-foreground-muted] hover:text-[--color-foreground]'

  return (
    <nav className="w-full border-b border-[--color-border] mb-4">
      <div className="mx-auto max-w-3xl p-4 flex items-center justify-between">
        <NavLink to="/" className="text-xl font-display text-[--color-neon-cyan] hover:opacity-80 transition-opacity" style={{textShadow: '0 0 10px var(--color-neon-cyan)'}}>
          <h1>Headacher</h1>
        </NavLink>
        <div className="flex gap-4">
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
      </div>
    </nav>
  )
}

export default NavigationBar

