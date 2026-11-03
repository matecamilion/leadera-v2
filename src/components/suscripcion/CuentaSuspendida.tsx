import { linkDeCobros, mensajeDeSuspension } from '../../lib/config'
import { textoDeBloqueo, type EstadoDeMiSuscripcion } from '../../lib/api/suscripcion'

/**
 * La pantalla Suscripción de una cuenta suspendida por el administrador.
 *
 * Reemplaza a la vista de cuenta y al catálogo de planes: una cuenta suspendida
 * no tiene nada que contratar ni cambiar, lo único que se puede hacer es
 * escribirle a LeadEra. Tampoco dice por qué se la suspendió: ese motivo es
 * interno y el cliente no lo ve.
 */
export function CuentaSuspendida({
  estado,
  rol,
}: {
  estado: EstadoDeMiSuscripcion
  rol: string | undefined
}) {
  const texto = textoDeBloqueo(estado, rol)
  const contacto = linkDeCobros(mensajeDeSuspension(estado.nombre))

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6">
        <p className="mb-1 text-meta leading-tight font-bold tracking-[0.05em] text-primary uppercase">
          Mi inmobiliaria
        </p>
        <h1 className="m-0 text-display font-bold text-ink">Suscripción</h1>
      </header>

      <div className="rounded-[16px] border border-border bg-surface px-6 py-6 shadow-md">
        <p className="m-0 inline-flex items-center rounded-full bg-peligro-soft px-3 py-1 text-meta font-bold text-peligro-ink uppercase">
          Suspendida
        </p>

        <h2 className="mt-3 mb-0 text-titulo font-bold text-ink">{texto.titulo}</h2>
        <p className="mt-1.5 mb-0 text-cuerpo text-ink-3">{texto.mensaje}</p>

        {contacto ? (
          <a
            href={contacto}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-cuerpo font-semibold text-primary-contrast transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Escribinos por WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  )
}
