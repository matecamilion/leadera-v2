import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoDeImportacion } from '../../../lib/api/importarLeads'
import { claves } from '../../../lib/queryKeys'

const { rpc, auth } = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: { rol: 'DUENO' as string | undefined },
}))

vi.mock('../../../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: auth.rol ? { id: 'yo', rol: auth.rol } : null,
    user: { id: 'yo' },
  }),
}))

import { PasoResultado } from './PasoResultado'
import { conTelefono, revisionDe } from './utilesDePrueba'

// jsdom no implementa showModal ni close: se emulan con el atributo `open`.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const ID = '11111111-1111-4111-8111-111111111111'
const REVISION = revisionDe({ filas: [conTelefono(2), conTelefono(3), conTelefono(4)] })

const ok = (fila: number) => ({ fila, resultado: 'OK' as const })
const IMPORTADO: ResultadoDeImportacion = {
  insertados: 3,
  resultados: [ok(2), ok(3), ok(4)],
  corte: null,
  importacionId: ID,
}

/** Lo que devuelve la RPC en una simulación. */
const simulacion = (cambios: Record<string, unknown> = {}) => ({
  data: { total: 3, borrables: 3, protegidos: 0, en_ventana: true, puede: true, motivo: null, ...cambios },
  error: null,
})
const confirmacion = (cambios: Record<string, unknown> = {}) => ({
  data: { borrados: 3, protegidos: 0, motivo: null, ...cambios },
  error: null,
})

/** Responde según el modo: simulación o confirmación. */
function rpcResponde(sim: unknown, conf: unknown) {
  rpc.mockImplementation((_nombre: string, args: { p_confirmar: boolean }) =>
    Promise.resolve(args.p_confirmar ? conf : sim),
  )
}

function mostrar(resultado: ResultadoDeImportacion = IMPORTADO) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  const onVerLeads = vi.fn()
  const onOtroArchivo = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PasoResultado
          revision={REVISION}
          importando={false}
          progreso={null}
          resultado={resultado}
          onVerLeads={onVerLeads}
          onOtroArchivo={onOtroArchivo}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { invalidar, onVerLeads, onOtroArchivo }
}

const botonDeshacer = () => screen.queryByRole('button', { name: 'Deshacer importación' })
const abrirDialogo = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer importación' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  rpc.mockReset()
  auth.rol = 'DUENO'
})

describe('Deshacer importación: quién lo ve', () => {
  it('con importacionId y leads importados aparece, con la nota', () => {
    mostrar()
    expect(botonDeshacer()).toBeTruthy()
    expect(
      screen.getByText('Podés deshacer esta importación desde acá. Los leads que ya tengan actividad no se eliminan.'),
    ).toBeTruthy()
  })

  it('la nota no menciona los 7 días (eso lo dice el diálogo si corresponde)', () => {
    mostrar()
    expect(screen.queryByText(/7 días/)).toBeNull()
  })

  it('un AGENTE también lo ve', () => {
    auth.rol = 'AGENTE'
    mostrar()
    expect(botonDeshacer()).toBeTruthy()
  })

  it('sin importacionId no aparece', () => {
    mostrar({ ...IMPORTADO, importacionId: undefined })
    expect(botonDeshacer()).toBeNull()
  })

  it('sin leads importados no aparece', () => {
    mostrar({ insertados: 0, resultados: [], corte: null, importacionId: ID })
    expect(botonDeshacer()).toBeNull()
  })

  it('para un ASISTENTE no aparece', () => {
    auth.rol = 'ASISTENTE'
    mostrar()
    expect(botonDeshacer()).toBeNull()
  })

  it('sin el perfil cargado tampoco aparece', () => {
    auth.rol = undefined
    mostrar()
    expect(botonDeshacer()).toBeNull()
  })

  it('con un corte a mitad igual se puede deshacer lo que entró', () => {
    mostrar({
      insertados: 2,
      resultados: [ok(2), ok(3)],
      corte: { mensaje: 'Se cortó.', filasSinProcesar: [4] },
      importacionId: ID,
    })
    expect(botonDeshacer()).toBeTruthy()
  })
})

