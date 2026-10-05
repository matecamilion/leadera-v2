import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { obtenerLink, type ResultadoGet } from '../components/consulta-publica/api'
import {
  formatearPrecio,
  OPCIONES_BUSCO,
  OPCIONES_GARANTIA,
  OPCIONES_OPERACION,
  OPCIONES_PAGO,
  OPCIONES_PLAZO,
  OPCIONES_PLAZO_PROPIETARIO,
  OPCIONES_PUBLICADA,
  OPCIONES_TENGO,
  OPCIONES_PRESUPUESTO_PROPIEDAD,
  OPCIONES_SI_NO,
  OPCIONES_SI_NO_VISITA,
  OPCIONES_TIPO,
} from '../components/consulta-publica/catalogo'
import { FichaPropiedad } from '../components/consulta-publica/FichaPropiedad'
import { Encabezado, Marco, Progreso, Tarjeta } from '../components/consulta-publica/Marco'
import {
  Cargando,
  Enviando,
  ErrorConReintento,
  ErrorInvalido,
  Gracias,
  NoDisponible,
} from '../components/consulta-publica/Pantallas'
import { PasoContacto } from '../components/consulta-publica/PasoContacto'
import { esPropietario } from '../../supabase/functions/consulta-publica/encuesta.ts'
import { CampoMonto, CampoZona, ListaOpciones, Pregunta, SelectorMoneda } from '../components/consulta-publica/Pregunta'
import {
  armarPasos,
  armarPayload,
  conMonto,
  conOperacion,
  conPresupuesto,
  monedaDeRango,
  operacionDe,
  operacionDisponible,
  rangosParaPaso,
  sinPresupuesto,
  type IdPaso,
} from '../components/consulta-publica/pasos'
import type {
  DatosContacto,
  DatosLink,
  Operacion,
  PropiedadDisponible,
  Respuestas,
} from '../components/consulta-publica/tipos'
import { useEnvio } from '../components/consulta-publica/useEnvio'

/**
 * Página pública del link de consultas (`/c/:slug`).
 *
 * Sin sesión y sin nada del CRM: no pasa por ProtectedRoute ni por
 * SuscripcionGuard, y no usa React Query (su reintento automático chocaría con
 * la lógica del token y de los 8 s).
 */

type Fase =
  | 'cargando'
  | 'no_disponible'
  | 'error_carga'
  | 'inicio'
  | 'preguntas'
  | 'enviando'
  | 'gracias'
  | 'error_envio'
  | 'invalido'

const CONTACTO_VACIO: DatosContacto = { nombre: '', apellido: '', telefono: '', email: '' }

// ---------------------------------------------------------------------------
// sessionStorage: una recarga accidental no borra lo contestado. Todo en
// try/catch: en modo privado o con el almacenamiento bloqueado, la página
// anda igual, solo que sin recordar.
// ---------------------------------------------------------------------------

interface Guardado {
  flujo: DatosLink['flujo']
  operacion_fija: DatosLink['operacion_fija']
  respuestas: Respuestas
  contacto: DatosContacto
  indice: number
}

const claveGuardado = (slug: string) => `leadera:consulta:${slug}`

function leerGuardado(slug: string, datos: DatosLink): Guardado | null {
  try {
    const crudo = sessionStorage.getItem(claveGuardado(slug))
    if (!crudo) return null
    const g = JSON.parse(crudo) as Guardado
    // Si el link cambió de forma (la propiedad dejó de estar disponible, se
    // fijó otra operación), lo guardado ya no encaja: se empieza de nuevo.
    if (g.flujo !== datos.flujo || g.operacion_fija !== datos.operacion_fija) return null
    return g
  } catch {
    return null
  }
}

function escribirGuardado(slug: string, g: Guardado) {
  try {
    sessionStorage.setItem(claveGuardado(slug), JSON.stringify(g))
  } catch {
    // Sin almacenamiento: no se recuerda, y listo.
  }
}

function borrarGuardado(slug: string) {
  try {
    sessionStorage.removeItem(claveGuardado(slug))
  } catch {
    // idem
  }
}

function propiedadDisponible(datos: DatosLink): PropiedadDisponible | null {
  return datos.propiedad && datos.propiedad.disponible ? datos.propiedad : null
}

/** Título de la pestaña y `noindex` mientras la página está montada. */
function useMetadatos(titulo: string) {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])
}

