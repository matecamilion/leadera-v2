import { Campo, ErrorCampo, Input } from '../comunes/CampoFormulario'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'
import { TIPOS_PROPIEDAD, type TipoPropiedad } from '../../lib/api/propiedades'
import { MINIMO_DESDE_CERO } from '../../lib/validaciones'
import { hayCriterioPuntuable, type CriteriosBusqueda } from '../../lib/api/busquedas'

/** '' → null; '12' → 12. Descarta lo que no sea un número válido. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/** null → ''; 12 → '12'. La vuelta del anterior, para los inputs. */
function aTexto(valor: number | null): string {
  return valor == null ? '' : String(valor)
}

/** Los cuatro numéricos que la base restringe a >= 0. */
function negativo(valor: number | null): boolean {
  return valor != null && valor < 0
}

interface FormularioBusquedaProps {
  criterios: CriteriosBusqueda
  onCambiar: (criterios: CriteriosBusqueda) => void
  /**
   * Sin lead no hay búsqueda: `busquedas.lead_id` es NOT NULL. El formulario se
   * apaga entero en vez de dejar cargar algo que no se va a poder guardar.
   */
  deshabilitado?: boolean
}

/**
 * Criterios de búsqueda de una operación de COMPRA.
 *
 * Controlado por el padre —el alta y el modal de edición manejan el mismo
 * objeto— para que guardar sea cosa de ellos y este componente se ocupe sólo
 * de pintar los campos.
 *
 * Los pisos son 0 y no 1, que es lo que aceptan los CHECK de `busquedas`
 * (`banos_min`, `cocheras_min`, `m2_min`, `expensas_max`): "0 cocheras" es un
 * mínimo legítimo, quiere decir que no le importa.
 */
export function FormularioBusqueda({
  criterios,
  onCambiar,
  deshabilitado = false,
}: FormularioBusquedaProps) {
  function actualizar<C extends keyof CriteriosBusqueda>(
    clave: C,
    valor: CriteriosBusqueda[C],
  ) {
    onCambiar({ ...criterios, [clave]: valor })
  }

  const rangoInvertido =
    criterios.precio_min != null &&
    criterios.precio_max != null &&
    criterios.precio_min > criterios.precio_max

  // Sólo se avisa cuando ya cargó algo: en un formulario vacío el cartel sería
  // ruido, porque todavía no eligió nada.
  const soloFiltros =
    !hayCriterioPuntuable(criterios) &&
    (criterios.tipo_propiedad != null || Boolean(criterios.notas?.trim()))

  return (
    <fieldset
      disabled={deshabilitado}
      className="mt-2 rounded-[16px] border border-border bg-background p-5 disabled:opacity-60"
    >
      <legend className="px-1 text-[0.9rem] font-semibold text-ink">
        Qué está buscando
      </legend>
      <p className="mb-4 text-[0.82rem] text-ink-3">
        {deshabilitado
          ? 'Elegí primero un lead para poder cargar sus criterios de búsqueda.'
          : 'Todos los campos son opcionales. Con lo que cargues buscamos propiedades que coincidan.'}
      </p>

      <div className="grid grid-cols-1 gap-4 min-[651px]:grid-cols-2 min-[651px]:gap-5">
        <Campo label="Tipo de vivienda">
          <select
            value={criterios.tipo_propiedad ?? ''}
            onChange={(e) =>
              actualizar('tipo_propiedad', (e.target.value || null) as TipoPropiedad | null)
            }
            className={CLASES_CONTROL}
          >
            <option value="">Cualquier tipo</option>
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Zona">
          <Input
            value={criterios.zona ?? ''}
            onChange={(v) => actualizar('zona', v || null)}
            placeholder="Ej: Playa Grande"
          />
        </Campo>

        <Campo label="Precio mínimo (USD)">
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.precio_min)}
            onChange={(v) => actualizar('precio_min', aNumero(v))}
            placeholder="80000"
            invalido={negativo(criterios.precio_min) || rangoInvertido}
          />
        </Campo>

        <Campo label="Precio máximo (USD)">
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.precio_max)}
            onChange={(v) => actualizar('precio_max', aNumero(v))}
            placeholder="120000"
            invalido={negativo(criterios.precio_max) || rangoInvertido}
          />
          {rangoInvertido && (
            <ErrorCampo>El precio mínimo no puede ser mayor que el máximo.</ErrorCampo>
          )}
        </Campo>

        <Campo label="Ambientes (mínimo)">
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.ambientes_min)}
            onChange={(v) => actualizar('ambientes_min', aNumero(v))}
            placeholder="2"
            invalido={negativo(criterios.ambientes_min)}
          />
        </Campo>

        <Campo label="Metros totales (mínimo)">
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.m2_min)}
            onChange={(v) => actualizar('m2_min', aNumero(v))}
            placeholder="60"
            invalido={negativo(criterios.m2_min)}
          />
        </Campo>

        <Campo label="Baños (mínimo)">
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.banos_min)}
            onChange={(v) => actualizar('banos_min', aNumero(v))}
            placeholder="1"
            invalido={negativo(criterios.banos_min)}
          />
        </Campo>

        <Campo label="Cocheras (mínimo)">
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.cocheras_min)}
            onChange={(v) => actualizar('cocheras_min', aNumero(v))}
            placeholder="1"
            invalido={negativo(criterios.cocheras_min)}
          />
        </Campo>

        <Campo
          label="Expensas máximo"
          ayuda="Sólo puntúa en propiedades que tengan expensas cargadas."
        >
          <Input
            type="number"
            min={MINIMO_DESDE_CERO}
            value={aTexto(criterios.expensas_max)}
            onChange={(v) => actualizar('expensas_max', aNumero(v))}
            placeholder="45000"
            invalido={negativo(criterios.expensas_max)}
          />
        </Campo>

        <Campo label="Observaciones" full>
          <textarea
            value={criterios.notas ?? ''}
            onChange={(e) => actualizar('notas', e.target.value || null)}
            rows={3}
            maxLength={500}
            placeholder="Ej: prefiere piso alto, necesita mudarse antes de marzo."
            className={`${CLASES_CONTROL} min-h-20 resize-y leading-normal`}
          />
        </Campo>
      </div>

      {/* El tipo filtra el universo de propiedades pero no suma al puntaje, y
          las observaciones son para leer. Con sólo eso el RPC no devuelve
          nada, así que conviene decirlo antes de guardar y no después. */}
      {soloFiltros && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.82rem] text-ink-2">
          Con el tipo de vivienda y las observaciones solas no se puede puntuar
          nada. Agregá al menos un criterio más —zona, precio, ambientes, metros,
          baños, cocheras o expensas— para que aparezcan coincidencias.
        </p>
      )}
    </fieldset>
  )
}
