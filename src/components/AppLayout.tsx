import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePendientesConsultas } from '../hooks/useConsultas'
import { useResumenCupo } from '../hooks/useEquipo'
import { useLeadsNuevos } from '../hooks/useLeads'
import { useEstadoSuscripcion } from '../hooks/useSuscripcion'
import { etiquetaRol } from '../lib/api/equipo'
import { DETALLE_PLAN } from '../lib/api/suscripcion'
import { claveDia } from '../lib/calendario'
import { useUiStore } from '../stores/ui'
import { AvisoFlash } from './AvisoFlash'
import { BannerSuscripcion } from './BannerSuscripcion'
import { BotonTema } from './BotonTema'
import { MenuDesplegable, type ItemMenu } from './comunes/MenuDesplegable'
import { Marca } from './Marca'
import { Spinner } from './Spinner'
import { ModalNuevaTarea } from './tareas/ModalNuevaTarea'

type RolAgente = 'DUENO' | 'AGENTE' | 'ASISTENTE'

/** De qué badge sale el número de un ítem, si tiene. */
type Badge = 'consultas' | 'leadsNuevos'

interface ItemNav {
  to: string
  label: string
  icono: React.ReactNode
  /** Roles que ven el link. Sin esto, lo ven todos. */
  roles?: RolAgente[]
  badge?: Badge
}

