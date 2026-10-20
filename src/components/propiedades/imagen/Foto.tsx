/** Una foto de la pieza, recortada para llenar su zona. Sin foto, un hueco gris. */
export function Foto({ src }: { src?: string }) {
  return src ? (
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ) : (
    <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.12)' }} />
  )
}
