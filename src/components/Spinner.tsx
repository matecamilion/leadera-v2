interface SpinnerProps {
  /** Ocupa el alto de la ventana y se centra. Para pantallas completas. */
  fullscreen?: boolean
  label?: string
}

export function Spinner({ fullscreen = false, label = 'Cargando' }: SpinnerProps) {
  const spinner = (
    <span
      role="status"
      aria-label={label}
      className="block size-6 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
    />
  )

  if (!fullscreen) return spinner

  return (
    <div className="grid min-h-dvh place-items-center bg-background">{spinner}</div>
  )
}
