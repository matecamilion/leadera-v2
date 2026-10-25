/**
 * Script de una sola vez. No es parte del build. Regenera public/email/anillos/.
 * Uso: deno run --node-modules-dir=none --allow-read --allow-write --allow-env --allow-ffi --allow-net --allow-sys scripts/generar-anillos-email.ts
 *
 * Los clientes de mail no renderizan SVG, así que los anillos de "Tu gestión"
 * son PNG: 21 pasos, de 0% a 100% de a 5%. Sin número adentro; el número va en
 * texto debajo. Se rasterizan a 176x176 y el mail los muestra a 88x88 (retina).
 */
import { Resvg } from 'npm:@resvg/resvg-js'

const PISTA = '#d3e8df'
const PROGRESO = '#0f6e56'
const GROSOR = 8
const RADIO = 40
const CIRCUNFERENCIA = 2 * Math.PI * RADIO
const LADO_PX = 176

const carpeta = new URL('../public/email/anillos/', import.meta.url)

function svgAnillo(porcentaje: number): string {
  const pista =
    `<circle cx="44" cy="44" r="${RADIO}" fill="none" stroke="${PISTA}" stroke-width="${GROSOR}"/>`

  // Con 0% el cap redondo dejaría un punto: solo la pista.
  let progreso = ''
  if (porcentaje >= 100) {
    progreso =
      `<circle cx="44" cy="44" r="${RADIO}" fill="none" stroke="${PROGRESO}" stroke-width="${GROSOR}"/>`
  } else if (porcentaje > 0) {
    const largo = (CIRCUNFERENCIA * porcentaje) / 100
    progreso =
      `<circle cx="44" cy="44" r="${RADIO}" fill="none" stroke="${PROGRESO}" stroke-width="${GROSOR}" ` +
      `stroke-linecap="round" stroke-dasharray="${largo.toFixed(3)} ${CIRCUNFERENCIA.toFixed(3)}" ` +
      `transform="rotate(-90 44 44)"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="88" height="88">${pista}${progreso}</svg>`
}

await Deno.mkdir(carpeta, { recursive: true })

for (let porcentaje = 0; porcentaje <= 100; porcentaje += 5) {
  const png = new Resvg(svgAnillo(porcentaje), { fitTo: { mode: 'width', value: LADO_PX } })
    .render()
    .asPng()
  const nombre = `anillo-${String(porcentaje).padStart(3, '0')}.png`
  await Deno.writeFile(new URL(nombre, carpeta), png)
  console.log(nombre, png.length)
}
