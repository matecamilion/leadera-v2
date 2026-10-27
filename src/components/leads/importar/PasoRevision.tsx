import { useRef, useState } from 'react'
import { EnlaceAPlanes } from '../../comunes/EnlaceAPlanes'
import { entradaSegunCupo } from './cupoImportacion'
import { ListaDetalle } from './ListaDetalle'
import type { FilaDetalle } from './resumenResultado'
import type { Revision } from './revisar'
import { TarjetaConteo } from './TarjetaConteo'

interface PasoRevisionProps {
  revision: Revision
  onVolver: () => void
  onImportar: () => void
}

const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

const BOTON_PRIMARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/** Paso 3: qué se va a importar y qué no, antes de tocar la base. */
export function PasoRevision({ revision, onVolver, onImportar }: PasoRevisionProps) {
  const { clasificacion: c, cupo } = revision
  const { conteos } = c

  const entrada = entradaSegunCupo(c.aImportar.length, cupo)
  const sinLugar = entrada.entran === 0

  // Un solo disparo: el padre cambia de paso, pero entre el clic y ese render
  // llega un segundo toque. El ref lo frena en el mismo tick.
  const confirmadoRef = useRef(false)
  const [confirmado, setConfirmado] = useState(false)

  function importar() {
    if (confirmadoRef.current || sinLugar) return
    confirmadoRef.current = true
    setConfirmado(true)
    onImportar()
  }

  const duplicadasEnCuenta = conteos.duplicadasEnBasePorTelefono + conteos.duplicadasEnBasePorEmail

  // Calidad de lo que sí se importa.
  const sinForma = c.aImportar.filter((f) => f.email === null && (f.telefono === null || f.telefonoDudoso)).length
  const dudosos = c.aImportar.filter((f) => f.telefonoDudoso).length

  const detalle = {
    enArchivo: c.duplicadasEnArchivo.map<FilaDetalle>((f) => ({
      fila: f.fila,
      nombre: f.nombre,
      motivo: `Repite ${f.duplicadoEnArchivo?.por === 'EMAIL' ? 'el email' : 'el teléfono'} de la fila ${f.duplicadoEnArchivo?.duplicaA}.`,
    })),
    enCuenta: [
      ...c.duplicadasEnBase.porTelefono.map<FilaDetalle>((f) => ({
        fila: f.fila,
        nombre: f.nombre,
        motivo: 'Ya existe un lead con este teléfono en tu cuenta.',
      })),
      ...c.duplicadasEnBase.porEmail.map<FilaDetalle>((f) => ({
        fila: f.fila,
        nombre: f.nombre,
        motivo: 'Ya existe un lead con este email en tu cuenta.',
      })),
    ].sort((a, b) => a.fila - b.fila),
    errores: c.conError.map<FilaDetalle>((f) => ({ fila: f.fila, nombre: f.nombre, motivo: f.errores.join(' ') })),
    avisos: c.aImportar
      .filter((f) => f.avisos.length > 0)
      .map<FilaDetalle>((f) => ({ fila: f.fila, nombre: f.nombre, motivo: f.avisos.join(' ') })),
  }

  return (
    <section aria-label="Revisar antes de importar" className="min-w-0">
      <div className="@container rounded-[16px] border border-border bg-surface p-5">
        <h2 className="m-0 text-[1.05rem] font-bold text-ink">Revisá antes de importar</h2>
        <p className="mt-1 mb-0 text-[0.85rem] text-ink-3">
          De {conteos.total.toLocaleString('es-AR')} {plural(conteos.total, 'fila', 'filas')} del archivo, esto es lo
          que va a pasar.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 @[28rem]:grid-cols-2 @[48rem]:grid-cols-4">
          <TarjetaConteo
            valor={entrada.entran}
            titulo="Se importan"
            tono="brand"
            subtexto={entrada.quedanAfuera > 0 ? `${entrada.quedanAfuera} quedan afuera por el plan` : undefined}
          />
          <TarjetaConteo valor={conteos.duplicadasEnArchivo} titulo="Repetidos dentro del archivo" />
          <TarjetaConteo
            valor={duplicadasEnCuenta}
            titulo="Ya están en tu cuenta"
            subtexto={`por teléfono ${conteos.duplicadasEnBasePorTelefono} · por email ${conteos.duplicadasEnBasePorEmail}`}
          />
          <TarjetaConteo valor={conteos.conError} titulo="Con errores" tono="error" />
        </div>

        {entrada.quedanAfuera > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-tibio/40 bg-warm-soft px-4 py-3 text-[0.9rem] text-badge-tibio-ink"
          >
            <p className="m-0">
              {entrada.agotado
                ? 'Tu plan ya no tiene lugar para más leads, así que no se puede importar nada.'
                : `Tu plan permite cargar ${entrada.lugares} ${plural(entrada.lugares ?? 0, 'lead más', 'leads más')}. Van a entrar los primeros ${entrada.entran} y los otros ${entrada.quedanAfuera} quedan afuera.`}
            </p>
            <EnlaceAPlanes />
          </div>
        )}

        {(sinForma > 0 || dudosos > 0) && (
          <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[0.85rem] text-badge-tibio-ink">
            {sinForma > 0 && (
              <li>
                {sinForma} {plural(sinForma, 'fila no tiene', 'filas no tienen')} teléfono ni email válidos: no se
                pueden detectar duplicados. Si volvés a subir este archivo, esas filas se duplican.
              </li>
            )}
            {dudosos > 0 && (
              <li>
                {dudosos} {plural(dudosos, 'teléfono no parece', 'teléfonos no parecen')} un celular argentino válido.
                Se {plural(dudosos, 'importa', 'importan')} igual.
              </li>
            )}
          </ul>
        )}
      </div>

      {(detalle.enArchivo.length > 0 ||
        detalle.enCuenta.length > 0 ||
        detalle.errores.length > 0 ||
        detalle.avisos.length > 0) && (
        <div className="mt-4 space-y-2">
          <ListaDetalle titulo="Repetidos dentro del archivo" filas={detalle.enArchivo} />
          <ListaDetalle titulo="Ya están en tu cuenta" filas={detalle.enCuenta} />
          <ListaDetalle titulo="Con errores (no se importan)" filas={detalle.errores} tono="error" />
          <ListaDetalle titulo="Se importan, pero con avisos" filas={detalle.avisos} tono="aviso" />
        </div>
      )}

      <div className="@container mt-5">
        <div className="flex flex-col-reverse gap-3 @[28rem]:flex-row @[28rem]:justify-between">
          <button type="button" onClick={onVolver} disabled={confirmado} className={BOTON_SECUNDARIO}>
            Volver
          </button>
          <button type="button" onClick={importar} disabled={sinLugar || confirmado} className={BOTON_PRIMARIO}>
            {sinLugar ? 'No hay leads para importar' : `Importar ${entrada.entran} ${plural(entrada.entran, 'lead', 'leads')}`}
          </button>
        </div>
      </div>
    </section>
  )
}
