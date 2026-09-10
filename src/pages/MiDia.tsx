import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CardKpi } from '../components/comunes/CardKpi'
import { ActividadReciente } from '../components/dashboard/ActividadReciente'
import { ListaLeads } from '../components/dashboard/ListaLeads'
import { ListaOperacionesEnCurso } from '../components/dashboard/ListaOperacionesEnCurso'
import { ListaPropiedadesRecientes } from '../components/dashboard/ListaPropiedadesRecientes'
import { ResumenTareasHoy } from '../components/dashboard/ResumenTareasHoy'
import { SeccionCoincidencias } from '../components/dashboard/SeccionCoincidencias'
import {
  IconoAlerta,
  IconoCasa,
  IconoCheck,
  IconoPersonaMas,
  IconoReloj,
} from '../components/leads/Iconos'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import { useCoincidenciasDelDia, useLeadsDelDia } from '../hooks/useDashboard'
import { useEventosCalendario } from '../hooks/useTareas'
import { hoyComoClave } from '../lib/calendario'
import { useAuth } from '../contexts/AuthContext'
import { useUiStore } from '../stores/ui'
import type { Lead } from '../lib/api/leads'

export default function MiDia() {
  const { profile } = useAuth()
  const { data, isPending, isError, error } = useLeadsDelDia()
  const coincidencias = useCoincidenciasDelDia()

  // Misma clave que monta `ResumenTareasHoy`, así que no hay request de más:
  // react-query devuelve la entrada que ya está en cache.
  const hoy = hoyComoClave()
  const eventosDeHoy = useEventosCalendario(hoy, hoy)
  // Una visita cancelada esta mañana no es trabajo pendiente; contarla haría
  // que el número de arriba prometa una jornada que no existe.
  const visitasHoy = (eventosDeHoy.data ?? []).filter(
    (e) => e.tipo === 'VISITA' && e.estadoVisita !== 'CANCELADA',
  ).length

  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  // Sobre qué lead se está registrando. Va antes de los returns tempranos de
  // acá abajo: los hooks no pueden quedar detrás de un `if`.
  const [leadARegistrar, setLeadARegistrar] = useState<Lead | null>(null)

  // `!data` además de `isPending`: el hook deriva de otra query y devuelve las
  // banderas sueltas, así que no es la unión discriminada de react-query.
  if (isPending || !data) return <Skeleton />

  if (isError) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar tu jornada.'}
        </p>
      </div>
    )
  }

  const { prioritarios, nuevos, seguimientos } = data

  // Lo que se muestra en el hero es lo que hay para hacer hoy. Se suman los
  // totales reales y no los recortes de 10, si no el número mentiría en cuanto
  // una categoría pasa el límite.
  const totalPendientes = prioritarios.total + nuevos.total + seguimientos.total
  const alDia = totalPendientes === 0

  const listaCoincidencias = coincidencias.data ?? []

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* El título va en texto plano sobre el fondo de la página: la banda con
          gradiente y las cards montadas encima competían con las secciones de
          abajo, que son lo que se viene a leer. */}
      <header className="mb-5">
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-balance text-ink">
          {alDia ? (
            <>Estás al día{profile ? `, ${profile.nombre}` : ''}</>
          ) : (
            <>
              Hoy te quedan <span className="text-primary">{totalPendientes}</span>{' '}
              {totalPendientes === 1 ? 'tarea' : 'tareas'}
            </>
          )}
        </h1>
        <p className="mt-1 text-[0.9rem] text-ink-3">
          {alDia
            ? 'No tenés pendientes urgentes. Buen momento para sumar leads a la cartera.'
            : 'Gestioná tus contactos y hacé crecer tu cartera'}
        </p>

        {/* Link y no botón: los contactados de hoy son para mirar hacia atrás
            cuando hace falta, no la acción con la que se arranca la jornada.
            Compitiendo en peso con el título desviaría de lo que queda por
            hacer, que es de lo que habla el resto de la pantalla. */}
        <Link
          to="/mi-dia/contactados"
          className="mt-2 inline-block text-[0.85rem] font-semibold text-primary hover:underline"
        >
          Ver contactados hoy →
        </Link>
      </header>

      {/* Cuatro cards del mismo peso. El tono de cada una es el de la sección
          que le corresponde más abajo, así el número y su lista se reconocen
          como la misma cosa. Misma grilla que la fila de KPIs de Estadísticas. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardKpi
          label="Prioritarios"
          valor={String(prioritarios.total)}
          tono="caliente"
          icono={<IconoAlerta className="size-[18px]" />}
          a="/leads?estado=CALIENTE"
        />
        <CardKpi
          label="Nuevos"
          valor={String(nuevos.total)}
          tono="brand"
          icono={<IconoPersonaMas className="size-[18px]" />}
          a="/leads?estado=nuevos"
        />
        <CardKpi
          label="Seguimientos"
          valor={String(seguimientos.total)}
          tono="tibio"
          icono={<IconoReloj className="size-[18px]" />}
          a="/leads"
        />
        <CardKpi
          label="Visitas hoy"
          valor={String(visitasHoy)}
          tono="frio"
          icono={<IconoCasa className="size-[18px]" />}
          a="/tareas"
        />
      </div>

      {listaCoincidencias.length > 0 && (
        <SeccionCoincidencias coincidencias={listaCoincidencias} />
      )}

      {/* Par 1: los dos frentes de leads que se atienden primero. */}
      {alDia ? (
        <div className="mb-5 rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-badge-ganado-bg text-primary-dark"
          >
            <IconoCheck className="size-6" />
          </span>
          <h2 className="m-0 text-[1.05rem] font-bold text-ink">
            Estás al día, no tenés pendientes urgentes
          </h2>
          <p className="mt-1.5 text-[0.9rem] text-ink-3">
            Ningún lead prioritario, sin contactar ni con seguimiento para hoy.
          </p>
        </div>
      ) : (
        <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
          <ListaLeads
            titulo="Leads prioritarios"
            subtitulo="Calientes o con el seguimiento vencido"
            textoBadge={prioritarios.leads.length === 1 ? 'urgente' : 'urgentes'}
            variante="prioritarios"
            leads={prioritarios.leads}
            total={prioritarios.total}
            verTodosRuta="/leads?estado=CALIENTE"
            onRegistrar={setLeadARegistrar}
          />

          <ListaLeads
            titulo="Nuevos leads"
            subtitulo="Todavía no tuvieron un primer contacto"
            textoBadge={nuevos.leads.length === 1 ? 'nuevo' : 'nuevos'}
            variante="nuevos"
            leads={nuevos.leads}
            total={nuevos.total}
            verTodosRuta="/leads?estado=nuevos"
            onRegistrar={setLeadARegistrar}
          />
        </div>
      )}

      {/* Par 2: lo que queda por hacer hoy, de los dos lados —los leads a los
          que hay que volver y la agenda del día—. Cuando no hay seguimientos
          la agenda se queda sola en la columna izquierda: es preferible a
          moverla de par según el estado de los leads. */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        {!alDia && (
          <ListaLeads
            titulo="Seguimientos"
            subtitulo="Contactos que necesitan un recordatorio hoy"
            textoBadge={seguimientos.leads.length === 1 ? 'pendiente' : 'pendientes'}
            variante="seguimientos"
            leads={seguimientos.leads}
            total={seguimientos.total}
            verTodosRuta="/leads"
            onRegistrar={setLeadARegistrar}
          />
        )}
        {/* Sin seguimientos no hay con quién compartir la fila: la agenda toma
            el par entero en vez de dejar media columna vacía al lado. */}
        <ResumenTareasHoy className={alDia ? 'lg:col-span-2' : ''} />
      </div>

      {/* Par 3: el contexto de la cartera. Va fuera del ternario de `alDia`:
          estar al día con los leads no es motivo para esconder las propiedades
          ni el registro de lo hecho.

          Los cuatro pares usan el mismo `gap-4 lg:grid-cols-2` que Estadísticas
          para sus pares de tarjetas, y el `[&>*]:mb-0` apaga el `mb-5` que
          cada sección trae para cuando va apilada: acá el aire entre columnas
          lo pone el `gap`, y el de abajo el `mb-5` de la grilla. Alcanza a la
          sección y a su skeleton, que es el otro nodo que cada hija devuelve.

          En mobile, con una sola columna, el orden de lectura sigue el del
          markup: prioritarios → nuevos → seguimientos → agenda → propiedades
          → actividad → operaciones. */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        <ListaPropiedadesRecientes />
        <ActividadReciente />
      </div>

      {/* Par 4: las operaciones cierran la pantalla a ancho completo. Quedaron
          sin compañera al entrar Actividad reciente, y estirarlas es preferible
          a dejar media fila vacía al lado —mismo criterio que la agenda del Par
          2 cuando no hay seguimientos—. Van últimas y no antes de la actividad
          porque son el estado de la cartera, el horizonte más largo de la
          pantalla: se lee después de lo que pasó hoy. */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        <ListaOperacionesEnCurso className="lg:col-span-2" />
      </div>

      {/* Registrar desde acá no navega: `useCrearInteraccion` invalida
          `['leads']`, del que cuelgan los candidatos del día y los contactados
          de hoy, así que la fila se va de su sección y el progreso avanza sin
          que la pantalla se recargue. */}
      {leadARegistrar && (
        <ModalNuevaInteraccion
          abierto
          leadId={leadARegistrar.id}
          nombreLead={`${leadARegistrar.nombre} ${leadARegistrar.apellido ?? ''}`.trim()}
          onCerrar={() => setLeadARegistrar(null)}
          onCreada={() => mostrarAviso('Interacción registrada.')}
        />
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tu jornada" className="mx-auto max-w-[1120px]">
      <div className="mb-2 h-9 w-72 max-w-full animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-6 h-5 w-96 max-w-full animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-[84px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>

      {/* Los cuatro pares, con el mismo grid que la pantalla real para que no
          se reacomode nada al llegar los datos. Las secciones de abajo tienen
          además su propio skeleton para cuando su query tarda más que la de
          leads; estos bloques cubren el rato anterior, en el que Mi día
          todavía no montó ninguna. */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        <BloqueSeccion alto="h-[258px]" />
        <BloqueSeccion alto="h-[258px]" />
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        <BloqueSeccion alto="h-[258px]" />
        <BloqueSeccion alto="h-[219px]" />
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        <BloqueSeccion alto="h-[193px]" />
        <BloqueSeccion alto="h-[193px]" />
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2 [&>*]:mb-0">
        <BloqueSeccion alto="h-[193px]" className="lg:col-span-2" />
      </div>
    </div>
  )
}

/** Título y cuerpo de una sección de lista, mientras carga. */
function BloqueSeccion({ alto, className = '' }: { alto: string; className?: string }) {
  return (
    <div className={`mb-5 ${className}`.trim()}>
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div
        className={`${alto} animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none`}
      />
    </div>
  )
}
