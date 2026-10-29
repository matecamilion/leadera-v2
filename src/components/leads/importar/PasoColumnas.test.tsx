import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { armarPayload } from '../../../lib/api/importarLeads'
import { marcarDuplicadosEnArchivo } from '../../../lib/importarLeads/duplicadosEnArchivo'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import { sugerirMapeo, type MapeoColumnas } from '../../../lib/importarLeads/mapeoColumnas'
import { normalizarFilas } from '../../../lib/importarLeads/normalizarFilas'
import { PasoColumnas } from './PasoColumnas'

// La capa de API (armarPayload) carga el cliente de Supabase.
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

// Todo inventado.
const ARCHIVO: ArchivoLeido = {
  hoja: 'Hoja1',
  encabezados: ['Cliente', 'Celular', 'Mail', 'Barrio'],
  filas: [
    { numeroFilaOriginal: 2, celdas: { 0: 'María del Carmen Pérez', 1: '223 555-0101', 2: 'MARIA@ejemplo.com', 3: 'Centro' } },
    { numeroFilaOriginal: 3, celdas: { 0: 'Luis', 1: '+1 310 555 0108', 2: 'no-es-un-mail', 3: null } },
    { numeroFilaOriginal: 4, celdas: { 0: null, 1: '223 555-0102', 2: null, 3: null } },
  ],
}

/** Con el estado adentro, como en la página. */
function Conectado({
  inicial,
  onContinuar = () => {},
  archivo = ARCHIVO,
}: {
  inicial: MapeoColumnas
  onContinuar?: () => void
  archivo?: ArchivoLeido
}) {
  const [mapeo, setMapeo] = useState(inicial)
  return (
    <PasoColumnas
      archivo={archivo}
      mapeo={mapeo}
      onMapeo={setMapeo}
      onVolver={() => {}}
      onContinuar={onContinuar}
    />
  )
}

describe('PasoColumnas', () => {
  it('arranca con la propuesta de sugerirMapeo', () => {
    render(<Conectado inicial={sugerirMapeo(ARCHIVO.encabezados).mapeo} />)

    expect((screen.getByLabelText('Nombre completo') as HTMLSelectElement).value).toBe('0')
    expect((screen.getByLabelText('Teléfono') as HTMLSelectElement).value).toBe('1')
    expect((screen.getByLabelText('Email') as HTMLSelectElement).value).toBe('2')
    expect((screen.getByLabelText('Apellido') as HTMLSelectElement).value).toBe('')
  })

  it('cada campo tiene su select con label y las columnas con su letra', () => {
    render(<Conectado inicial={{}} />)

    const select = screen.getByLabelText('Teléfono') as HTMLSelectElement
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['No importar', 'A · Cliente', 'B · Celular', 'C · Mail', 'D · Barrio'])
  })

  it('sin nombre mapeado, Continuar queda deshabilitado y se explica por qué', () => {
    render(<Conectado inicial={{ telefono: 1 }} />)

    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toMatch(/Nombre o la de Nombre completo/)
  })

  it('al mapear un nombre se habilita y Continuar avisa al padre', () => {
    const onContinuar = vi.fn()
    render(<Conectado inicial={{}} onContinuar={onContinuar} />)

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '0' } })

    const boton = screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
    expect(boton.disabled).toBe(false)
    fireEvent.click(boton)
    expect(onContinuar).toHaveBeenCalledOnce()
  })

  it('una columna no queda en dos campos: moverla se la saca al anterior', () => {
    render(<Conectado inicial={{ nombre: 0, telefono: 1 }} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '1' } })

    expect((screen.getByLabelText('Email') as HTMLSelectElement).value).toBe('1')
    expect((screen.getByLabelText('Teléfono') as HTMLSelectElement).value).toBe('')
  })

  it('la vista previa parte el nombre completo y muestra avisos y errores por fila', () => {
    render(<Conectado inicial={sugerirMapeo(ARCHIVO.encabezados).mapeo} />)

    const filas = screen.getAllByRole('row').slice(1)
    expect(filas).toHaveLength(3)

    // Fila 2: nombre y apellido partidos, email en minúsculas.
    expect(within(filas[0]).getByText('María')).toBeTruthy()
    expect(within(filas[0]).getByText('del Carmen Pérez')).toBeTruthy()
    expect(within(filas[0]).getByText('maria@ejemplo.com')).toBeTruthy()

    // Fila 3: teléfono dudoso y email inválido => avisos.
    expect(within(filas[1]).getByText(/no parece un celular argentino/)).toBeTruthy()
    expect(within(filas[1]).getByText(/formato válido/)).toBeTruthy()

    // Fila 4: sin nombre => error bloqueante.
    expect(within(filas[2]).getByText('Falta el nombre.')).toBeTruthy()
  })

  it('la vista previa muestra como mucho 5 filas y dice cuántas hay', () => {
    const muchas: ArchivoLeido = {
      ...ARCHIVO,
      filas: Array.from({ length: 12 }, (_, i) => ({
        numeroFilaOriginal: i + 2,
        celdas: { 0: `Lead ${i}`, 1: null, 2: null, 3: null },
      })),
    }
    render(
      <PasoColumnas archivo={muchas} mapeo={{ nombre: 0 }} onMapeo={() => {}} onVolver={() => {}} onContinuar={() => {}} />,
    )

    expect(screen.getAllByRole('row').slice(1)).toHaveLength(5)
    expect(screen.getByText(/Mostrando 5 de 12/)).toBeTruthy()
  })
})

