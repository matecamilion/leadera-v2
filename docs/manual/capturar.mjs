// Capturas de pantalla de la app para el manual de uso.
//
// Entra con la cuenta de pruebas (TEST_EMAIL / TEST_PASSWORD, de .env.local o
// del entorno) y guarda PNG en capturas/. Usa el Chrome, Edge o Chromium que ya
// hay en la máquina: no descarga ningún navegador.
//
//   node capturar.mjs                              todas las capturas
//   node capturar.mjs por-enfriarse tablero-operaciones   solo esas (con o sin .png)
//
// Variables opcionales: BASE_URL (por defecto https://app.leadera.com.ar) y
// CHROME_PATH (ruta de un ejecutable de Chrome/Chromium).

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = join(AQUI, 'capturas')
const ARCHIVO_ENV = join(AQUI, '.env.local')

// Las variables que ya estén en el entorno mandan sobre el archivo.
if (existsSync(ARCHIVO_ENV)) process.loadEnvFile(ARCHIVO_ENV)

// ---------------------------------------------------------------------------
// Datos del seed (supabase/demo): la cuenta de pruebas, nunca datos reales.
// ---------------------------------------------------------------------------

/** Martina Beltrán: CALIENTE, 2 interacciones, seguimiento agendado para hoy. */
const LEAD_FICHA = 'de1a0001-0000-4000-8000-000000000001'
/** Compra reservada de Almafuerte 450 (comprador Ramiro Castellano). */
const OPERACION_TRAMITE = 'de1d0004-0000-4000-8000-000000000007'

/** Almafuerte 450: casa en Playa Grande, con fotos de interiores. */
const PROPIEDAD_DETALLE = 'de1b0002-0000-4000-8000-000000000005'

/** Fotos mínimas para armar un flyer (FOTOS_PARA_FLYER en src/components/propiedades/imagen/constantes.ts). */
const FOTOS_MINIMAS_FLYER = 3

/** La oferta de Rivadavia 2840 (la propiedad que cumple la búsqueda de Martina). */
const OFERTA_COINCIDENCIAS = new URLSearchParams({
  of_op: 'COMPRA',
  of_precio: '115000',
  of_moneda: 'USD',
  of_tipo: 'DEPARTAMENTO',
  of_zona: 'Centro',
  of_amb: '3',
  of_m2: '68',
  of_banos: '2',
  of_coch: '1',
})

const ESCRITORIO = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const MOVIL = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
}

/** Hosts donde se permite capturar: producción y la app local. */
const HOSTS_PERMITIDOS = new Set(['app.leadera.com.ar', 'localhost', '127.0.0.1'])

/**
 * Espera final, ya con todo cargado, para que terminen las transiciones de CSS
 * que ningún estado de la página anuncia. Es lo único que no es una condición.
 */
const COLCHON_MS = 250

const TIMEOUT_MS = 30_000

/** Aire debajo del último bloque en las capturas recortadas hasta un elemento. */
const MARGEN_FINAL_PX = 24

// ---------------------------------------------------------------------------
// Configuración: falla antes de abrir nada si falta algo
// ---------------------------------------------------------------------------

function salirConError(mensaje) {
  console.error(`Error: ${mensaje}`)
  process.exit(1)
}

function leerBase() {
  let base
  try {
    base = new URL(process.env.BASE_URL || 'https://app.leadera.com.ar')
  } catch {
    return salirConError('BASE_URL no es una URL válida.')
  }
  if (!HOSTS_PERMITIDOS.has(base.hostname)) {
    return salirConError(
      `BASE_URL apunta a "${base.hostname}". Solo se captura app.leadera.com.ar o localhost, para no sacar capturas del entorno equivocado.`,
    )
  }
  return base
}

function leerCredenciales() {
  const email = process.env.TEST_EMAIL?.trim()
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    return salirConError(
      'Faltan TEST_EMAIL y TEST_PASSWORD. Definilas en docs/manual/.env.local (hay un ejemplo en .env.local.example) o en el entorno.',
    )
  }
  return { email, password }
}

