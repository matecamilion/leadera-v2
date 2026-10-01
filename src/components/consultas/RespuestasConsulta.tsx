import type { ReactNode } from 'react'
import { filasRespuestas } from './respuestas'
import { esperaCorta, esperaLarga, nivelEspera } from './urgencia'

/** Las respuestas completas, para el detalle desplegable de una fila. */
export function RespuestasConsulta({ respuestas }: { respuestas: unknown }) {
  const filas = filasRespuestas(respuestas)
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.82rem] sm:grid-cols-[auto_1fr_auto_1fr]">
      {filas.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-ink-3">{f.label}</dt>
          <dd className="m-0 min-w-0 font-medium text-ink-2">{f.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------------
// Puntaje
// ---------------------------------------------------------------------------

const TONO_TEMPERATURA = {
  CALIENTE: { fondo: 'bg-badge-caliente-bg', tinta: 'text-caliente', nombre: 'Caliente' },
  TIBIO: { fondo: 'bg-badge-tibio-bg', tinta: 'text-badge-tibio-ink', nombre: 'Tibia' },
  FRIO: { fondo: 'bg-badge-frio-bg', tinta: 'text-frio', nombre: 'Fría' },
} as const

function tono(temperatura: string) {
  return TONO_TEMPERATURA[(temperatura in TONO_TEMPERATURA ? temperatura : 'FRIO') as keyof typeof TONO_TEMPERATURA]
}

/**
 * La señal dominante de la fila: el puntaje grande sobre el color de la
 * temperatura. Es lo primero que agarra el ojo al bajar por la lista.
 */
export function BloquePuntaje({
  temperatura,
  puntaje,
  chico = false,
}: {
  temperatura: string
  puntaje: number
  chico?: boolean
}) {
  const t = tono(temperatura)
  return (
    <span
      role="img"
      aria-label={`${t.nombre}, ${puntaje} puntos`}
      className={[
        'flex shrink-0 flex-col items-center justify-center rounded-xl leading-none',
        t.fondo,
        t.tinta,
        chico ? 'size-10' : 'size-12',
      ].join(' ')}
    >
      <span className={`font-bold tabular-nums ${chico ? 'text-[0.95rem]' : 'text-[1.1rem]'}`}>
        {puntaje}
      </span>
      {!chico && (
        <span className="mt-1 text-[0.56rem] font-bold tracking-[0.06em] uppercase">{t.nombre}</span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Espera
// ---------------------------------------------------------------------------

function IconoReloj() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

const ESTILO_ESPERA = {
  normal: 'text-ink-3',
  atencion: 'bg-warm-soft text-badge-tibio-ink',
  urgente: 'bg-badge-caliente-bg text-caliente',
} as const

/**
 * Cuánto lleva esperando. Escala de gris a ámbar (1 h) y a rojo (4 h); el
 * texto y el ícono van siempre, así el color nunca es la única señal.
 */
export function ChipEspera({ minutos }: { minutos: number }) {
  const nivel = nivelEspera(minutos)
  return (
    <span
      title={`Esperando hace ${esperaLarga(minutos)}`}
      aria-label={`Esperando hace ${esperaLarga(minutos)}`}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full text-[0.74rem] font-semibold whitespace-nowrap tabular-nums',
        nivel === 'normal' ? '' : 'px-2 py-0.5',
        ESTILO_ESPERA[nivel],
      ].join(' ')}
    >
      <IconoReloj />
      {esperaCorta(minutos)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Señales
// ---------------------------------------------------------------------------

const trazo = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'shrink-0',
}

const ICONOS = {
  volvio: (
    <svg {...trazo}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4.5v4h4" />
    </svg>
  ),
  captacion: (
    <svg {...trazo}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M12 12.5v5M9.5 15h5" />
    </svg>
  ),
  duplicado: (
    <svg {...trazo}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19.5v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M18.5 13.8a4.5 4.5 0 0 1 2.5 4v1.7" />
    </svg>
  ),
  limite: (
    <svg {...trazo}>
      <path d="M12 4 2.8 19.5h18.4Z" />
      <path d="M12 10v4" />
      <path d="M12 16.8v.2" />
    </svg>
  ),
} as const

const ESTILO_SENAL = {
  volvio: 'bg-cool-soft text-info',
  captacion: 'bg-brand-soft text-primary-dark',
  duplicado: 'bg-surface-2 text-ink-2',
  limite: 'bg-warm-soft text-badge-tibio-ink',
} as const

export type TipoSenal = keyof typeof ESTILO_SENAL

/** Ícono y una palabra: se reconoce sin leer, y el texto queda para quien lo necesite. */
export function Senal({ tipo, titulo, children }: { tipo: TipoSenal; titulo: string; children: ReactNode }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap ${ESTILO_SENAL[tipo]}`}
    >
      {ICONOS[tipo]}
      {children}
    </span>
  )
}