describe('Deshacer importación: la simulación y el diálogo', () => {
  it('simula con el id y sin borrar: p_confirmar false', async () => {
    rpcResponde(simulacion(), confirmacion())
    mostrar()

    await abrirDialogo()

    await screen.findByText('Se van a eliminar 3 leads de esta importación.')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('revertir_importacion', { p_importacion_id: ID, p_confirmar: false })
  })

  it('muestra los números reales, la aclaración honesta y los botones', async () => {
    rpcResponde(simulacion(), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()

    await within(dialogo).findByText('Se van a eliminar 3 leads de esta importación.')
    expect(
      within(dialogo).getByText(/Solo se eliminan los leads de esta importación; los que ya existían en tu cuenta no se tocan/),
    ).toBeTruthy()
    expect(within(dialogo).getByText(/Esta acción es permanente/)).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'Eliminar 3 leads' })).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeTruthy()
    expect(within(dialogo).getByRole('heading', { name: '¿Deshacer esta importación?' })).toBeTruthy()
  })

  it('mientras revisa lo dice y todavía no ofrece eliminar', async () => {
    rpc.mockReturnValue(new Promise(() => {}))
    mostrar()

    const dialogo = await abrirDialogo()

    expect(within(dialogo).getByText('Revisando qué se puede eliminar…')).toBeTruthy()
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).toBeNull()
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeTruthy()
  })

  it('la región de estado anuncia los cambios (aria-live)', async () => {
    rpcResponde(simulacion(), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()
    await within(dialogo).findByText('Se van a eliminar 3 leads de esta importación.')

    expect(dialogo.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('con protegidos dice cuántos se conservan y por qué', async () => {
    rpcResponde(simulacion({ total: 5, borrables: 3, protegidos: 2 }), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()

    await within(dialogo).findByText('Se van a eliminar 3 leads de esta importación.')
    expect(
      within(dialogo).getByText(/Y se conservan 2 porque ya tienen actividad \(interacciones, tareas, operaciones, etc\.\)/),
    ).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'Eliminar 3 leads' })).toBeTruthy()
  })

  it('en singular: un lead a eliminar y uno protegido', async () => {
    rpcResponde(simulacion({ total: 2, borrables: 1, protegidos: 1 }), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()

    await within(dialogo).findByText('Se van a eliminar 1 lead de esta importación.')
    expect(within(dialogo).getByText(/Y se conserva 1 porque ya tiene actividad/)).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'Eliminar 1 lead' })).toBeTruthy()
  })

  it('sin protegidos no menciona la actividad', async () => {
    rpcResponde(simulacion(), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()
    await within(dialogo).findByText('Se van a eliminar 3 leads de esta importación.')

    expect(within(dialogo).queryByText(/se conserva/)).toBeNull()
  })

  it('si no se puede, muestra el motivo de la base y no ofrece confirmar', async () => {
    rpcResponde(
      simulacion({
        en_ventana: false,
        puede: false,
        motivo: 'Solo se puede revertir una importación dentro de los 7 días de haberse hecho.',
      }),
      confirmacion(),
    )
    mostrar()

    const dialogo = await abrirDialogo()

    await within(dialogo).findByText(
      'Solo se puede revertir una importación dentro de los 7 días de haberse hecho.',
    )
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).toBeNull()
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeTruthy()
  })

  it('un lote que la base no encuentra (total 0) también muestra su motivo', async () => {
    rpcResponde(
      simulacion({
        total: 0,
        borrables: 0,
        en_ventana: false,
        puede: false,
        motivo: 'No se encontró ninguna importación con ese id en tu cuenta.',
      }),
      confirmacion(),
    )
    mostrar()

    const dialogo = await abrirDialogo()

    await within(dialogo).findByText('No se encontró ninguna importación con ese id en tu cuenta.')
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).toBeNull()
  })

  it('si no hay nada para eliminar lo explica y no ofrece confirmar', async () => {
    rpcResponde(simulacion({ total: 2, borrables: 0, protegidos: 2 }), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()

    await within(dialogo).findByText(/No hay nada para eliminar/)
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).toBeNull()
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeTruthy()
  })

  it('un error de la simulación se ve en el diálogo, que queda abierto, sin confirmar', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'No tenés permiso para revertir esta importación.' },
    })
    mostrar()

    const dialogo = await abrirDialogo()

    expect((await within(dialogo).findByRole('alert')).textContent).toBe(
      'No tenés permiso para revertir esta importación.',
    )
    expect(dialogo.hasAttribute('open')).toBe(true)
    expect(within(dialogo).queryByRole('button', { name: /^Eliminar/ })).toBeNull()
  })

  it('"Cancelar" cierra sin confirmar y volver a abrir vuelve a simular', async () => {
    rpcResponde(simulacion(), confirmacion())
    mostrar()

    const dialogo = await abrirDialogo()
    await within(dialogo).findByText('Se van a eliminar 3 leads de esta importación.')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(dialogo.hasAttribute('open')).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1)

    await abrirDialogo()
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2))
    expect(rpc.mock.calls.every(([, args]) => args.p_confirmar === false)).toBe(true)
  })

  it('una simulación que llega con el diálogo ya cerrado no lo reabre ni lo pisa', async () => {
    let resolver: (v: unknown) => void = () => {}
    rpc.mockReturnValue(new Promise((r) => (resolver = r)))
    mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    await act(async () => resolver(simulacion()))

    expect(dialogo.hasAttribute('open')).toBe(false)
    expect(screen.queryByText('Se van a eliminar 3 leads de esta importación.')).toBeNull()
  })
})

