import { useEffect, useState } from 'react'

export type Tema = 'claro' | 'oscuro'

/** Clave de localStorage. La lee también el script inline de index.html. */
const CLAVE = 'leadera-tema'

/**
 * Rutas públicas: se ven siempre en claro, sin importar la preferencia.
 *
 * Es la misma expresión que el script inline de index.html: si se agrega una
 * ruta pública en App.tsx, hay que sumarla en los dos lugares.
 */
const RUTAS_PUBLICAS = /^\/(login|signup|recuperar-contrasena|reset-password|c\/[^/]+)\/?$/

/** El panel de administración (/admin y lo que cuelga) también va siempre en claro. Mismo aviso que arriba. */
const RUTAS_ADMIN = /^\/admin(\/|$)/

export function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.test(pathname)
}

/** Rutas donde el tema oscuro no aplica nunca: las públicas y el panel de admin. */
export function vaSiempreEnClaro(pathname: string): boolean {
  return esRutaPublica(pathname) || RUTAS_ADMIN.test(pathname)
}

/** Lo guardado, o null si no hay nada válido o no se puede leer. */
function leerGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE)
    return valor === 'claro' || valor === 'oscuro' ? valor : null
  } catch {
    return null
  }
}

function guardar(tema: Tema): void {
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // Modo privado o almacenamiento bloqueado: el tema dura lo que la pestaña.
  }
}

/** Sin preferencia guardada, manda la del sistema operativo. */
function temaPreferido(): Tema {
  const guardado = leerGuardado()
  if (guardado) return guardado
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

/**
 * Pone o saca la clase `dark` de <html> según la ruta: en las que van siempre
 * en claro la saca; en el resto aplica la preferencia guardada (o la del
 * sistema). Lo llama `SincronizarTema` (App.tsx) en cada navegación, así
 * también se cubren las redirecciones al login que no pasan por la app.
 */
export function aplicarTemaSegunRuta(pathname: string): void {
  // "/" sólo redirige (a la app o al login): se deja como esté, igual que en
  // el script de index.html. Decide la ruta a la que termina yendo.
  if (pathname === '/') return
  const oscuro = !vaSiempreEnClaro(pathname) && temaPreferido() === 'oscuro'
  document.documentElement.classList.toggle('dark', oscuro)
}

/**
 * Tema claro / oscuro de la app autenticada, para el botón del header.
 *
 * Sólo se monta dentro de AppLayout, así que nunca corre en una ruta que va
 * siempre en claro. La primera carga la resuelve el script inline de
 * index.html, antes de que pinte React; las navegaciones, `SincronizarTema`.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>(temaPreferido)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
  }, [tema])

  function alternarTema() {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro'
    setTema(nuevo)
    guardar(nuevo)
  }

  return { tema, alternarTema }
}