/** Chrome, después Edge, después el Chromium de ms-playwright. CHROME_PATH manda sobre todo. */
function buscarNavegador() {
  if (process.env.CHROME_PATH) {
    if (!existsSync(process.env.CHROME_PATH)) {
      return salirConError('CHROME_PATH no apunta a un archivo que exista.')
    }
    return process.env.CHROME_PATH
  }

  const local = process.env.LOCALAPPDATA ?? ''
  const archivos = process.env.ProgramFiles ?? 'C:\\Program Files'
  const archivos86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

  const candidatos = [
    join(archivos, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(archivos86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(archivos86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(archivos, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]

  const carpetaPlaywright = join(local, 'ms-playwright')
  if (existsSync(carpetaPlaywright)) {
    const versiones = readdirSync(carpetaPlaywright)
      .filter((nombre) => /^chromium-\d+$/.test(nombre))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    for (const version of versiones) {
      candidatos.push(
        join(carpetaPlaywright, version, 'chrome-win64', 'chrome.exe'),
        join(carpetaPlaywright, version, 'chrome-win', 'chrome.exe'),
      )
    }
  }

  const encontrado = candidatos.find((ruta) => existsSync(ruta))
  if (!encontrado) {
    return salirConError(
      'No encontré Chrome, Edge ni el Chromium de Playwright. Instalá uno, o apuntá CHROME_PATH al ejecutable.',
    )
  }
  return encontrado
}

// ---------------------------------------------------------------------------
// Preparación de la página
// ---------------------------------------------------------------------------

/**
 * Contexto con tema claro, sin service workers y sin animaciones.
 *
 * El tema vive en localStorage ('leadera-tema', ver src/hooks/useTema.ts) y lo
 * lee el script inline de index.html antes de que cargue React, así que se fija
 * con un init script y no con clicks. Sin service worker no hay aviso de
 * versión nueva ni precache que confunda la espera de red.
 */
async function crearContexto(navegador, opciones, estadoDeSesion) {
  const contexto = await navegador.newContext({
    ...opciones,
    ...(estadoDeSesion ? { storageState: estadoDeSesion } : {}),
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  await contexto.addInitScript(() => {
    try {
      window.localStorage.setItem('leadera-tema', 'claro')
    } catch {
      // Sin storage, el tema queda en el del sistema, que también es claro.
    }
  })
  contexto.setDefaultTimeout(TIMEOUT_MS)
  return contexto
}

async function iniciarSesion(contexto, base, credenciales) {
  const page = await contexto.newPage()
  try {
    await page.goto(new URL('/login', base.origin).href, { waitUntil: 'domcontentloaded' })
    // Se llega a los campos por su atributo `name` (Login.tsx), porque la
    // etiqueta "Contraseña" también la lleva el botón de mostrar contraseña.
    await page.locator('input[name="email"]').fill(credenciales.email)
    await page.locator('input[name="password"]').fill(credenciales.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  } finally {
    await page.close()
  }
}

/**
 * Espera a que la pantalla esté de verdad lista: red quieta, sin skeletons ni
 * spinners, fuentes cargadas e imágenes decodificadas.
 */
async function esperarCarga(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[aria-busy="true"], .animate-pulse, [role="status"][aria-label^="Cargando"]',
      ),
  )
  // Las imágenes diferidas fuera de pantalla no cargarían nunca en una captura
  // de página completa: se piden todas.
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete))
  await page.waitForTimeout(COLCHON_MS)
}

/** La región de un elemento en coordenadas de la página completa, para recortar sin post-procesado. */
async function regionDe(locator) {
  return locator.evaluate((el) => {
    const caja = el.getBoundingClientRect()
    return {
      x: caja.x + window.scrollX,
      y: caja.y + window.scrollY,
      width: caja.width,
      height: caja.height,
    }
  })
}

// ---------------------------------------------------------------------------
// Capturas
// ---------------------------------------------------------------------------

function titulo(page, nombre) {
  return page.getByRole('heading', { level: 1, name: nombre })
}

/**
 * Cada captura: dónde ir, qué esperar y cómo sacar la imagen.
 * `esperar` confirma que el seed está aplicado (si no, falla con un mensaje claro).
 * `sacar` devuelve las opciones de `page.screenshot`, o `{ elemento }` para sacar
 * solo un elemento (recorte exacto, también de un modal).
 */
const CAPTURAS = [
  {
    archivo: 'mi-dia.png',
    ruta: '/mi-dia',
    esperar: (page) => page.getByRole('heading', { level: 1 }).waitFor(),
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'por-enfriarse.png',
    ruta: '/mi-dia',
    esperar: async (page) => {
      const tarjeta = tarjetaPorEnfriarse(page)
      await tarjeta.waitFor()
      // Por el link de la fila y no por el texto: el nombre también está dentro del
      // <dialog> de confirmación (cerrado, pero en el DOM), que getByText cuenta.
      await tarjeta.getByRole('link', { name: /Sebastián/ }).waitFor()
      await tarjeta.getByRole('link', { name: /Camila/ }).waitFor()
    },
    sacar: async (page) => ({ fullPage: true, clip: await regionDe(tarjetaPorEnfriarse(page)) }),
  },
  {
    archivo: 'leads-listado.png',
    ruta: '/leads',
    esperar: async (page) => {
      await titulo(page, 'Todos los leads').waitFor()
      await page.getByLabel('Filtrar leads por temperatura').waitFor()
    },
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'ficha-lead.png',
    ruta: `/leads/${LEAD_FICHA}`,
    esperar: (page) => titulo(page, /Martina/).waitFor(),
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'importar-excel.png',
    ruta: '/leads/importar',
    esperar: (page) => titulo(page, 'Importar leads').waitFor(),
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'coincidencias.png',
    ruta: `/coincidencias?${OFERTA_COINCIDENCIAS}`,
    esperar: async (page) => {
      await titulo(page, 'Coincidencias').waitFor()
      // Las filas de compradores, con su porcentaje ("Coincide 100%"): que la
      // captura no salga con solo el formulario mientras la búsqueda carga.
      await resultadosDeCoincidencias(page).getByText(/Coincide \d+%/).first().waitFor()
    },
    // Desde arriba hasta el final de los resultados, sin el blanco de después.
    sacar: async (page) => {
      const resultados = await regionDe(resultadosDeCoincidencias(page))
      const ancho = page.viewportSize()?.width ?? ESCRITORIO.viewport.width
      return {
        fullPage: true,
        clip: { x: 0, y: 0, width: ancho, height: Math.ceil(resultados.y + resultados.height) + MARGEN_FINAL_PX },
      }
    },
  },
  {
    archivo: 'tablero-operaciones.png',
    ruta: '/operaciones/tablero',
    esperar: async (page) => {
      await titulo(page, 'Tablero').waitFor()
      // El tablero abre en "Ofertas" (ventas y alquileres) y el lado no va en la
      // URL: la compra de Ramiro está del lado "Compradores", así que se elige con
      // el selector. Ahí hay cards en tres columnas, incluida En negociación.
      const lado = page.getByRole('group', { name: 'Lado del tablero' })
      await lado.getByRole('button', { name: 'Compradores' }).click()
      await lado.getByRole('button', { name: 'Compradores', pressed: true }).waitFor()
      // exact: el título de la operación también lleva el nombre.
      await page.getByText('Ramiro Castellano', { exact: true }).waitFor()
    },
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'tramite-operacion.png',
    ruta: `/operaciones/${OPERACION_TRAMITE}`,
    esperar: async (page) => {
      const progreso = progresoDelTramite(page)
      await progreso.waitFor()
      // Los 4 pasos hechos son lo que el seed del complemento deja cargado.
      const resueltos = await progreso.getAttribute('aria-valuenow')
      if (resueltos !== '4') {
        throw new Error(`El trámite muestra ${resueltos} pasos resueltos y se esperaban 4 (¿se aplicó el complemento?).`)
      }
    },
    // La tarjeta del checklist es el padre directo de la barra de progreso (ChecklistTramite.tsx).
    sacar: async (page) => ({
      fullPage: true,
      clip: await regionDe(progresoDelTramite(page).locator('xpath=..')),
    }),
  },
  {
    archivo: 'calendario.png',
    ruta: '/tareas',
    esperar: (page) => titulo(page, 'Calendario').waitFor(),
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'flyers.png',
    ruta: `/flyers/${PROPIEDAD_DETALLE}`,
    esperar: async (page) => {
      await titulo(page, /Crear flyer/).waitFor()
      const descargar = page.getByRole('button', { name: 'Descargar flyer' })
      await descargar.waitFor()
      // El botón queda deshabilitado mientras el editor no tiene fotos para armar el flyer.
      if (await descargar.isDisabled()) {
        const fotos = await page.locator('button[aria-pressed][aria-label^="Foto "]').count()
        const faltan = Math.max(0, FOTOS_MINIMAS_FLYER - fotos)
        throw new Error(
          faltan > 0
            ? `Almafuerte 450 tiene ${fotos} ${fotos === 1 ? 'foto' : 'fotos'} y el editor no arma el flyer: ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`} (hacen falta al menos ${FOTOS_MINIMAS_FLYER}).`
            : 'El editor no armó el flyer: el botón Descargar flyer sigue deshabilitado.',
        )
      }
      // El lienzo es el primer bloque de la columna del botón (EditorFlyer.tsx).
      await esperarImagenes(descargar.locator('xpath=../div[1]'))
    },
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'propiedad-detalle.png',
    ruta: `/propiedades/${PROPIEDAD_DETALLE}`,
    esperar: async (page) => {
      await titulo(page, /Almafuerte/).waitFor()
      // Sin fotos subidas la galería no tiene imágenes y la captura no serviría.
      await esperarImagenes(page.getByRole('region', { name: 'Fotos de la propiedad' }))
      // Los datos clave van debajo de la galería.
      await page.getByText('Metros totales').waitFor()
    },
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'estadisticas.png',
    ruta: '/estadisticas',
    esperar: (page) => titulo(page, 'Estadísticas').waitFor(),
    sacar: async () => ({ fullPage: true }),
  },
  {
    archivo: 'registrar-contacto.png',
    ruta: `/leads/${LEAD_FICHA}`,
    esperar: async (page) => {
      await titulo(page, /Martina/).waitFor()
      // El botón de la cabecera de la ficha abre el modal; solo se abre, no se guarda nada.
      await page.getByRole('button', { name: '+ Interacción', exact: true }).click()
      await dialogoInteraccion(page).waitFor()
    },
    // Solo el modal: la captura del elemento deja afuera el fondo oscurecido.
    sacar: async (page) => ({ elemento: dialogoInteraccion(page) }),
  },
  {
    archivo: 'mi-dia-mobile.png',
    ruta: '/mi-dia',
    contexto: 'movil',
    esperar: (page) => page.getByRole('heading', { level: 1 }).waitFor(),
    // Solo la ventana de 390×844, como se ve al abrir la app en el teléfono.
    sacar: async () => ({ fullPage: false }),
  },
]

/** La tarjeta "Por enfriarse" de Mi día: un <section> con ese título (SeccionCard.tsx). */
function tarjetaPorEnfriarse(page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Por enfriarse' }) })
}

/** El modal "Nueva interacción" de la ficha del lead: un <dialog> con ese nombre accesible. */
function dialogoInteraccion(page) {
  return page.getByRole('dialog', { name: 'Registrar una interacción' })
}

function progresoDelTramite(page) {
  return page.getByRole('progressbar', { name: 'Pasos del trámite resueltos' })
}

/** Los resultados de Coincidencias: las filas de compradores. */
function resultadosDeCoincidencias(page) {
  return page.getByRole('region', { name: 'Resultados' })
}

/**
 * Espera a que haya imágenes en `contenedor` y todas hayan cargado de verdad:
 * una imagen rota también está "completa", pero sin ancho propio.
 */
async function esperarImagenes(contenedor) {
  // Las diferidas fuera de pantalla no cargarían nunca: se piden todas.
  await contenedor.evaluate((nodo) => {
    for (const img of nodo.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
  })
  const nodo = await contenedor.elementHandle()
  await contenedor.page().waitForFunction((el) => {
    const imagenes = Array.from(el.querySelectorAll('img'))
    return imagenes.length > 0 && imagenes.every((img) => img.complete && img.naturalWidth > 0)
  }, nodo)
}

async function capturar(contexto, base, captura) {
  const page = await contexto.newPage()
  try {
    const destino = new URL(captura.ruta, base.origin)
    await page.goto(destino.href, { waitUntil: 'domcontentloaded' })
    await captura.esperar(page)
    await esperarCarga(page)

    const rutaActual = new URL(page.url()).pathname
    if (rutaActual !== destino.pathname) {
      throw new Error(`Terminó en ${rutaActual} y no en ${destino.pathname} (¿se cerró la sesión?).`)
    }

    const { elemento, ...opciones } = await captura.sacar(page)
    const ruta = join(SALIDA, captura.archivo)
    if (elemento) {
      await elemento.screenshot({ path: ruta, type: 'png' })
    } else {
      await page.screenshot({ ...opciones, path: ruta, type: 'png' })
    }
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

/** Ancho y alto de un PNG, de su cabecera IHDR. */
function dimensionesPng(ruta) {
  const cabecera = readFileSync(ruta).subarray(16, 24)
  return `${cabecera.readUInt32BE(0)}×${cabecera.readUInt32BE(4)}`
}

function informar(resultados) {
  console.log('\nResultado:')
  for (const { archivo, error } of resultados) {
    if (error) {
      console.log(`  FALLÓ  ${archivo}: ${error}`)
      continue
    }
    const ruta = join(SALIDA, archivo)
    const kb = Math.round(statSync(ruta).size / 1024)
    console.log(`  ok     ${archivo}  ${dimensionesPng(ruta)} px  ${kb} KB`)
  }
}

// ---------------------------------------------------------------------------

/** Los nombres pedidos por línea de comandos (sin argumentos: todas). */
function elegirCapturas() {
  const pedidas = process.argv.slice(2).map((nombre) => nombre.replace(/\.png$/i, ''))
  if (pedidas.length === 0) return CAPTURAS

  const validas = CAPTURAS.map((c) => c.archivo.replace(/\.png$/, ''))
  const desconocidas = pedidas.filter((nombre) => !validas.includes(nombre))
  if (desconocidas.length > 0) {
    return salirConError(
      `No conozco: ${desconocidas.join(', ')}. Las capturas son: ${validas.join(', ')}.`,
    )
  }
  return CAPTURAS.filter((c) => pedidas.includes(c.archivo.replace(/\.png$/, '')))
}

async function main() {
  const elegidas = elegirCapturas()
  const base = leerBase()
  const credenciales = leerCredenciales()
  const ejecutable = buscarNavegador()

  mkdirSync(SALIDA, { recursive: true })

  const navegador = await chromium.launch({ executablePath: ejecutable })
  const resultados = []

  try {
    const escritorio = await crearContexto(navegador, ESCRITORIO)
    try {
      await iniciarSesion(escritorio, base, credenciales)
    } catch (error) {
      return salirConError(`No se pudo iniciar sesión con la cuenta de pruebas: ${error.message}`)
    }

    // Misma sesión en el contexto de teléfono, sin volver a loguearse.
    const movil = await crearContexto(navegador, MOVIL, await escritorio.storageState())

    for (const captura of elegidas) {
      const contexto = captura.contexto === 'movil' ? movil : escritorio
      try {
        await capturar(contexto, base, captura)
        resultados.push({ archivo: captura.archivo })
      } catch (error) {
        resultados.push({ archivo: captura.archivo, error: error.message.split('\n')[0] })
      }
    }
  } finally {
    await navegador.close()
  }

  informar(resultados)
  if (resultados.some((r) => r.error)) process.exitCode = 1
}

await main()
