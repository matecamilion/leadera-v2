import { useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRevertirImportacion } from '../../../hooks/useRevertirImportacion'
import type { ResultadoDeReversion, SimulacionDeReversion } from '../../../lib/api/revertirImportacion'
import { ModalConfirmarEliminar } from '../../comunes/ModalConfirmarEliminar'

interface DeshacerImportacionProps {
  /** El id con el que quedaron marcados los leads de esta importación. */
  importacionId: string
  /** Cuántos leads entraron. Sin ninguno no hay nada que deshacer. */
  importados: number
  /** Se llama cuando la importación ya se deshizo. */
  onDeshecha: (resultado: ResultadoDeReversion) => void
}

const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/**
 * "Deshacer importación": el botón y su diálogo de confirmación.
 *
 * Solo para quien puede (DUENO o AGENTE: el ASISTENTE no) y mientras hay algo
 * que deshacer. Antes de borrar se simula, y el diálogo muestra los números
 * reales: cuántos leads se eliminan y cuántos se conservan por tener actividad.
 * Lo que decide si se puede (permiso, ventana de 7 días) lo dice la base; acá
 * solo se muestra su motivo.
 */
export function DeshacerImportacion({ importacionId, importados, onDeshecha }: DeshacerImportacionProps) {
  const { profile } = useAuth()
  const { simular, confirmar } = useRevertirImportacion()

  const [abierto, setAbierto] = useState(false)
  const [simulacion, setSimulacion] = useState<SimulacionDeReversion | null>(null)
  const [errorSimulacion, setErrorSimulacion] = useState<string | null>(null)
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null)

  // La respuesta de una simulación que llega con el diálogo ya cerrado (o
  // reabierto) no debe pisar nada: cada apertura tiene su número de pedido.
  const pedidoRef = useRef(0)
  // Un solo disparo: entre el clic y el siguiente render llega un segundo toque.
  const confirmandoRef = useRef(false)

  const rol = profile?.rol
  if (importados <= 0 || (rol !== 'DUENO' && rol !== 'AGENTE')) return null

  const eliminando = confirmar.isPending

  function abrir() {
    pedidoRef.current += 1
    const pedido = pedidoRef.current
    setSimulacion(null)
    setErrorSimulacion(null)
    setErrorConfirmacion(null)
    setAbierto(true)

    simular.mutate(importacionId, {
      onSuccess: (resultado) => {
        if (pedido === pedidoRef.current) setSimulacion(resultado)
      },
      onError: (e) => {
        if (pedido === pedidoRef.current) setErrorSimulacion(e.message)
      },
    })
  }

  function cerrar() {
    if (confirmandoRef.current) return
    pedidoRef.current += 1
    setAbierto(false)
  }

  function eliminar() {
    if (confirmandoRef.current) return
    confirmandoRef.current = true
    setErrorConfirmacion(null)

    confirmar.mutate(importacionId, {
      onSuccess: (resultado) => {
        setAbierto(false)
        onDeshecha(resultado)
      },
      onError: (e) => setErrorConfirmacion(e.message),
      onSettled: () => {
        confirmandoRef.current = false
      },
    })
  }

  const revisando = abierto && simulacion === null && errorSimulacion === null
  const puedeEliminar = simulacion !== null && simulacion.puede && simulacion.borrables > 0
  const sinNada = simulacion !== null && simulacion.puede && simulacion.borrables === 0
  const noSePuede = simulacion !== null && !simulacion.puede

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 @[40rem]:flex-row @[40rem]:items-center @[40rem]:justify-between">
        <p className="m-0 text-[0.85rem] text-ink-3">
          Podés deshacer esta importación desde acá. Los leads que ya tengan actividad no se eliminan.
        </p>
        <button type="button" onClick={abrir} className={BOTON_SECUNDARIO}>
          Deshacer importación
        </button>
      </div>

      <ModalConfirmarEliminar
        abierto={abierto}
        titulo={puedeEliminar ? '¿Deshacer esta importación?' : 'Deshacer importación'}
        eliminando={eliminando}
        error={errorConfirmacion ?? errorSimulacion}
        onCancelar={cerrar}
        onConfirmar={eliminar}
        puedeConfirmar={puedeEliminar}
        textoConfirmar={simulacion ? `Eliminar ${simulacion.borrables} ${plural(simulacion.borrables, 'lead', 'leads')}` : 'Eliminar'}
        textoConfirmando="Eliminando…"
        textoCancelar={puedeEliminar ? 'Cancelar' : 'Cerrar'}
      >
        {/* Región viva: el cambio de "Revisando…" a los números se anuncia. */}
        <div aria-live="polite" className="mt-2 space-y-2 text-[0.9rem] leading-relaxed text-ink-3">
          {revisando && <p className="m-0">Revisando qué se puede eliminar…</p>}

          {noSePuede && (
            <p className="m-0">{simulacion.motivo ?? 'No se puede deshacer esta importación.'}</p>
          )}

          {sinNada && (
            <p className="m-0">
              No hay nada para eliminar: todos los leads de esta importación ya tienen actividad (interacciones,
              tareas, operaciones, etc.) y se conservan.
            </p>
          )}

          {puedeEliminar && (
            <>
              <p className="m-0 font-semibold text-ink">
                Se van a eliminar {simulacion.borrables} {plural(simulacion.borrables, 'lead', 'leads')} de esta
                importación.
              </p>
              {simulacion.protegidos > 0 && (
                <p className="m-0">
                  Y se {plural(simulacion.protegidos, 'conserva', 'conservan')} {simulacion.protegidos} porque ya{' '}
                  {plural(simulacion.protegidos, 'tiene', 'tienen')} actividad (interacciones, tareas, operaciones,
                  etc.).
                </p>
              )}
              <p className="m-0">
                Solo se eliminan los leads de esta importación; los que ya existían en tu cuenta no se tocan. Esta
                acción es permanente.
              </p>
            </>
          )}
        </div>
      </ModalConfirmarEliminar>
    </>
  )
}
