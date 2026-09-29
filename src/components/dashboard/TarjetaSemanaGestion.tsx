import { useResumenSemanaGestion } from '../../hooks/useModeloGestion'
import { desdeClaveDia } from '../../lib/calendario'
import { calcularRitmo, hoyEnArgentina, type Ritmo } from '../../lib/ritmoSemanal'
import { TooltipAyuda } from '../comunes/TooltipAyuda'
import { IconoCheck } from '../leads/Iconos'
import { AnilloProgreso } from './AnilloProgreso'
import { SeccionCard } from './SeccionCard'

/** Las metas de la semana. Fijas por ahora; más adelante, configurables. */
export const METAS_SEMANALES = { verdes: 15, preListingBuying: 3, nuevosContactos: 1 } as const

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** `YYYY-MM-DD` → "mié 24/09". Parseo local: con `new Date(clave)` sería UTC y
 *  en Argentina caería en el día anterior. */
function etiquetaDia(clave: string): string {
  const fecha = desdeClaveDia(clave)
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${DIAS[fecha.getDay()]} ${dd}/${mm}`
}

/**
 * La semana del modelo de gestión en Mi día: actividades verdes,
 * prelistings/prebuyings y nuevos contactos contra sus metas, con el ritmo que
 * habría que llevar a esta altura de la semana.
 *
 * Sólo se monta con el flag prendido, así que la query arranca habilitada.
 */
export function TarjetaSemanaGestion() {
  const { data, isPending, isError } = useResumenSemanaGestion(true)

  if (isPending) return <Skeleton />

  if (isError || !data) {
    return (
      <SeccionCard
        icono={<IconoCheck className="size-4" />}
        tono="brand"
        titulo="Tu semana"
        subtitulo="Reuniones, prelistings y contactos nuevos"
      >
        <p
          role="alert"
          className="mt-2 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.8rem] text-peligro-ink"
        >
          No pudimos cargar el resumen de tu semana.
        </p>
      </SeccionCard>
    )
  }

  const hoy = hoyEnArgentina()
  const preListingBuying = data.prelistings + data.prebuyings
  const ritmoVerdes = calcularRitmo(data.verdes, METAS_SEMANALES.verdes, data.semana_inicio, hoy)
  const ritmoPre = calcularRitmo(
    preListingBuying,
    METAS_SEMANALES.preListingBuying,
    data.semana_inicio,
    hoy,
  )
  const nuevosCumplido = data.nuevos_contactos >= METAS_SEMANALES.nuevosContactos

  return (
    <SeccionCard
      icono={<IconoCheck className="size-4" />}
      tono="brand"
      titulo="Tu semana"
      subtitulo={`${etiquetaDia(data.semana_inicio)} → ${etiquetaDia(data.semana_fin)}`}
    >
      {/* La ayuda del título va acá y no al lado de "Tu semana": `SeccionCard`
          recibe el título como string y no admite un nodo al lado. */}
      <div className="mt-1 flex items-center gap-1 text-[0.75rem] text-ink-3">
        <span>Cómo se lee</span>
        <TooltipAyuda etiqueta="tu semana">
          Mínimos semanales para sostener el negocio. La semana va de miércoles a
          martes. La marca en cada anillo indica cuánto deberías llevar a hoy.
        </TooltipAyuda>
      </div>

      {/* Tres columnas también en mobile: a 84px los anillos entran en un
          teléfono de 360px y se leen como un solo tablero, que es la idea. */}
      <div className="mt-3 grid grid-cols-3 items-start gap-2 sm:gap-4">
        <AnilloProgreso
          etiqueta="Reuniones cara a cara"
          ayuda={
            <TooltipAyuda etiqueta="las reuniones cara a cara">
              Visitas y reuniones presenciales con clientes, prospectos o colegas: es la
              actividad que genera negocios. Mínimo recomendado: 15 por semana.
            </TooltipAyuda>
          }
          valor={data.verdes}
          meta={METAS_SEMANALES.verdes}
          marcaEsperado={ritmoVerdes.esperado}
          alerta={!ritmoVerdes.alDia}
          detalle={<TextoRitmo ritmo={ritmoVerdes} />}
        />
        <AnilloProgreso
          etiqueta="Prelistings / prebuyings"
          ayuda={
            <TooltipAyuda etiqueta="los prelistings y prebuyings">
              Reuniones con un propietario para captar su propiedad (prelisting) o con un
              comprador para entender su búsqueda (prebuying). Para que cuenten, al cargar
              una reunión elegí el tipo. Mínimo recomendado: 3 por semana.
            </TooltipAyuda>
          }
          valor={preListingBuying}
          meta={METAS_SEMANALES.preListingBuying}
          marcaEsperado={ritmoPre.esperado}
          alerta={!ritmoPre.alDia}
          detalle={
            <>
              <span className="block tabular-nums">
                Prelisting {data.prelistings} · Prebuying {data.prebuyings}
              </span>
              <TextoRitmo ritmo={ritmoPre} />
            </>
          }
        />
        <AnilloProgreso
          etiqueta="Contactos nuevos"
          ayuda={
            <TooltipAyuda etiqueta="los contactos nuevos">
              Leads propios o referidos que sumaste esta semana (origen Referido o
              Manual). Mínimo recomendado: 1 por semana.
            </TooltipAyuda>
          }
          valor={data.nuevos_contactos}
          meta={METAS_SEMANALES.nuevosContactos}
          detalle={
            <span className={`block font-semibold ${nuevosCumplido ? 'text-primary' : 'text-ink-3'}`}>
              {nuevosCumplido ? 'Cumplido' : 'Pendiente'}
            </span>
          }
        />
      </div>
    </SeccionCard>
  )
}

/** "Vas al día" o cuánto debería llevar y cuánto falta, en el color del arco. */
function TextoRitmo({ ritmo }: { ritmo: Ritmo }) {
  if (ritmo.alDia) {
    return <span className="block font-semibold text-primary">Vas al día</span>
  }
  return (
    <span className="block font-semibold text-badge-tibio-ink">
      Deberías llevar {ritmo.esperado} · te faltan {ritmo.faltan}
    </span>
  )
}

/**
 * Mismo skeleton que las secciones de Mi día: barra de título y bloque, del
 * alto de la tarjeta con sus anillos.
 */
function Skeleton() {
  return (
    <div aria-hidden className="mb-4">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[196px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none sm:h-[224px]" />
    </div>
  )
}
