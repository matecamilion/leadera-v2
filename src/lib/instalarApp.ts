/**
 * Instalación de la PWA.
 *
 * Chrome, Edge y Android avisan que la app es instalable con
 * `beforeinstallprompt`, un evento que se dispara una sola vez y bastante
 * temprano: hay que capturarlo al arrancar (acá), no cuando se monta el menú.
 * iOS no tiene ese evento; ahí la instalación es a mano desde Safari.
 *
 * Es estado del navegador, no de UI global: por eso un store mínimo para
 * `useSyncExternalStore` y no zustand.
 */

/** `beforeinstallprompt` no está en lib.dom. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Estado {
  evento: EventoInstalacion | null
  instalada: boolean
}

let estado: Estado = { evento: null, instalada: false }
const suscriptores = new Set<() => void>()

function cambiar(siguiente: Estado) {
  estado = siguiente
  suscriptores.forEach((aviso) => aviso())
}

/** Para `useSyncExternalStore`. */
export function suscribirInstalacion(aviso: () => void): () => void {
  suscriptores.add(aviso)
  return () => suscriptores.delete(aviso)
}

/** Para `useSyncExternalStore`: la referencia sólo cambia cuando cambia el estado. */
export function leerInstalacion(): Estado {
  return estado
}

/** Engancha los eventos de instalación. Se llama una vez, desde `src/pwa.ts`. */
export function capturarInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    cambiar({ ...estado, evento: e as EventoInstalacion })
  })
  window.addEventListener('appinstalled', () => {
    cambiar({ evento: null, instalada: true })
  })
}

/**
 * Muestra el diálogo nativo de instalación. Un evento sirve una sola vez, así
 * que se descarta antes de usarlo: un segundo clic no puede reusarlo.
 */
export async function pedirInstalacion(): Promise<void> {
  const evento = estado.evento
  if (!evento) return
  cambiar({ ...estado, evento: null })
  await evento.prompt()
  await evento.userChoice
}

export interface Plataforma {
  esIos: boolean
  /** La app ya corre como app instalada, no en una pestaña del navegador. */
  instalada: boolean
}

type NavegadorMinimo = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & {
  standalone?: boolean
}

export function detectarPlataforma(
  nav: NavegadorMinimo = navigator,
  estaEnStandalone: () => boolean = () => window.matchMedia('(display-mode: standalone)').matches,
): Plataforma {
  // Desde iPadOS 13 el iPad se reporta como Mac: se distingue por la pantalla táctil.
  const esIpadComoMac = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1
  const esIos = /iPhone|iPad|iPod/.test(nav.userAgent) || esIpadComoMac
  return { esIos, instalada: estaEnStandalone() || nav.standalone === true }
}