describe('PasoColumnas: revisión de duplicados', () => {
  const mapeo = { nombre: 0 }
  const montar = (extra: { verificando?: boolean; errorVerificacion?: string | null }, onContinuar = vi.fn()) => {
    render(
      <PasoColumnas
        archivo={ARCHIVO}
        mapeo={mapeo}
        onMapeo={() => {}}
        onVolver={() => {}}
        onContinuar={onContinuar}
        {...extra}
      />,
    )
    return onContinuar
  }

  it('mientras revisa: el botón dice que está revisando y queda deshabilitado, igual que Volver', () => {
    montar({ verificando: true })

    const boton = screen.getByRole('button', { name: 'Revisando duplicados en tu cuenta…' }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('si falla: muestra el mensaje y "Reintentar" vuelve a pedir la revisión', () => {
    const onContinuar = montar({ errorVerificacion: 'Sesión inválida o expirada' })

    expect(screen.getByRole('alert').textContent).toContain('Sesión inválida o expirada')
    // El usuario puede volver al paso anterior.
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onContinuar).toHaveBeenCalledOnce()
  })

  it('sin error ni revisión en curso no hay botón de reintentar', () => {
    montar({})
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Origen, detalle, columnas sin usar y vista previa. Todo inventado.
// ---------------------------------------------------------------------------

const ARCHIVO_CRM: ArchivoLeido = {
  hoja: 'Leads',
  encabezados: ['Nombre', 'Celular', 'Origen', 'Asesor', 'UTM fuente', 'Dirección', 'Respondido el', 'Fecha de creación'],
  filas: [
    {
      numeroFilaOriginal: 2,
      celdas: {
        0: 'Ana Gil',
        1: '223 555-0101',
        2: 'ZonaProp',
        3: 'Asesor Uno',
        4: 'zp',
        5: 'Colón 100',
        6: '05/03/2026 10:14',
        7: '05/03/2026 10:00',
      },
    },
    {
      numeroFilaOriginal: 3,
      celdas: { 0: 'Luis Paz', 1: '223 555-0102', 2: 'Century 21', 3: null, 4: null, 5: null, 6: null, 7: '06/03/2026 09:00' },
    },
  ],
}
const MAPEO_CRM = sugerirMapeo(ARCHIVO_CRM.encabezados).mapeo

describe('PasoColumnas: origen', () => {
  it('tiene su select con "No importar" y arranca con la columna detectada', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const select = screen.getByLabelText('Origen') as HTMLSelectElement
    expect(select.value).toBe('2')
    const opciones = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(opciones[0]).toBe('No importar')
    expect(screen.getByText(/entran como «Importación»/)).toBeTruthy()
  })

  it('con "No importar" el payload a la RPC no lleva origen; con la columna, sí', () => {
    const onMapeo = vi.fn()
    render(
      <PasoColumnas
        archivo={ARCHIVO_CRM}
        mapeo={MAPEO_CRM}
        onMapeo={onMapeo}
        onVolver={() => {}}
        onContinuar={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: '' } })
    const sinOrigen = onMapeo.mock.calls[0][0] as MapeoColumnas

    const payload = (mapeo: MapeoColumnas) =>
      armarPayload(marcarDuplicadosEnArchivo(normalizarFilas(ARCHIVO_CRM.filas, mapeo, ARCHIVO_CRM.encabezados)))

    expect(payload(sinOrigen).every((fila) => !('origen' in fila))).toBe(true)
    expect(payload(MAPEO_CRM).map((fila) => fila.origen)).toEqual(['ZONAPROP', 'OTRO'])
  })

  it('la vista previa muestra el origen traducido: lo desconocido es "Otro"', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).getByText('ZonaProp')).toBeTruthy()
    expect(within(filas[1]).getByText('Otro')).toBeTruthy()
  })

  it('con "No importar" el origen deja de mandarse: la vista previa queda en "—"', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: '' } })

    expect((screen.getByLabelText('Origen') as HTMLSelectElement).value).toBe('')
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).queryByText('ZonaProp')).toBeNull()
    expect(within(filas[1]).queryByText('Otro')).toBeNull()
    // Y la columna vuelve a estar disponible: ya no figura como "campo".
    expect(screen.getByRole('checkbox', { name: 'C · Origen' })).toBeTruthy()
  })
})

