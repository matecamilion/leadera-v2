import { linkEmail, linkTelefono, linkWhatsApp } from '../../lib/telefono'
import { IconoChat, IconoTelefono } from '../leads/Iconos'

/**
 * Acciones de contacto: llamar, WhatsApp, mail.
 *
 * El patrón visual sale de `CardKanban`, que fue el primero en tenerlas: links
 * chicos con ícono, sin fondo, que se tiñen de `primary` al hover. Los tamaños
 * de texto y el color base los pone el contenedor, así que estos componentes
 * se ven distinto en la ficha y en una card sin necesitar variantes.
 */

const CLASES_ICONO =
  'inline-flex shrink-0 rounded-md p-0.5 transition-colors hover:bg-brand-softer hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary motion-reduce:transition-none'

interface TelefonoConAccionesProps {
  telefono: string
  /** Para los aria-label: "Llamar a Juan Pérez". */
  nombre?: string
  /** Ícono de teléfono adelante del número. */
  conIcono?: boolean
}

/**
 * El número, clickeable para llamar, con el botón de WhatsApp al lado.
 *
 * Para el `tel:` va el número tal cual está guardado; para wa.me va
 * normalizado. Si de lo cargado no sale ni un dígito, el botón de WhatsApp no
 * se dibuja: es preferible que falte a que abra una conversación con nadie.
 */
export function TelefonoConAcciones({
  telefono,
  nombre,
  conIcono = false,
}: TelefonoConAccionesProps) {
  const aQuien = nombre ? ` a ${nombre}` : ''
  const whatsapp = linkWhatsApp(telefono)

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {conIcono && <IconoTelefono className="size-4 shrink-0" />}

      <a
        href={linkTelefono(telefono)}
        title="Llamar"
        aria-label={`Llamar${aQuien}`}
        className="truncate hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        {telefono}
      </a>

      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          aria-label={`WhatsApp${aQuien}`}
          className={CLASES_ICONO}
        >
          <IconoChat className="size-4" />
        </a>
      )}
    </span>
  )
}

/** El email como `mailto:`. Sin ícono propio: lo pone el contenedor. */
export function EmailLink({ email }: { email: string }) {
  return (
    <a
      href={linkEmail(email)}
      title="Enviar un mail"
      className="truncate hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      {email}
    </a>
  )
}

/**
 * Sólo los íconos, sin el número.
 *
 * Para las filas donde el teléfono ya se muestra como texto adentro de otro
 * link —un `<a>` dentro de otro `<a>` no es HTML válido— y las acciones tienen
 * que vivir aparte.
 */
export function AccionesContacto({
  telefono,
  nombre,
}: {
  telefono: string
  nombre?: string
}) {
  const aQuien = nombre ? ` a ${nombre}` : ''
  const whatsapp = linkWhatsApp(telefono)

  return (
    <span className="inline-flex items-center gap-0.5 text-ink-3">
      <a
        href={linkTelefono(telefono)}
        title="Llamar"
        aria-label={`Llamar${aQuien}`}
        className={`${CLASES_ICONO} p-1.5`}
      >
        <IconoTelefono className="size-4" />
      </a>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          aria-label={`WhatsApp${aQuien}`}
          className={`${CLASES_ICONO} p-1.5`}
        >
          <IconoChat className="size-4" />
        </a>
      )}
    </span>
  )
}
