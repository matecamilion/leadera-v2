// Genera el PDF del manual a partir de manual.html.
//
//   node generar-pdf.mjs
//
// Usa el Chrome, Edge o Chromium que ya hay en la máquina: no descarga ningún
// navegador. Variable opcional: CHROME_PATH (ruta de un ejecutable de Chrome).
// No necesita credenciales: el HTML y las capturas son archivos locales.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

// Las capturas se reducen antes de entrar al PDF: a 2880 px pesan de más para lo
// que una hoja A4 muestra. Las que ya son más angostas se copian tal cual.
const ANCHO_MAXIMO_PX = 1600
const CALIDAD_JPEG = 0.88

const AQUI = dirname(fileURLToPath(import.meta.url))
const HTML = join(AQUI, 'manual.html')
const CAPTURAS = join(AQUI, 'capturas')
const SALIDA = join(AQUI, 'out')
const COPIAS = join(SALIDA, 'capturas')
// Copia de manual.html que apunta a las capturas reducidas (el original queda intacto).
const HTML_SALIDA = join(SALIDA, 'manual.html')
const PDF = join(SALIDA, 'manual-leadera.pdf')

const TIMEOUT_MS = 30_000

function salirConError(mensaje) {
  console.error(`Error: ${mensaje}`)
  process.exit(1)
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

/** Las imágenes que no cargaron, para fallar diciendo cuáles. */
function imagenesRotas(page) {
  return page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => !(img.complete && img.naturalWidth > 0))
      .map((img) => img.getAttribute('src')),
  )
}

/**
 * Reduce las capturas en el navegador (canvas) y devuelve cuál es la copia de
 * cada una. Las que superan `ANCHO_MAXIMO_PX` se achican; las demás se copian
 * sin cambios. Un JPEG no tiene transparencia, así que si una captura la usa
 * (por ejemplo, esquinas redondeadas) se reduce en PNG para no romper el recorte.
 */
async function prepararCopias(navegador) {
  rmSync(COPIAS, { recursive: true, force: true })
  mkdirSync(COPIAS, { recursive: true })

  const copias = new Map()
  const page = await navegador.newPage()
  try {
    for (const nombre of readdirSync(CAPTURAS).filter((archivo) => archivo.endsWith('.png'))) {
      const original = join(CAPTURAS, nombre)
      const reducida = await page.evaluate(
        async ({ base64, ancho, calidad }) => {
          const respuesta = await fetch(`data:image/png;base64,${base64}`)
          const bitmap = await createImageBitmap(await respuesta.blob())
          if (bitmap.width <= ancho) return null

          const alto = Math.round((bitmap.height * ancho) / bitmap.width)
          const lienzo = document.createElement('canvas')
          lienzo.width = ancho
          lienzo.height = alto
          const ctx = lienzo.getContext('2d')
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(bitmap, 0, 0, ancho, alto)
          bitmap.close()

          const pixeles = ctx.getImageData(0, 0, ancho, alto).data
          let conTransparencia = false
          for (let i = 3; i < pixeles.length; i += 4) {
            if (pixeles[i] < 255) {
              conTransparencia = true
              break
            }
          }
          return conTransparencia
            ? { extension: 'png', datos: lienzo.toDataURL('image/png') }
            : { extension: 'jpg', datos: lienzo.toDataURL('image/jpeg', calidad) }
        },
        { base64: readFileSync(original).toString('base64'), ancho: ANCHO_MAXIMO_PX, calidad: CALIDAD_JPEG },
      )

      if (!reducida) {
        copyFileSync(original, join(COPIAS, nombre))
        copias.set(nombre, nombre)
        continue
      }
      const nombreCopia = nombre.replace(/\.png$/, `.${reducida.extension}`)
      writeFileSync(join(COPIAS, nombreCopia), Buffer.from(reducida.datos.split(',')[1], 'base64'))
      copias.set(nombre, nombreCopia)
    }
  } finally {
    await page.close()
  }
  return copias
}

/** Una copia de manual.html que apunta a las capturas reducidas y al CSS de la carpeta de arriba. */
function escribirHtmlDeSalida(copias) {
  const html = readFileSync(HTML, 'utf-8')
    .replace('href="manual.css"', 'href="../manual.css"')
    .replace(/capturas\/([\w-]+\.png)/g, (_, nombre) => {
      const copia = copias.get(nombre)
      if (!copia) return salirConError(`manual.html usa capturas/${nombre}, que no existe.`)
      return `capturas/${copia}`
    })
  writeFileSync(HTML_SALIDA, html)
}

async function main() {
  if (!existsSync(HTML)) return salirConError('No encuentro manual.html junto a este script.')

  const navegador = await chromium.launch({ executablePath: buscarNavegador() })
  try {
    mkdirSync(SALIDA, { recursive: true })
    escribirHtmlDeSalida(await prepararCopias(navegador))

    const page = await navegador.newPage()
    page.setDefaultTimeout(TIMEOUT_MS)

    await page.goto(pathToFileURL(HTML_SALIDA).href, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete))

    const rotas = await imagenesRotas(page)
    if (rotas.length > 0) {
      return salirConError(`No cargaron estas imágenes: ${rotas.join(', ')}`)
    }

    // Los márgenes los define el CSS (@page), por eso van en 0 y se respeta su tamaño.
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
      tagged: true,
      outline: true,
    })

    writeFileSync(PDF, pdf)
  } finally {
    await navegador.close()
  }

  // Cada página es un objeto "/Type /Page" (el plural "/Pages" es el árbol, no cuenta).
  const paginas = (readFileSync(PDF).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  const mb = (statSync(PDF).size / (1024 * 1024)).toFixed(2)
  console.log(`PDF: ${PDF}`)
  console.log(`Páginas: ${paginas}`)
  console.log(`Tamaño: ${mb} MB`)
}

await main()
