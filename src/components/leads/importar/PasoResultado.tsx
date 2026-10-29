import { useState } from 'react'
import { EnlaceAPlanes } from '../../comunes/EnlaceAPlanes'
import type { ResultadoDeImportacion } from '../../../lib/api/importarLeads'
import type { ResultadoDeReversion } from '../../../lib/api/revertirImportacion'
import { DeshacerImportacion } from './DeshacerImportacion'
import { ListaDetalle } from './ListaDetalle'
import { leadsConFusiones } from './fusiones'
import { resumirResultado } from './resumenResultado'
import type { Revision } from './revisar'
import { TarjetaConteo } from './TarjetaConteo'

interface PasoResultadoProps {
  revision: Revision
  importando: boolean
  progreso: { procesadas: number; total: number } | null
  resultado: ResultadoDeImportacion | null
  onVerLeads: () => void
  onOtroArchivo: () => void
}

const BOTON_SECUNDARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

const BOTON_PRIMARIO =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/**
 * Paso 4: la importación en curso y, al terminar, el resumen.
 *
 * No hay botón para volver: reimportar lo mismo duplicaría los leads. Sí se puede
 * deshacer la importación desde acá (ver `DeshacerImportacion`); al hacerlo, la
 * pantalla pasa a mostrar qué se eliminó y qué se conservó.
 */
export function PasoResultado({ revision, importando, progreso, resultado, onVerLeads, onOtroArchivo }: PasoResultadoProps) {
  // Antes de cualquier return: los hooks no pueden ir después de uno.
  const [deshecha, setDeshecha] = useState<ResultadoDeReversion | null>(null)

  if (importando || !resultado) {
    const procesadas = progreso?.procesadas ?? 0
    const total = progreso?.total ?? 0
    const proporcion = total === 0 ? 0 : Math.min(procesadas / total, 1)

    return (
      <section aria-label="Importando" className="min-w-0 rounded-[16px] border border-border bg-surface p-5">
        <h2 className="m-0 text-[1.05rem] font-bold text-ink">Importando tus leads</h2>
        <p role="status" aria-live="polite" className="mt-2 mb-3 text-[0.9rem] text-ink-2 tabular-nums">
          Importando… {procesadas.toLocaleString('es-AR')} de {total.toLocaleString('es-AR')}
        </p>
        <div
          role="progressbar"
          aria-label="Avance de la importación"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={procesadas}
          className="h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${proporcion * 100}%` }}
          />
        </div>
        <p className="mt-3 mb-0 text-xs text-ink-3">No cierres esta pestaña hasta que termine.</p>
      </section>
    )
  }

  const r = resumirResultado(revision, resultado)
  const { corte } = resultado
  const leadsConVarias = leadsConFusiones(revision.filas).length

  // Ya se deshizo: los números de arriba (importados, etc.) dejaron de ser ciertos.
  if (deshecha) {
    const { borrados, protegidos } = deshecha
    return (
      <section aria-label="Importación deshecha" className="min-w-0">
        <div className="rounded-[16px] border border-border bg-surface p-5">
          <h2 className="m-0 text-[1.05rem] font-bold text-ink">Se deshizo la importación</h2>
          <p role="status" className="mt-1.5 mb-0 text-[0.9rem] text-ink-2">
            {plural(borrados, 'Se eliminó', 'Se eliminaron')} {borrados.toLocaleString('es-AR')}{' '}
            {plural(borrados, 'lead', 'leads')}.
            {protegidos > 0 && (
              <>
                {' '}
                {protegidos.toLocaleString('es-AR')} {plural(protegidos, 'se conservó', 'se conservaron')} porque ya{' '}
                {plural(protegidos, 'tenía', 'tenían')} actividad.
              </>
            )}
          </p>
        </div>

        <div className="@container mt-5">
          <div className="flex flex-col-reverse gap-3 @[28rem]:flex-row @[28rem]:justify-between">
            <button type="button" onClick={onOtroArchivo} className={BOTON_SECUNDARIO}>
              Volver a importar
            </button>
            <button type="button" onClick={onVerLeads} className={BOTON_PRIMARIO}>
              Ir a leads
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Resultado de la importación" className="min-w-0">
      <div className="@container rounded-[16px] border border-border bg-surface p-5">
        <h2 className="m-0 text-[1.05rem] font-bold text-ink">
          {r.importados > 0
            ? r.importados === 1
              ? 'Se importó 1 lead'
              : `Se importaron ${r.importados.toLocaleString('es-AR')} leads`
            : corte
              ? 'La importación se interrumpió'
              : 'No se importó ningún lead'}
        </h2>

        {r.motivoPrincipal && <p className="mt-1.5 mb-0 text-[0.9rem] text-ink-3">{r.motivoPrincipal}</p>}

        <div
          className={`mt-4 grid grid-cols-1 gap-3 @[28rem]:grid-cols-2 ${r.consultasFusionadas > 0 ? '@[48rem]:grid-cols-5' : '@[48rem]:grid-cols-4'}`}
        >
          <TarjetaConteo valor={r.importados} titulo="Importados" tono="brand" />
          {r.consultasFusionadas > 0 && (
            <TarjetaConteo
              valor={r.consultasFusionadas}
              titulo="Consultas fusionadas"
              subtexto={`en ${leadsConVarias} ${plural(leadsConVarias, 'lead', 'leads')}`}
            />
          )}
          <TarjetaConteo valor={r.omitidosPorDuplicado} titulo="Omitidos por duplicado" />
          <TarjetaConteo valor={r.conError} titulo="Con error" tono="error" />
          <TarjetaConteo valor={r.fueraPorLimite} titulo="Fuera por el límite del plan" tono="aviso" />
        </div>

        {r.fueraPorLimite > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-tibio/40 bg-warm-soft px-4 py-3 text-[0.9rem] text-badge-tibio-ink"
          >
            <p className="m-0">
              {r.fueraPorLimite} {plural(r.fueraPorLimite, 'lead quedó', 'leads quedaron')} afuera porque tu plan llegó
              a su límite.
            </p>
            <EnlaceAPlanes />
          </div>
        )}

        {corte && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-tibio/40 bg-warm-soft px-4 py-3 text-[0.9rem] text-badge-tibio-ink"
          >
            <p className="m-0 font-semibold">
              Se interrumpió la importación. Las filas del último lote pueden haber entrado.
            </p>
            <p className="mt-1 mb-0">
              Para continuar, volvé a subir el mismo archivo: los leads que ya entraron se detectan como repetidos y se
              omiten.
            </p>
            <p className="mt-1 mb-0">{corte.mensaje}</p>
            <p className="mt-1 mb-0">
              {r.sinProcesar.toLocaleString('es-AR')} {plural(r.sinProcesar, 'fila', 'filas')} sin procesar.
            </p>
          </div>
        )}

        {resultado.importacionId && (
          <DeshacerImportacion
            importacionId={resultado.importacionId}
            importados={r.importados}
            onDeshecha={setDeshecha}
          />
        )}
      </div>

      {r.detalleDeErrores.length > 0 && (
        <div className="mt-4">
          <ListaDetalle titulo="Filas con error" filas={r.detalleDeErrores} tono="error" />
        </div>
      )}

      <div className="@container mt-5">
        <div className="flex flex-col-reverse gap-3 @[28rem]:flex-row @[28rem]:justify-between">
          <button type="button" onClick={onOtroArchivo} className={BOTON_SECUNDARIO}>
            Importar otro archivo
          </button>
          <button type="button" onClick={onVerLeads} className={BOTON_PRIMARIO}>
            Ver mis leads
          </button>
        </div>
      </div>
    </section>
  )
}
