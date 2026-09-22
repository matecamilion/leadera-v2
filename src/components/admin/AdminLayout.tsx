import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Marca } from '../Marca'
import { Spinner } from '../Spinner'

/**
 * Shell del panel interno. Separado a propósito de AppLayout: sin el sidebar
 * de Leads / Propiedades / Operaciones y con una barra de otro color, para que
 * no se confunda con una inmobiliaria más. Esto es LeadEra mirándose a sí
 * misma, no el CRM de un cliente.
 */
export function AdminLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-dvh bg-background">
      <header
        className="sticky z-10 border-b border-ink-2 bg-ink text-white"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Marca />
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[0.72rem] font-semibold tracking-wide text-white/80 uppercase">
            Administración
          </span>

          <div className="ml-auto flex items-center gap-4 text-[0.82rem]">
            {profile && (
              <span className="hidden text-white/60 sm:inline">
                {profile.nombre} {profile.apellido}
              </span>
            )}
            <Link
              to="/mi-dia"
              className="text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Volver a la app
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
