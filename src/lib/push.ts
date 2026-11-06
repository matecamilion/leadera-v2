/**
 * Web Push en el navegador (sin React): estado, alta, baja y re-sincronización
 * de la suscripción de ESTE dispositivo. El envío real lo hace la Edge Function
 * `enviar-push`; acá solo se registra al dispositivo en `push_suscripciones`.
 *
 * Nada de lo que se loguea incluye el endpoint, las claves ni el user agent.
 */
import { supabase } from './supabase'
import { detectarPlataforma } from './instalarApp'

export type EstadoPush = 'no_soportado' | 'requiere_instalar_ios' | 'bloqueado' | 'inactivo' | 'activo'

const CLAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY
const ESPERA_REGISTRO_MS = 10_000
const ESPERA_BAJA_MS = 3_000

/** Convierte la clave VAPID (base64url) en los bytes que pide `subscribe`. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(crudo.length)
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

function navegadorSoportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Solo el tipo de error o su código: un mensaje podría traer datos del dispositivo. */
function describir(error: unknown): string {
  if (error instanceof Error) return error.name
  if (typeof error === 'object' && error !== null && 'code' in error) return String(error.code)
  return 'desconocido'
}

function advertir(contexto: string, error: unknown) {
  console.warn(`[push] ${contexto}: ${describir(error)}`)
}

function esperar(ms: number): Promise<'tiempo'> {
  return new Promise((resolver) => setTimeout(() => resolver('tiempo'), ms))
}

/** `ready` no se resuelve nunca si no hay service worker (p. ej. en dev): se acota. */
async function registroListo(): Promise<ServiceWorkerRegistration> {
  const registro = await Promise.race([navigator.serviceWorker.ready, esperar(ESPERA_REGISTRO_MS)])
  if (registro === 'tiempo') throw new Error('sin service worker')
  return registro
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration()
  return registro ? registro.pushManager.getSubscription() : null
}

export async function estadoSoporte(): Promise<EstadoPush> {
  if (!CLAVE_VAPID) return 'no_soportado'
  // En iOS fuera de la app instalada `PushManager` ni existe: se chequea antes.
  const { esIos, instalada } = detectarPlataforma()
  if (esIos && !instalada) return 'requiere_instalar_ios'
  if (!navegadorSoportaPush()) return 'no_soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission !== 'granted') return 'inactivo'
  return (await suscripcionActual()) ? 'activo' : 'inactivo'
}

async function suscribir(registro: ServiceWorkerRegistration): Promise<PushSubscription> {
  return registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(CLAVE_VAPID),
  })
}

/** Alta (o renovación) de la fila del dispositivo para el usuario actual. */
async function registrar(suscripcion: PushSubscription): Promise<void> {
  const { keys } = suscripcion.toJSON()
  if (!keys?.p256dh || !keys.auth) throw new Error('suscripción sin claves')
  const { error } = await supabase.rpc('registrar_push_suscripcion', {
    p_endpoint: suscripcion.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

/**
 * Pide permiso y suscribe este dispositivo. Hay que llamarla DIRECTO desde el
 * click: `requestPermission` va primero, antes de cualquier await (Safari exige
 * el gesto del usuario). Devuelve false si no se concedió el permiso; tira si
 * falla lo técnico.
 */
export async function activarPush(): Promise<boolean> {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return false

  const registro = await registroListo()
  const suscripcion = await suscribir(registro)
  try {
    await registrar(suscripcion)
  } catch (error) {
    // Sin fila en el servidor no puede quedar un dispositivo "activo".
    await suscripcion.unsubscribe().catch((e: unknown) => advertir('deshacer alta', e))
    throw error
  }
  return true
}

/** Borra la fila propia y después la suscripción del navegador. */
export async function desactivarPush(): Promise<void> {
  const suscripcion = await suscripcionActual()
  if (!suscripcion) return
  const { error } = await supabase
    .from('push_suscripciones')
    .delete()
    .eq('endpoint', suscripcion.endpoint)
  // Si la fila no se pudo borrar igual se desuscribe: el servidor la limpia
  // cuando el push service responde 404/410.
  if (error) advertir('borrar suscripción', error)
  await suscripcion.unsubscribe()
}

let yaSincronizada = false

/**
 * Al abrir la app con el permiso concedido: SOLO renueva una suscripción que ya
 * existe (actualiza `last_seen_at` y reasigna la fila al usuario actual). Si no
 * hay suscripción no hace nada y nunca suscribe por su cuenta: tras cerrar
 * sesión el dispositivo se desuscribe pero el permiso del navegador queda
 * concedido, y re-suscribir sin preguntar activaría los avisos para el próximo
 * usuario de la compu. Una vez por carga (se rearma al cerrar sesión). Nunca tira.
 */
export async function sincronizarPush(): Promise<void> {
  if (yaSincronizada) return
  yaSincronizada = true
  try {
    if (!CLAVE_VAPID || !navegadorSoportaPush() || Notification.permission !== 'granted') return
    const registro = await registroListo()
    const suscripcion = await registro.pushManager.getSubscription()
    if (!suscripcion) return
    await registrar(suscripcion)
  } catch (error) {
    advertir('sincronizar', error)
  }
}

/**
 * Baja del dispositivo al cerrar sesión, ANTES del signOut (con la sesión
 * cerrada la RLS no deja borrar la fila). Best-effort: acotada a unos segundos,
 * nunca tira y nunca frena el cierre de sesión.
 */
export async function bajaPushAlCerrarSesion(): Promise<void> {
  try {
    if (!navegadorSoportaPush()) return
    await Promise.race([desactivarPush(), esperar(ESPERA_BAJA_MS)])
  } catch (error) {
    advertir('baja al cerrar sesión', error)
  } finally {
    // El próximo usuario de esta misma carga de la página tiene que sincronizarse.
    yaSincronizada = false
  }
}
