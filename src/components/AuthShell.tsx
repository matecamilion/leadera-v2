import type { ReactNode } from 'react'
import { Marca } from './Marca'

interface AuthShellProps {
  titulo: string
  descripcion: string
  children: ReactNode
  /** Link de cierre: "¿No tenés cuenta?" y similares. */
  pie?: ReactNode
}

/** Tarjeta centrada de las pantallas públicas (login y alta). */
export function AuthShell({ titulo, descripcion, children, pie }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-primary">
          <Marca />
        </div>

        <div className="rounded-card bg-surface p-7 shadow-card">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{titulo}</h1>
          <p className="mt-1 text-sm text-ink-muted">{descripcion}</p>

          <div className="mt-6">{children}</div>
        </div>

        {pie && <div className="mt-5 text-center text-sm text-ink-muted">{pie}</div>}
      </div>
    </main>
  )
}
