import { Link, useParams } from 'react-router-dom'
import { EditorFlyer } from '../components/propiedades/EditorFlyer'
import { IconoFlechaAtras } from '../components/leads/Iconos'
import { useDetallePropiedad } from '../hooks/useDetallePropiedad'

export default function EditorFlyerPagina() {
  const { propiedadId = '' } = useParams()
  const { data: propiedad, isPending, isError, error } = useDetallePropiedad(propiedadId)

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <Aviso
        titulo="No pudimos cargar la propiedad"
        detalle={error instanceof Error ? error.message : 'Probá de nuevo en un momento.'}
      />
    )
  }

  // `null` cubre tanto "no existe" como "RLS la tapa": para el usuario es lo mismo.
  if (!propiedad) {
    return (
      <Aviso
        titulo="No encontramos esta propiedad"
        detalle="Puede que la hayan eliminado o que no tengas permiso para verla."
      />
    )
  }

  return (
    // Desde lg el editor llena la pantalla: 100dvh menos el header (4rem) y el
    // padding vertical del <main> (4rem). Debajo de lg la página scrollea normal.
    <div className="mx-auto max-w-[1200px] lg:flex lg:h-[calc(100dvh-8rem)] lg:flex-col">
      <Link
        to="/flyers"
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-[0.9rem] font-bold text-primary transition-colors hover:text-primary-dark motion-reduce:transition-none"
      >
        <IconoFlechaAtras className="size-4" />
        Volver a flyers
      </Link>

      <h1 className="m-0 mb-1 text-[1.6rem] font-bold text-ink">
        Crear flyer — {propiedad.zona?.trim() || propiedad.direccion}
      </h1>
      <p className="m-0 text-[0.92rem] text-ink-3">
        Un flyer listo para Instagram (1080×1350). No se guarda: lo descargás y listo.
      </p>

      <EditorFlyer propiedad={propiedad} />
    </div>
  )
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rounded-[16px] border border-dashed border-border bg-surface px-6 py-14 text-center">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        <p className="mt-1 text-sm text-ink-3">{detalle}</p>
        <Link
          to="/flyers"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-dark"
        >
          Volver a flyers
        </Link>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando la propiedad" className="mx-auto max-w-[900px]">
      <div className="mb-4 h-10 w-2/3 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
      <div className="h-96 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