describe('PasoColumnas: incluir en el detalle', () => {
  it('lista las columnas que no son un campo, con las del detalle ya marcadas', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const grupo = screen.getByRole('group', { name: 'Incluir en el detalle' })
    const casillas = within(grupo).getAllByRole('checkbox') as HTMLInputElement[]
    // Nombre, Celular, Origen, Respondido el y Fecha de creación van a un campo: no aparecen.
    expect(casillas.map((c) => c.closest('label')!.textContent)).toEqual(['D · Asesor', 'E · UTM fuente', 'F · Dirección'])
    expect(casillas.map((c) => c.checked)).toEqual([false, false, true])
  })

  it('se puede quitar una columna preseleccionada y agregar otra', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'F · Dirección' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'D · Asesor' }))

    expect((screen.getByRole('checkbox', { name: 'F · Dirección' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: 'D · Asesor' }) as HTMLInputElement).checked).toBe(true)
    const detalle = screen.getAllByRole('row')[1].querySelector('pre')!.textContent
    expect(detalle).toContain('Asesor: Asesor Uno')
    expect(detalle).not.toContain('Dirección')
  })

  it('acepta cualquier cantidad de columnas', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'D · Asesor' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'E · UTM fuente' }))

    const detalle = screen.getAllByRole('row')[1].querySelector('pre')!.textContent
    expect(detalle).toContain('Asesor: Asesor Uno')
    expect(detalle).toContain('UTM fuente: zp')
    expect(detalle).toContain('Dirección: Colón 100')
  })

  it('una columna que se asigna a un campo desaparece de la lista', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: '3' } })

    expect(screen.queryByRole('checkbox', { name: 'D · Asesor' })).toBeNull()
  })

  it('con todas las columnas en campos no hay lista', () => {
    render(<Conectado inicial={{ nombreCompleto: 0, telefono: 1, email: 2, descripcion: 3 }} />)
    expect(screen.queryByRole('group', { name: 'Incluir en el detalle' })).toBeNull()
  })
})

