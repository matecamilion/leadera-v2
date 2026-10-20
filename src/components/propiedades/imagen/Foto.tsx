/**
 * Una foto de la pieza, recortada para llenar su zona. Sin foto, un hueco gris.
 * `borde` dibuja un marco fino encima, sin ocupar lugar.
 */
export function Foto({ src, borde }: { src?: string; borde?: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {src ? (
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.12)' }} />
      )}
      {borde && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxSizing: 'border-box',
            border: `2px solid ${borde}`,
          }}
        />
      )}
    </div>
  )
}
