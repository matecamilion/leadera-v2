import { IconoCasa, IconoCalendario, IconoUsuarios } from '../leads/Iconos'
import { useEstadisticasVisitasPropiedad } from '../../hooks/useVisitas'
import { mensajeDeError } from '../../lib/mensajesDeError'

/**
 * Actividad de visitas de la propiedad.
 *
 * Los números salen de un RPC y no de contar filas de `visitas`: las policies
 * de esa tabla acotan lo que cada usuario ve, así que un conteo desde el
 * cliente diría "las visitas que yo puedo ver" y no las de la propiedad. Acá
 * importa el total, incluidas las de otros agentes del equipo.
 */
export function SeccionActividadVisitas({ propiedadId }: { propiedadId: string }) {
  const { data, isPending, error } = useEstadisticasVisitasPropiedad(propiedadId)

  if (isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando la actividad"
        className="grid grid-cols-3 gap-3"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-[86px] animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {mensajeDeError(error, 'No pudimos cargar la actividad.')}
      </p>
    )
  }

  const { visitasRealizadas, visitasAgendadas, interesadosUnicos } = data

  // Tres ceros no dicen nada que una frase no diga mejor.
  if (visitasRealizadas === 0 && visitasAgendadas === 0 && interesadosUnicos === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
        Todavía sin visitas registradas.
      </p>
    )
  }

  return (
    <dl className="grid grid-cols-3 gap-3">
      <Numero
        valor={visitasRealizadas}
        label={visitasRealizadas === 1 ? 'visita realizada' : 'visitas realizadas'}
        icono={<IconoCasa className="size-[18px]" />}
        tono="bg-badge-ganado-bg text-primary-dark"
      />
      <Numero
        valor={visitasAgendadas}
        label={visitasAgendadas === 1 ? 'agendada' : 'agendadas'}
        icono={<IconoCalendario className="size-[18px]" />}
        tono="bg-warm-soft text-badge-tibio-ink"
      />
      <Numero
        valor={interesadosUnicos}
        label={interesadosUnicos === 1 ? 'interesado único' : 'interesados únicos'}
        icono={<IconoUsuarios className="size-[18px]" />}
        tono="bg-cool-soft text-frio"
      />
    </dl>
  )
}

function Numero({
  valor,
  label,
  icono,
  tono,
}: {
  valor: number
  label: string
  icono: React.ReactNode
  tono: string
}) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-sm">
      <span
        aria-hidden
        className={`mb-2 flex size-8 items-center justify-center rounded-[10px] ${tono}`}
      >
        {icono}
      </span>
      <dd className="text-[1.4rem] leading-none font-bold text-ink tabular-nums">
        {valor}
      </dd>
      <dt className="mt-1 text-[0.78rem] leading-snug text-ink-3">{label}</dt>
    </div>
  )
}