describe('Deshacer importación: la confirmación', () => {
  it('confirma con p_confirmar true, muestra el resultado y ofrece seguir', async () => {
    rpcResponde(simulacion(), confirmacion())
    const { invalidar, onOtroArchivo, onVerLeads } = mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Eliminar 3 leads' }))

    await screen.findByText('Se deshizo la importación')
    expect(rpc).toHaveBeenLastCalledWith('revertir_importacion', { p_importacion_id: ID, p_confirmar: true })
    expect(screen.getByRole('status').textContent).toBe('Se eliminaron 3 leads.')

    // El botón desaparece y quedan las dos salidas.
    expect(botonDeshacer()).toBeNull()
    expect(screen.queryByText('Importados')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a importar' }))
    expect(onOtroArchivo).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a leads' }))
    expect(onVerLeads).toHaveBeenCalledOnce()

    // Invalida lo que cambia al desaparecer leads.
    const clavesInvalidadas = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey)
    for (const clave of [
      claves.leads.raiz,
      claves.leadsCombobox.raiz,
      claves.usoRecursos.raiz,
      claves.tareas.raiz,
      claves.equipo.raiz,
      claves.perfil.raiz,
      claves.dashboard.raiz,
      claves.actividadReciente.raiz,
    ]) {
      expect(clavesInvalidadas).toContainEqual(clave)
    }
  })

  it('con protegidos el resultado dice cuántos se conservaron', async () => {
    rpcResponde(simulacion({ total: 5, borrables: 3, protegidos: 2 }), confirmacion({ borrados: 3, protegidos: 2 }))
    mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Eliminar 3 leads' }))

    await screen.findByText('Se deshizo la importación')
    expect(screen.getByRole('status').textContent).toBe(
      'Se eliminaron 3 leads. 2 se conservaron porque ya tenían actividad.',
    )
  })

  it('en singular', async () => {
    rpcResponde(simulacion({ total: 2, borrables: 1, protegidos: 1 }), confirmacion({ borrados: 1, protegidos: 1 }))
    mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Eliminar 1 lead' }))

    await screen.findByText('Se deshizo la importación')
    expect(screen.getByRole('status').textContent).toBe('Se eliminó 1 lead. 1 se conservó porque ya tenía actividad.')
  })

  it('un error de la base al confirmar se muestra en el diálogo, que no se cierra, y se puede reintentar', async () => {
    rpcResponde(simulacion(), {
      data: null,
      error: { code: 'P0001', message: 'No se pudo revertir toda la importación: no se borró nada.' },
    })
    mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Eliminar 3 leads' }))

    expect((await within(dialogo).findByRole('alert')).textContent).toBe(
      'No se pudo revertir toda la importación: no se borró nada.',
    )
    expect(dialogo.hasAttribute('open')).toBe(true)
    expect(screen.queryByText('Se deshizo la importación')).toBeNull()
    expect(botonDeshacer()).toBeTruthy()
    expect((within(dialogo).getByRole('button', { name: 'Eliminar 3 leads' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('un fallo sin mensaje de la base usa el texto de la pantalla', async () => {
    rpcResponde(simulacion(), { data: null, error: { code: '57014', message: 'canceling statement' } })
    mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Eliminar 3 leads' }))

    expect((await within(dialogo).findByRole('alert')).textContent).toBe('No se pudo deshacer la importación.')
  })

  it('una respuesta que no tiene la forma esperada es un error, no un éxito', async () => {
    rpcResponde(simulacion(), { data: { borrados: 'tres' }, error: null })
    mostrar()

    const dialogo = await abrirDialogo()
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Eliminar 3 leads' }))

    expect(await within(dialogo).findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Se deshizo la importación')).toBeNull()
  })

  it('mientras elimina: botones deshabilitados y un doble clic no duplica la llamada', async () => {
    let resolver: (v: unknown) => void = () => {}
    rpc.mockImplementation((_nombre: string, args: { p_confirmar: boolean }) =>
      args.p_confirmar ? new Promise((r) => (resolver = r)) : Promise.resolve(simulacion()),
    )
    mostrar()

    const dialogo = await abrirDialogo()
    const eliminar = await within(dialogo).findByRole('button', { name: 'Eliminar 3 leads' })
    fireEvent.click(eliminar)
    fireEvent.click(eliminar)
    fireEvent.click(eliminar)

    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Eliminando…' })).toBeTruthy())
    expect((within(dialogo).getByRole('button', { name: 'Eliminando…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(dialogo).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    // Una simulación y una sola confirmación.
    expect(rpc.mock.calls.filter(([, args]) => args.p_confirmar === true)).toHaveLength(1)

    await act(async () => resolver(confirmacion()))
    await screen.findByText('Se deshizo la importación')
    expect(rpc.mock.calls.filter(([, args]) => args.p_confirmar === true)).toHaveLength(1)
  })
})