describe('PasoColumnas: columnas sin usar', () => {
  it('avisa cuáles no se van a importar y ofrece incluirlas todas', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const aviso = screen.getByRole('region', { name: 'Columnas sin usar' })
    expect(aviso.textContent).toContain('Estas columnas no se van a importar')
    expect(aviso.textContent).toContain('D · Asesor')
    expect(aviso.textContent).toContain('E · UTM fuente')
    // La que ya va al detalle no está entre las sin usar.
    expect(aviso.textContent).not.toContain('Dirección')
    expect(within(aviso).getByRole('button', { name: 'Incluir todas en el detalle' })).toBeTruthy()
  })

  it('"Incluir todas en el detalle" las marca y el aviso desaparece', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    fireEvent.click(screen.getByRole('button', { name: 'Incluir todas en el detalle' }))

    expect(screen.queryByRole('region', { name: 'Columnas sin usar' })).toBeNull()
    for (const nombre of ['D · Asesor', 'E · UTM fuente', 'F · Dirección']) {
      expect((screen.getByRole('checkbox', { name: nombre }) as HTMLInputElement).checked).toBe(true)
    }
  })

  it('al desmarcar una columna del detalle vuelve a avisar', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)
    fireEvent.click(screen.getByRole('button', { name: 'Incluir todas en el detalle' }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'E · UTM fuente' }))

    const aviso = screen.getByRole('region', { name: 'Columnas sin usar' })
    expect(aviso.textContent).toContain('E · UTM fuente')
    expect(aviso.textContent).not.toContain('Asesor')
  })

  it('no se muestra si no hay columnas sin usar', () => {
    render(<Conectado inicial={sugerirMapeo(ARCHIVO.encabezados).mapeo} />)
    expect(screen.queryByRole('region', { name: 'Columnas sin usar' })).toBeNull()
  })

  it('una columna sin título figura como "(sin título)"', () => {
    const sinTitulo: ArchivoLeido = {
      ...ARCHIVO_CRM,
      encabezados: ['Nombre', ''],
      filas: [{ numeroFilaOriginal: 2, celdas: { 0: 'Ana', 1: 'x' } }],
    }
    render(<Conectado archivo={sinTitulo} inicial={{ nombre: 0 }} />)
    expect(screen.getByRole('region', { name: 'Columnas sin usar' }).textContent).toContain('B · (sin título)')
  })
})

describe('PasoColumnas: vista previa del contacto y el detalle', () => {
  it('rotula el detalle con los encabezados reales del archivo, no con "Columna N"', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const detalle = screen.getAllByRole('row')[1].querySelector('pre')!.textContent
    expect(detalle).toContain('Dirección: Colón 100')
    expect(detalle).not.toMatch(/Columna \d/)
  })

  it('el detalle compuesto es expandible y con altura máxima', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const fila = screen.getAllByRole('row')[1]
    const detalle = fila.querySelector('details') as HTMLDetailsElement
    expect(within(detalle).getByText('Ver detalle')).toBeTruthy()
    expect(detalle.open).toBe(false)
    const caja = detalle.querySelector('pre') as HTMLElement
    expect(caja.className).toContain('max-h-48')
    expect(caja.className).toContain('overflow-auto')
    expect(caja.textContent).toBe('Consulta del 05/03/2026 · ZonaProp\nDirección: Colón 100')
  })

  it('muestra el contacto cargado con fecha y hora, y "—" si la fila no tiene', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)

    const filas = screen.getAllByRole('row').slice(1)
    expect(filas[0].textContent).toMatch(/05\/03\/2026,? 10:14/)
    const celdas = Array.from(filas[1].querySelectorAll('td')).map((td) => td.textContent)
    // Fila 3: sin "Respondido el" => Contacto "—".
    expect(celdas[8]).toBe('—')
  })

  it('tiene las columnas Origen, Contacto y Detalle', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)
    const encabezados = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(encabezados).toEqual([
      'Fila',
      'Nombre',
      'Apellido',
      'Teléfono',
      'Email',
      'Estado',
      'Fecha',
      'Origen',
      'Contacto',
      'Detalle',
      'Avisos',
    ])
  })

  it('la tabla sigue con scroll horizontal propio', () => {
    render(<Conectado archivo={ARCHIVO_CRM} inicial={MAPEO_CRM} />)
    const tabla = screen.getAllByRole('table')[0]
    expect(tabla.parentElement!.className).toContain('overflow-x-auto')
  })
})
