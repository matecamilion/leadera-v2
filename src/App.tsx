import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Spinner } from './components/Spinner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { esPaginaFueraDeRango } from './lib/mensajesDeError'

// Una página por chunk: el bundle inicial baja a lo que hace falta para
// resolver la sesión y pintar el shell. El resto llega al navegar.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const MiDia = lazy(() => import('./pages/MiDia'))
const ContactadosHoy = lazy(() => import('./pages/ContactadosHoy'))
const Leads = lazy(() => import('./pages/Leads'))
const NuevoLead = lazy(() => import('./pages/NuevoLead'))
const DetalleLead = lazy(() => import('./pages/DetalleLead'))
const Propiedades = lazy(() => import('./pages/Propiedades'))
const NuevaPropiedad = lazy(() => import('./pages/NuevaPropiedad'))
const DetallePropiedad = lazy(() => import('./pages/DetallePropiedad'))
const Operaciones = lazy(() => import('./pages/Operaciones'))
const KanbanOperaciones = lazy(() => import('./pages/KanbanOperaciones'))
const Equipo = lazy(() => import('./pages/Equipo'))
const Tareas = lazy(() => import('./pages/Tareas'))
const NuevaOperacion = lazy(() => import('./pages/NuevaOperacion'))
const DetalleOperacion = lazy(() => import('./pages/DetalleOperacion'))
const Estadisticas = lazy(() => import('./pages/Estadisticas'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Suscripcion = lazy(() => import('./pages/Suscripcion'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Datos de CRM: no hace falta refetchear en cada foco de ventana.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      // Un reintento, salvo para el `?page=` fuera de rango: ese error es
      // determinístico —la base va a contestar el mismo 416— y reintentarlo
      // sólo estira el skeleton mientras el usuario espera una salida que ya
      // podríamos estar mostrando. `count < 1` es la misma cuenta que hacía
      // `retry: 1`, así que el resto de los errores reintenta igual que antes.
      retry: (count, error) => !esPaginaFueraDeRango(error) && count < 1,
    },
  },
})

/** La raíz manda a la app o al login según haya sesión. */
function Inicio() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner fullscreen />
  return <Navigate to={user ? '/mi-dia' : '/login'} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        // Opt-in temprano al comportamiento de v7: silencia los warnings de consola
        // y reduce la superficie de cambio si migramos a React Router 7.
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>
          {/* Boundary externo: cubre las pantallas públicas y la primera carga,
              donde todavía no hay shell que preservar. Las rutas de adentro del
              AppLayout tienen su propio boundary alrededor del <Outlet />, para
              que el sidebar no parpadee al navegar entre secciones. */}
          <Suspense fallback={<Spinner fullscreen />}>
            <Routes>
              {/* Públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protegidas: sesión + shell con sidebar */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/mi-dia" element={<MiDia />} />
                <Route path="/mi-dia/contactados" element={<ContactadosHoy />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/leads/nuevo" element={<NuevoLead />} />
                <Route path="/leads/:id" element={<DetalleLead />} />
                <Route path="/propiedades" element={<Propiedades />} />
                <Route path="/propiedades/nueva" element={<NuevaPropiedad />} />
                <Route path="/propiedades/:id" element={<DetallePropiedad />} />
                <Route path="/operaciones" element={<Operaciones />} />
                <Route path="/operaciones/tablero" element={<KanbanOperaciones />} />
                <Route path="/operaciones/nueva" element={<NuevaOperacion />} />
                <Route path="/operaciones/:id" element={<DetalleOperacion />} />
                <Route path="/estadisticas" element={<Estadisticas />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/equipo" element={<Equipo />} />
                <Route path="/tareas" element={<Tareas />} />
                <Route path="/suscripcion" element={<Suscripcion />} />
              </Route>

              {/* /dashboard era el nombre de "Mi día" hasta esta versión: se deja
                  el redirect para no romper links guardados ni el historial. */}
              <Route path="/dashboard" element={<Navigate to="/mi-dia" replace />} />

              <Route path="/" element={<Inicio />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
