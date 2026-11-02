import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useFotosPropiedad } from '../../hooks/useFotosPropiedad'
import {
  etiquetaTipo,
  formatearPrecio,
  type PropiedadConPropietario,
} from '../../lib/api/propiedades'
import { MAX_FOTOS } from '../../lib/api/storage'
import { mensajeDeLote, textoFaltanFotos } from '../../lib/fotosLote'
import { puedeEditarPropiedad, TEXTO_SIN_PERMISO } from '../../lib/puedeEditarPropiedad'
import { BotonElegirFotos } from './BotonElegirFotos'
import { FOTOS_PARA_FLYER } from './imagen/constantes'

/**
 * Una propiedad en la pantalla de flyers.
 *
 * Con fotos suficientes es un link al editor. Sin ellas, se ven pero no llevan
 * a ningún lado, y quien puede editar la propiedad tiene el botón para cargarlas
 * ahí mismo.
 *
 * La estructura es fija a propósito: un contenedor raíz que nunca cambia de
 * tipo, con tres hijos en el mismo orden —el cuerpo (imagen y texto), el botón
 * sobre la imagen y el área de estado—. Sólo el cuerpo cambia de `<div>` a
 * `<Link>` al llegar a las 3 fotos, y el estado de la subida vive en este
 * componente y no en un hijo, así que no se pierde con el cambio. El botón y el
 * estado quedan afuera del link: un botón no se anida en un enlace.
 */
export function TarjetaFlyer({ propiedad: p }: { propiedad: PropiedadConPropietario }) {
  const { profile } = useAuth()
  const { subirLote, progresoLote } = useFotosPropiedad(p.id)

  const fotos = p.fotos_urls ?? []
  const alcanza = fotos.length >= FOTOS_PARA_FLYER
  const faltan = FOTOS_PARA_FLYER - fotos.length

  // Mientras el perfil carga no se sabe qué puede hacer: ni botón ni mensaje de
  // permiso, para que no aparezca y se retire (o al revés).
  const permiso = profile ? puedeEditarPropiedad(profile, p) : null
  const hayCupo = fotos.length < MAX_FOTOS
  const mostrarBoton = !alcanza && permiso?.puede === true && hayCupo

  const subiendo = subirLote.isPending
  const resultado = subirLote.data
  const mensaje = resultado ? mensajeDeLote(resultado) : null
  const huboCarga = (resultado?.subidas ?? 0) > 0

  const direccion = p.direccion || 'la propiedad'

  const cuerpo = (
    <>
      <div className="aspect-[4/5] w-full overflow-hidden bg-surface-2">
        {fotos[0] && (
          <img
            src={fotos[0]}
            alt=""
            loading="lazy"
            className={`size-full object-cover ${alcanza ? '' : 'opacity-60'}`}
          />
        )}
      </div>
      <div className="px-3.5 py-3">
        <div className={alcanza ? '' : 'opacity-60'}>
          <p className="m-0 truncate text-[0.88rem] font-bold text-ink">
            {etiquetaTipo(p.tipo)}
            {p.zona ? ` · ${p.zona}` : ''}
          </p>
          <p className="m-0 mt-0.5 text-[0.88rem] text-ink-2 tabular-nums">
            {p.precio == null ? 'Precio a consultar' : formatearPrecio(p.precio, p.moneda)}
          </p>
        </div>
        {!alcanza && (
          <p className="m-0 mt-1.5 text-[0.78rem] break-words text-ink-3">
            {textoFaltanFotos(faltan)}
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-border bg-surface">
      {/* 1. El cuerpo. Es lo único que cambia de elemento. */}
      {alcanza ? (
        <Link
          to={`/flyers/${p.id}`}
          className="block transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {cuerpo}
        </Link>
      ) : (
        <div>{cuerpo}</div>
      )}

      {/* 2. El botón, centrado sobre el área de la imagen (4:5, como el cuerpo). */}
      {mostrarBoton ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[4/5] items-center justify-center p-2">
          <div className="pointer-events-auto max-w-full">
            <BotonElegirFotos
              etiqueta={progresoLote ? `Subiendo ${progresoLote.actual} de ${progresoLote.total}…` : subiendo ? 'Actualizando…' : 'Cargar fotos'}
              ariaLabel={`Cargar fotos de ${direccion}`}
              deshabilitado={subiendo}
              onElegir={(archivos) => subirLote.mutate({ archivos, fotosActuales: fotos.length })}
            />
          </div>
        </div>
      ) : null}

      {/* 3. El estado: permiso, errores y resultado. Siempre en el mismo lugar. */}
      <div className="px-3.5 pb-3 empty:hidden">
        {!alcanza && permiso && !permiso.puede && (
          <p className="m-0 text-[0.78rem] break-words text-ink-3">
            {TEXTO_SIN_PERMISO[permiso.motivo]}
          </p>
        )}

        {mensaje?.tipo === 'error' && (
          <p
            role="alert"
            className="m-0 mt-1.5 rounded-lg border border-peligro-borde bg-peligro-soft px-2.5 py-1.5 text-[0.76rem] break-words text-peligro-ink"
          >
            {mensaje.texto}
          </p>
        )}

        {mensaje?.tipo === 'aviso' && (
          <p role="status" className="m-0 mt-1.5 text-[0.76rem] break-words text-ink-3">
            {mensaje.texto}
          </p>
        )}

        {alcanza && huboCarga && (
          <p role="status" className="m-0 mt-1.5 text-[0.78rem] font-semibold text-success">
            Listo para crear el flyer
          </p>
        )}
      </div>
    </div>
  )
}