export default function ConsultaPublica() {
  const { slug = '' } = useParams()

  const [fase, setFase] = useState<Fase>('cargando')
  const [datos, setDatos] = useState<DatosLink | null>(null)
  const [indice, setIndice] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuestas>({})
  const [contacto, setContacto] = useState<DatosContacto>(CONTACTO_VACIO)
  const [mensajeInvalido, setMensajeInvalido] = useState('')
  // Moneda elegida para los rangos de alquiler. Si ya hay un rango elegido,
  // manda la moneda de ese rango (por ejemplo, al volver con Atrás).
  const [monedaAlquiler, setMonedaAlquiler] = useState<'ARS' | 'USD'>('ARS')

  // El armado del payload necesita los datos más recientes aunque un token
  // renovado los cambie a mitad del envío.
  const datosRef = useRef<DatosLink | null>(null)
  useEffect(() => {
    datosRef.current = datos
  }, [datos])
  const hpRef = useRef('')

  const alRenovar = useCallback((nuevos: DatosLink) => setDatos(nuevos), [])
  const { fijarToken, enviar } = useEnvio(slug, alRenovar)

  // --- Carga --------------------------------------------------------------
  const aplicarCarga = useCallback((r: ResultadoGet) => {
    if (r.tipo === 'no_disponible') return setFase('no_disponible')
    if (r.tipo === 'error') return setFase('error_carga')

    setDatos(r.datos)
    fijarToken(r.datos.token, r.recibidoEn)

    const guardado = leerGuardado(slug, r.datos)
    if (guardado) {
      setRespuestas(guardado.respuestas)
      setContacto(guardado.contacto)
      setIndice(guardado.indice)
      setFase('preguntas')
      return
    }
    setRespuestas({})
    setContacto(CONTACTO_VACIO)
    setIndice(0)
    setFase(propiedadDisponible(r.datos) ? 'inicio' : 'preguntas')
  }, [slug, fijarToken])

  // El setState va en el `.then`, no en el cuerpo del efecto. `activo` evita
  // aplicar una respuesta que llega después de desmontar (o del doble montaje
  // de StrictMode en desarrollo).
  useEffect(() => {
    let activo = true
    void obtenerLink(slug).then((r) => {
      if (activo) aplicarCarga(r)
    })
    return () => {
      activo = false
    }
  }, [slug, aplicarCarga])

  function recargar() {
    setFase('cargando')
    void obtenerLink(slug).then(aplicarCarga)
  }

  // --- Recordar lo contestado ------------------------------------------------
  useEffect(() => {
    if (fase !== 'preguntas' || !datos) return
    escribirGuardado(slug, {
      flujo: datos.flujo,
      operacion_fija: datos.operacion_fija,
      respuestas,
      contacto,
      indice,
    })
  }, [fase, datos, slug, respuestas, contacto, indice])

  // Cada pantalla nueva arranca arriba.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [fase, indice])

  // --- Metadatos ------------------------------------------------------------
  const titulo =
    fase === 'no_disponible'
      ? 'Link no disponible · LeadEra'
      : datos
        ? `Consultá con ${datos.asesor.nombre} · ${datos.inmobiliaria.nombre}`
        : 'Consulta · LeadEra'
  useMetadatos(titulo)

  // --- Envío ------------------------------------------------------------------
  const enviarConsulta = useCallback(
    async (hp: string) => {
      hpRef.current = hp
      setFase('enviando')
      const desenlace = await enviar((token) => {
        const d = datosRef.current
        if (!d) throw new Error('Sin datos del link')
        return armarPayload(d, token, respuestas, contacto, hpRef.current)
      })

      if (desenlace === 'ok') {
        borrarGuardado(slug)
        setFase('gracias')
      } else if (desenlace === 'no_disponible') {
        setFase('no_disponible')
      } else if (desenlace === 'error') {
        setFase('error_envio')
      } else {
        setMensajeInvalido(desenlace.invalido)
        setFase('invalido')
      }
    },
    [enviar, respuestas, contacto, slug],
  )

  function reiniciar() {
    borrarGuardado(slug)
    recargar()
  }

  // --- Pantallas sin datos ------------------------------------------------------
  if (fase === 'cargando') {
    return (
      <Marco>
        <Cargando />
      </Marco>
    )
  }
  if (fase === 'no_disponible' || !datos) {
    if (fase === 'error_carga') {
      return (
        <Marco>
          <ErrorConReintento
            titulo="No pudimos cargar la consulta"
            texto="Revisá tu conexión y probá de nuevo."
            onReintentar={recargar}
          />
        </Marco>
      )
    }
    return (
      <Marco>
        <NoDisponible />
      </Marco>
    )
  }

  const encabezado = <Encabezado asesor={datos.asesor} inmobiliaria={datos.inmobiliaria.nombre} />
  const nombreAsesor = datos.asesor.nombre

  if (fase === 'enviando') {
    return (
      <Marco>
        {encabezado}
        <Enviando />
      </Marco>
    )
  }
  if (fase === 'gracias') {
    return (
      <Marco>
        {encabezado}
        <Gracias nombre={contacto.nombre.trim()} asesor={nombreAsesor} />
      </Marco>
    )
  }
  if (fase === 'error_envio') {
    return (
      <Marco>
        {encabezado}
        <ErrorConReintento
          titulo="No pudimos enviar tu consulta"
          texto="Tus respuestas siguen guardadas. Revisá tu conexión y probá de nuevo."
          onReintentar={() => void enviarConsulta(hpRef.current)}
        />
      </Marco>
    )
  }
  if (fase === 'invalido') {
    return (
      <Marco>
        {encabezado}
        <ErrorInvalido mensaje={mensajeInvalido} onReiniciar={reiniciar} />
      </Marco>
    )
  }

  const pasos = armarPasos(datos, respuestas)
  const propiedad = propiedadDisponible(datos)

  // --- Inicio (solo link de propiedad disponible) -------------------------------
  if (fase === 'inicio' && propiedad) {
    return (
      <Marco>
        {encabezado}
        <p className="mt-5 text-[0.95rem] leading-relaxed text-ink-2">
          Contestá {pasos.length - 1} preguntas rápidas y {nombreAsesor} te contacta con toda la
          información.
        </p>
        <div className="mt-4">
          <FichaPropiedad propiedad={propiedad} />
        </div>
        <button
          type="button"
          onClick={() => {
            setIndice(0)
            setFase('preguntas')
          }}
          className="mt-5 min-h-[52px] w-full rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-contrast shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none"
        >
          Consultar por esta propiedad
        </button>
      </Marco>
    )
  }

  // --- Preguntas ------------------------------------------------------------------
  const actual = Math.min(indice, pasos.length - 1)
  const paso = pasos[actual]
  const operacion = operacionDe(datos, respuestas)
  const propietario = operacion ? esPropietario(operacion) : false

  function avanzar() {
    setIndice((i) => i + 1)
  }

  function elegir(cambio: Partial<Respuestas>) {
    setRespuestas((r) => ({ ...r, ...cambio }))
    avanzar()
  }

  const onAtras =
    actual > 0 ? () => setIndice(actual - 1) : propiedad ? () => setFase('inicio') : undefined

  function contenido(p: IdPaso) {
    switch (p) {
      case 'operacion': {
        const elegirOperacion = (v: Operacion) => {
          setRespuestas((r) => conOperacion(datos!, r, v))
          avanzar()
        }
        // En el link de una propiedad solo entra alguien interesado en ella.
        if (datos!.flujo !== 'GENERAL') {
          return (
            <Pregunta titulo="¿Qué estás buscando?" onAtras={onAtras}>
              <ListaOpciones opciones={OPCIONES_OPERACION} elegida={respuestas.operacion} onElegir={elegirOperacion} />
            </Pregunta>
          )
        }
        // Solo las operaciones que la edge sabe atender (una edge anterior no
        // conoce las de propietario y las rechazaría).
        const busco = OPCIONES_BUSCO.filter((o) => operacionDisponible(datos!, o.valor))
        const tengo = OPCIONES_TENGO.filter((o) => operacionDisponible(datos!, o.valor))
        if (tengo.length === 0) {
          return (
            <Pregunta titulo="¿Qué estás buscando?" onAtras={onAtras}>
              <ListaOpciones opciones={busco} elegida={respuestas.operacion} onElegir={elegirOperacion} />
            </Pregunta>
          )
        }
        return (
          <Pregunta titulo="¿Qué querés hacer?" onAtras={onAtras}>
            <h2 className="m-0 mb-2 text-[0.8rem] font-semibold text-ink-3">Busco</h2>
            <ListaOpciones opciones={busco} elegida={respuestas.operacion} onElegir={elegirOperacion} />
            <h2 className="m-0 mt-5 mb-2 text-[0.8rem] font-semibold text-ink-3">Tengo una propiedad</h2>
            <ListaOpciones opciones={tengo} elegida={respuestas.operacion} onElegir={elegirOperacion} />
          </Pregunta>
        )
      }
      case 'tipo_propiedad':
        return (
          <Pregunta
            titulo={propietario ? '¿Qué tipo de propiedad es?' : '¿Qué tipo de propiedad buscás?'}
            onAtras={onAtras}
          >
            <ListaOpciones
              opciones={OPCIONES_TIPO}
              elegida={respuestas.tipo_propiedad}
              onElegir={(v) => elegir({ tipo_propiedad: v })}
            />
          </Pregunta>
        )
      case 'zona':
        return (
          <Pregunta
            titulo={propietario ? '¿En qué zona está?' : '¿En qué zona?'}
            ayuda={propietario ? 'El barrio o la zona.' : 'Un barrio o una zona. Si te da lo mismo, seguí.'}
            onAtras={onAtras}
          >
            <CampoZona inicial={respuestas.zona ?? ''} onContinuar={(z) => elegir({ zona: z })} />
          </Pregunta>
        )
      case 'presupuesto': {
        if (datos!.flujo === 'PROPIEDAD' && propiedad) {
          const precio = formatearPrecio(propiedad.precio, propiedad.moneda)
          return (
            <Pregunta
              titulo="¿Entra en tu presupuesto?"
              ayuda={precio ? `Precio publicado: ${precio}.` : 'El precio se informa a pedido.'}
              onAtras={onAtras}
            >
              <ListaOpciones
                opciones={OPCIONES_PRESUPUESTO_PROPIEDAD}
                elegida={respuestas.presupuesto as (typeof OPCIONES_PRESUPUESTO_PROPIEDAD)[number]['valor'] | undefined}
                onElegir={(v) => elegir({ presupuesto: v })}
              />
            </Pregunta>
          )
        }
        const todos = (operacion && datos!.rangos_presupuesto?.[operacion]) || []
        const elegido = todos.find((r) => r.codigo === respuestas.presupuesto)
        // Si ya hay un rango elegido (volviendo con Atrás), manda su moneda.
        const moneda = (elegido && monedaDeRango(elegido)) ?? monedaAlquiler
        const { conSelector, rangos: visibles } = rangosParaPaso(datos!, operacion, moneda)

        const textos =
          operacion === 'VENTA'
            ? { titulo: '¿Cuánto creés que vale?', ayuda: 'Un aproximado alcanza. Si no sabés, te ayudamos a tasarla.' }
            : operacion === 'ALQUILER_PROPIETARIO'
              ? {
                  titulo: '¿Cuánto pretendés por mes?',
                  ayuda: conSelector ? 'Elegí la moneda. Si no sabés, te asesoramos.' : 'Si no sabés, te asesoramos.',
                }
              : operacion === 'ALQUILER'
                ? {
                    titulo: '¿Cuánto querés pagar por mes?',
                    // Sin selector (edge anterior) no hay moneda que elegir.
                    ayuda: conSelector ? 'Elegí la moneda en la que lo pensás.' : 'Alquiler mensual.',
                  }
                : { titulo: '¿Cuál es tu presupuesto?', ayuda: 'En dólares.' }

        return (
          <Pregunta titulo={textos.titulo} ayuda={textos.ayuda} onAtras={onAtras}>
            {conSelector && (
              <SelectorMoneda
                valor={moneda}
                onCambiar={(m) => {
                  setMonedaAlquiler(m)
                  // Un rango de la otra moneda ya no vale, ni su monto.
                  const actual = elegido && monedaDeRango(elegido)
                  if (actual && actual !== m) setRespuestas(sinPresupuesto)
                }}
              />
            )}
            <ListaOpciones
              opciones={visibles.map((r) => ({ valor: r.codigo, label: r.label }))}
              elegida={respuestas.presupuesto}
              onElegir={(v) => {
                // Un rango abierto que trae `monto` no avanza solo: abajo
                // aparece el campo para indicarlo, con su "Continuar".
                setRespuestas((r) => conPresupuesto(r, v))
                if (!todos.find((r) => r.codigo === v)?.monto) avanzar()
              }}
            />
            {elegido?.monto && (
              <CampoMonto
                key={elegido.codigo}
                // Con un rango elegido, `moneda` es la suya.
                moneda={moneda}
                limites={elegido.monto}
                inicial={respuestas.presupuesto_monto}
                onContinuar={(monto) => {
                  setRespuestas((r) => conMonto(r, monto))
                  avanzar()
                }}
              />
            )}
          </Pregunta>
        )
      }
      case 'publicada':
        return (
          <Pregunta
            titulo="¿Ya la tenés publicada?"
            ayuda="En portales, redes o con alguna inmobiliaria."
            onAtras={onAtras}
          >
            <ListaOpciones
              opciones={OPCIONES_PUBLICADA}
              elegida={respuestas.publicada}
              onElegir={(v) => elegir({ publicada: v })}
            />
          </Pregunta>
        )
      case 'pago':
        return (
          <Pregunta titulo="¿Cómo pensás pagar?" onAtras={onAtras}>
            <ListaOpciones
              opciones={OPCIONES_PAGO}
              elegida={respuestas.pago}
              onElegir={(v) => elegir({ pago: v })}
            />
          </Pregunta>
        )
      case 'garantia':
        return (
          <Pregunta titulo="¿Con qué garantía contás?" onAtras={onAtras}>
            <ListaOpciones
              opciones={OPCIONES_GARANTIA}
              elegida={respuestas.garantia}
              onElegir={(v) => elegir({ garantia: v })}
            />
          </Pregunta>
        )
      case 'plazo':
        return (
          <Pregunta
            titulo={
              operacion === 'VENTA'
                ? '¿Para cuándo querés venderla?'
                : operacion === 'ALQUILER_PROPIETARIO'
                  ? '¿Para cuándo querés alquilarla?'
                  : '¿Para cuándo lo necesitás?'
            }
            onAtras={onAtras}
          >
            <ListaOpciones
              opciones={propietario ? OPCIONES_PLAZO_PROPIETARIO : OPCIONES_PLAZO}
              elegida={respuestas.plazo}
              onElegir={(v) => elegir({ plazo: v })}
            />
          </Pregunta>
        )
      case 'visita':
        return (
          <Pregunta titulo="¿Querés coordinar una visita?" onAtras={onAtras}>
            <ListaOpciones
              opciones={OPCIONES_SI_NO_VISITA}
              elegida={respuestas.visita === undefined ? undefined : respuestas.visita ? 'si' : 'no'}
              onElegir={(v) => elegir({ visita: v === 'si' })}
            />
          </Pregunta>
        )
      case 'vender':
        return (
          <Pregunta
            titulo="¿Tenés una propiedad para vender?"
            ayuda="Si necesitás vender para comprar, también te podemos ayudar."
            onAtras={onAtras}
          >
            <ListaOpciones
              opciones={OPCIONES_SI_NO}
              elegida={respuestas.vender === undefined ? undefined : respuestas.vender ? 'si' : 'no'}
              onElegir={(v) => elegir({ vender: v === 'si' })}
            />
          </Pregunta>
        )
      case 'contacto':
        return (
          <Pregunta
            titulo="¿Cómo te contactamos?"
            ayuda={`${nombreAsesor} te va a escribir o llamar para responder tu consulta.`}
            onAtras={onAtras}
          >
            <PasoContacto
              nombreAsesor={nombreAsesor}
              pideEmail={!datos!.link.preguntas_off.includes('email')}
              contacto={contacto}
              onCambiar={setContacto}
              onEnviar={(hp) => void enviarConsulta(hp)}
            />
          </Pregunta>
        )
    }
  }

  const avisoNoDisponible = datos.propiedad?.disponible === false && actual === 0

  return (
    <Marco>
      {encabezado}
      <div className="mt-5 flex items-center gap-3">
        <Progreso actual={actual + 1} total={pasos.length} />
        <span className="shrink-0 text-xs font-medium text-ink-subtle tabular-nums">
          {actual + 1}/{pasos.length}
        </span>
      </div>

      {avisoNoDisponible && (
        <p
          role="status"
          className="mt-4 rounded-md border border-warning/25 bg-warm-soft px-3.5 py-3 text-sm text-badge-tibio-ink"
        >
          Esta propiedad ya no está disponible, contanos qué buscás.
        </p>
      )}

      <Tarjeta className="mt-4">
        <div key={`${paso}-${actual}`}>{contenido(paso)}</div>
      </Tarjeta>
    </Marco>
  )
}
