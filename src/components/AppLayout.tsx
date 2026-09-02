import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUiStore } from '../stores/ui'
import { AvisoFlash } from './AvisoFlash'
import { Marca } from './Marca'
import { Spinner } from './Spinner'

type RolAgente = 'DUENO' | 'AGENTE' | 'ASISTENTE'

interface ItemNav {
  to: string
  label: string
  icono: React.ReactNode
  /** Roles que ven el link. Sin esto, lo ven todos. */
  roles?: RolAgente[]
}

/** Iconos de 18px, trazo 1.5. Deliberadamente esquemáticos: acompañan la etiqueta, no la reemplazan. */
const trazo = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const NAV: ItemNav[] = [
  {
    to: '/mi-dia',
    label: 'Mi día',
    icono: (
      <svg {...trazo}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/leads',
    label: 'Leads',
    icono: (
      <svg {...trazo}>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
        <circle cx="9" cy="7" r="3.5" />
        <path d="M18 8h4M20 6v4" />
      </svg>
    ),
  },
  {
    to: '/propiedades',
    label: 'Propiedades',
    icono: (
      <svg {...trazo}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    ),
  },
  {
    to: '/operaciones',
    label: 'Operaciones',
    icono: (
      <svg {...trazo}>
        <path d="M3 7h13l-3-3M21 17H8l3 3" />
        <path d="M3 7l3 3M21 17l-3-3" />
      </svg>
    ),
  },
  {
    to: '/tareas',
    label: 'Tareas',
    // El dueño entra para su agenda propia: crea tareas autoasignadas, no las
    // reparte. Asignar a otro sigue siendo cosa del agente con su asistente.
    roles: ['DUENO', 'AGENTE', 'ASISTENTE'],
    icono: (
      <svg {...trazo}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/equipo',
    label: 'Equipo',
    // Un asistente no gestiona equipo: no ve el link ni puede entrar por URL.
    roles: ['DUENO', 'AGENTE'],
    icono: (
      <svg {...trazo}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
        <path d="M16 4.5a3 3 0 0 1 0 5.8" />
        <path d="M18.5 14.2A4.5 4.5 0 0 1 21 18.3V20" />
      </svg>
    ),
  },
  {
    to: '/estadisticas',
    label: 'Estadísticas',
    icono: (
      <svg {...trazo}>
        <path d="M3 3v16.5a1.5 1.5 0 0 0 1.5 1.5H21" />
        <path d="M7.5 16.5v-4M12 16.5v-8M16.5 16.5v-6" />
      </svg>
    ),
  },
  {
    to: '/perfil',
    label: 'Perfil',
    icono: (
      <svg {...trazo}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
      </svg>
    ),
  },
]

export function AppLayout() {
  const { user, profile, signOut } = useAuth()
  const { sidebarAbierto, cerrarSidebar, alternarSidebar } = useUiStore()
  const location = useLocation()

  // En mobile el drawer queda abierto al navegar si no lo cerramos a mano.
  useEffect(() => {
    cerrarSidebar()
  }, [location.pathname, cerrarSidebar])

  const nombreVisible = profile?.nombre ?? user?.email ?? ''

  // Mientras el profile carga se muestran sólo los links sin restricción: es
  // preferible que aparezca un link de más tarde y no que parpadee uno de menos.
  const navVisible = NAV.filter(
    (item) => !item.roles || (profile != null && item.roles.includes(profile.rol)),
  )

  return (
    <div className="min-h-dvh bg-background">
      {/* Velo del drawer en mobile */}
      {sidebarAbierto && (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={cerrarSidebar}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          sidebarAbierto ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Marca className="text-sidebar-ink-strong" />
        </div>

        <nav className="flex-1 space-y-0.5 p-3" aria-label="Secciones">
          {navVisible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  'transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ink-strong',
                  isActive
                    ? 'bg-sidebar-active text-sidebar-ink-strong'
                    : 'text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-ink-strong',
                ].join(' ')
              }
            >
              {item.icono}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <p className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-ink">
          LeadEra v2
        </p>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={alternarSidebar}
            aria-label="Abrir el menú"
            aria-expanded={sidebarAbierto}
            className="-ml-1 rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink lg:hidden"
          >
            <svg {...trazo} width={20} height={20}>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <span className="ml-auto truncate text-sm text-ink-muted">
            {nombreVisible}
          </span>

          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink motion-reduce:transition-none"
          >
            Cerrar sesión
          </button>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">
          {/* Las páginas se cargan por chunk (React.lazy en App.tsx). El
              boundary va acá y no más arriba para que, mientras baja el chunk,
              el sidebar y el header queden en su lugar en vez de desmontarse. */}
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner label="Cargando la sección" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Va acá arriba de todo, fuera del <main>: tiene que poder sobrevivir a
          la navegación que lo disparó. */}
      <AvisoFlash />
    </div>
  )
}