interface GrupoNav {
  titulo: string
  items: ItemNav[]
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

const NAV: GrupoNav[] = [
  {
    titulo: 'Día a día',
    items: [
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
        to: '/tareas',
        // La ruta sigue siendo /tareas: sólo cambia cómo se llama en el menú, así
        // no se rompen los links guardados ni el historial.
        label: 'Calendario',
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
    ],
  },
  {
    titulo: 'Cartera',
    items: [
      {
        to: '/leads',
        label: 'Leads',
        badge: 'leadsNuevos',
        icono: (
          <svg {...trazo}>
            <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
            <circle cx="9" cy="7" r="3.5" />
            <path d="M18 8h4M20 6v4" />
          </svg>
        ),
      },
      {
        to: '/consultas',
        label: 'Consultas',
        badge: 'consultas',
        icono: (
          <svg {...trazo}>
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
            <path d="M8.5 10.5h7M8.5 13.5h4.5" />
          </svg>
        ),
      },
      {
        to: '/coincidencias',
        label: 'Coincidencias',
        icono: (
          <svg {...trazo}>
            <circle cx="9" cy="12" r="5.5" />
            <circle cx="15" cy="12" r="5.5" />
          </svg>
        ),
      },
    ],
  },
  {
    titulo: 'Negocio',
    items: [
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
    ],
  },
  {
    titulo: 'Equipo y análisis',
    items: [
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
    ],
  },
]

/** "99+" arriba de 99: el badge tiene que entrar en el ítem. */
const textoBadge = (n: number) => (n > 99 ? '99+' : String(n))

/** "MG" de "Mateo García"; la primera letra del mail si no hay nombre. */
function iniciales(nombre: string, apellido: string, respaldo: string): string {
  const letras = `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}`
  return (letras || respaldo.trim()[0] || '?').toUpperCase()
}

export function AppLayout() {
  const { user, profile, signOut } = useAuth()
  const { sidebarAbierto, cerrarSidebar, alternarSidebar } = useUiStore()
  const location = useLocation()
  const [creandoTarea, setCreandoTarea] = useState(false)

  // En mobile el drawer queda abierto al navegar si no lo cerramos a mano.
  useEffect(() => {
    cerrarSidebar()
  }, [location.pathname, cerrarSidebar])

  // Cada pantalla nueva arranca arriba. Sin esto el SPA conserva el scroll de
  // la anterior: entrando a una lista desde el fondo de Mi día, el título
  // quedaba fuera de vista en el teléfono.
  //
  // Solo con el cambio de ruta, no de query string: pasar de pestaña o de
  // página en un listado no debe saltar arriba de todo. Volver atrás tampoco
  // restaura la posición previa: eso pide el ScrollRestoration de un data
  // router, y la app usa BrowserRouter.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const esDueno = profile?.rol === 'DUENO'

  // Lo que pide acción de quien está logueado. Vive acá, y no en las páginas,
  // para que el refresco corra en toda la app.
  const pendientes = usePendientesConsultas().data ?? 0
  const leadsNuevos = useLeadsNuevos().data ?? 0
  const badges: Record<Badge, number> = { consultas: pendientes, leadsNuevos }

  // El nombre de la inmobiliaria sale de la misma lectura que usa el guard de
  // suscripción. Si la RLS no deja leer la fila, viene null y no se muestra.
  const inmobiliaria = useEstadoSuscripcion().data?.nombre ?? null
  const cupo = useResumenCupo(esDueno).data ?? null

  // Mientras el profile carga se muestran sólo los links sin restricción: es
  // preferible que aparezca un link de más tarde y no que parpadee uno de menos.
  const puedeVer = (item: ItemNav) =>
    !item.roles || (profile != null && item.roles.includes(profile.rol))
  const gruposVisibles = NAV.map((g) => ({ ...g, items: g.items.filter(puedeVer) })).filter(
    (g) => g.items.length > 0,
  )

  const nombre = profile ? `${profile.nombre} ${profile.apellido}`.trim() : (user?.email ?? '')
  const rol = profile ? etiquetaRol(profile.rol) : ''

  /** Pie del menú: el dueño ve su plan y su cupo; el resto, su rol. */
  let pie = rol
  if (esDueno && cupo) {
    const plan = cupo.plan ? `Plan ${DETALLE_PLAN[cupo.plan].nombre}` : 'Sin plan'
    const agentes =
      cupo.maxAgentes == null
        ? `${cupo.agentesUsados} ${cupo.agentesUsados === 1 ? 'agente' : 'agentes'}`
        : `${cupo.agentesUsados} de ${cupo.maxAgentes} ${cupo.maxAgentes === 1 ? 'agente' : 'agentes'}`
    pie = `${plan} · ${agentes}`
  }

  const itemsCrear: ItemMenu[] = [
    { label: 'Nuevo lead', to: '/leads/nuevo' },
    { label: 'Nueva propiedad', to: '/propiedades/nueva' },
    { label: 'Nueva operación', to: '/operaciones/nueva' },
    // La tarea es un modal, no una página: se monta acá abajo.
    { label: 'Nueva tarea', onSelect: () => setCreandoTarea(true) },
  ]

  const itemsUsuario: ItemMenu[] = [
    { label: 'Perfil', to: '/perfil' },
    ...(esDueno ? [{ label: 'Suscripción', to: '/suscripcion' }] : []),
    { label: 'Cerrar sesión', onSelect: signOut },
  ]

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
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          sidebarAbierto ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-16 shrink-0 flex-col justify-center border-b border-border px-5">
          <Marca className="text-primary" />
          {inmobiliaria && (
            <span className="mt-0.5 truncate pl-[34px] text-[0.78rem] text-ink-3">
              {inmobiliaria}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Secciones">
          {gruposVisibles.map((grupo) => (
            <div key={grupo.titulo} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-3 text-[0.68rem] font-bold tracking-[0.08em] text-ink-3 uppercase">
                {grupo.titulo}
              </p>
              <ul className="m-0 list-none space-y-0.5 p-0">
                {grupo.items.map((item) => {
                  const n = item.badge ? badges[item.badge] : 0
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          [
                            'flex h-9 items-center gap-3 rounded-lg px-3 text-[0.88rem]',
                            'transition-colors motion-reduce:transition-none',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                            isActive
                              ? 'bg-brand-soft font-semibold text-primary'
                              : 'font-medium text-ink-2 hover:bg-surface-muted hover:text-ink',
                          ].join(' ')
                        }
                      >
                        {item.icono}
                        {item.label}
                        {n > 0 && (
                          <span
                            aria-label={
                              item.badge === 'consultas' ? `${n} pendientes` : `${n} nuevos`
                            }
                            className="ml-auto min-w-[1.4rem] rounded-full bg-primary px-1.5 py-0.5 text-center text-[0.7rem] leading-none font-bold text-primary-contrast tabular-nums"
                          >
                            {textoBadge(n)}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {pie && (
          <p className="m-0 shrink-0 border-t border-border px-5 py-3.5 text-[0.78rem] text-ink-3">
            {pie}
          </p>
        )}
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface px-4 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={alternarSidebar}
            aria-label={
              pendientes > 0 ? `Abrir el menú (${pendientes} consultas pendientes)` : 'Abrir el menú'
            }
            aria-expanded={sidebarAbierto}
            className="relative -ml-1 rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink lg:hidden"
          >
            <svg {...trazo} width={20} height={20}>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            {/* Con el drawer cerrado el badge del item no se ve: el punto avisa. */}
            {pendientes > 0 && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-primary ring-2 ring-surface"
              />
            )}
          </button>

          <MenuDesplegable
            etiqueta="Crear"
            claseBoton="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[0.88rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            boton={
              <>
                <svg {...trazo} width={16} height={16} strokeWidth={2}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Crear
              </>
            }
            items={itemsCrear}
          />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <BotonTema trazo={trazo} />

            <MenuDesplegable
              etiqueta={`Cuenta de ${nombre}`}
              alinear="derecha"
              claseBoton="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 text-left transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              boton={
                <>
                  <span
                    aria-hidden
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[0.78rem] font-bold text-primary"
                  >
                    {iniciales(profile?.nombre ?? '', profile?.apellido ?? '', user?.email ?? '')}
                  </span>
                  <span className="hidden max-w-[11rem] min-w-0 flex-col leading-tight sm:flex">
                    <span className="truncate text-[0.85rem] font-semibold text-ink">{nombre}</span>
                    {rol && <span className="truncate text-[0.75rem] text-ink-3">{rol}</span>}
                  </span>
                  <svg {...trazo} width={14} height={14} className="hidden text-ink-3 sm:block">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </>
              }
              encabezado={
                <>
                  <p className="m-0 truncate text-[0.85rem] font-semibold text-ink">{nombre}</p>
                  {user?.email && (
                    <p className="m-0 truncate text-[0.78rem] text-ink-3">{user.email}</p>
                  )}
                </>
              }
              items={itemsUsuario}
            />
          </div>
        </header>

        {/* Debajo del header y fuera del <main>: se ve en todas las pantallas
            sin que cada página tenga que acordarse de pedirlo. El `key` lo
            remonta al navegar, que es lo que hace reaparecer el aviso después
            de que el dueño lo cierra. */}
        <BannerSuscripcion key={location.pathname} />

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

      {/* "Nueva tarea" desde el menú Crear: el modal es autónomo, arranca en el
          día de hoy. Montado sólo mientras está abierto, para que empiece limpio. */}
      {creandoTarea && (
        <ModalNuevaTarea fechaInicial={claveDia(new Date())} onCerrar={() => setCreandoTarea(false)} />
      )}

      {/* Va acá arriba de todo, fuera del <main>: tiene que poder sobrevivir a
          la navegación que lo disparó. */}
      <AvisoFlash />
    </div>
  )
}
