/**
 * Traduce errores del servidor a algo que se pueda leer en pantalla.
 *
 * La validación de los formularios frena casi todo antes de salir, pero la base
 * tiene la última palabra: si un dato llega igual —otra pestaña, un reintento
 * con datos viejos, un camino que no pasa por el form— el usuario recibiría el
 * texto crudo de Postgres. Acá se convierte en una frase.
 */

/**
 * Fragmento que aparece en el error → frase para el usuario.
 *
 * Antes se llamaba POR_CONSTRAINT porque sólo tenía nombres de constraints,
 * pero el mecanismo siempre fue "¿el texto del error contiene esto?". Ahora
 * también entra el texto de un `raise exception`, que no es un constraint.
 */
const POR_TEXTO: Record<string, string> = {
  // --- raise exception de las funciones RPC ---
  // Las de estadísticas lanzan esto cuando el id no es de tu inmobiliaria. No
  // se aclara de quién es el dato: quien no tiene acceso tampoco tiene por qué
  // enterarse de que existe.
  'No autorizado': 'No tenés acceso a esta información.',

  // --- constraints de la base ---
  precio_positivo: 'El precio tiene que ser 1 o más.',
  ambientes_positivo: 'La cantidad de ambientes tiene que ser 1 o más.',
  // La columna sigue siendo `metros_cuadrados`; en pantalla es "Metros totales".
  metros_positivo: 'Los metros totales tienen que ser 1 o más.',
  metros_cubiertos_positivo: 'Los metros cubiertos tienen que ser 1 o más.',
  // En estos tres el 0 es un dato válido: lo que se rechaza es el negativo.
  banos_no_negativo: 'Los baños no pueden ser negativos.',
  cocheras_no_negativo: 'Las cocheras no pueden ser negativas.',
  expensas_no_negativa: 'Las expensas no pueden ser negativas.',
  monto_positivo: 'El monto tiene que ser 1 o más.',
  // Constraint nuevo de `operaciones`: acá el piso es 0, no 1.
  operaciones_monto_no_negativo: 'El monto no puede ser negativo.',
}

/**
 * Con esto abren los triggers de cuota de `planes_limites_recursos`.
 *
 * Se busca el texto y no el código P0001 porque la capa de API envuelve el
 * error de Supabase en un `Error` pelado: el `code` queda por el camino y a la
 * UI le llega sólo el mensaje. Mismo criterio que `esPaginaFueraDeRango`.
 */
const INICIO_LIMITE_DE_PLAN = 'Llegaste al límite de'

/** Qué hacer al respecto. El trigger dice qué pasó; esto, cómo salir. */
const SALIDA_LIMITE_DE_PLAN = 'Para seguir cargando, cambiá a un plan con más capacidad.'

/**
 * Con esto abre `proteger_operacion_cerrada` cuando falta el monto.
 *
 * Otro P0001 con el texto ya redactado para leerse. Se busca por el fragmento y
 * no por la frase entera para no depender de cómo termine la oración.
 */
const INICIO_CIERRE_SIN_MONTO = 'No se puede cerrar como ganada'

/** Con esto abre `crear_propiedad_con_operacion` cuando falta el propietario. */
const INICIO_OPERACION_SIN_PROPIETARIO = 'No se puede crear la operación sin'

/**
 * Los mensajes que la base ya redacta para leerse en pantalla.
 *
 * De todos se recorta el prefijo que antepone la capa de API ("No se pudo crear
 * la propiedad: ") y se muestra el resto tal cual: encabezar con un "no se
 * pudo" antes del motivo lo hace sonar a falla del sistema en vez de a una
 * condición que el usuario puede resolver.
 */
const MENSAJES_YA_REDACTADOS = [
  INICIO_CIERRE_SIN_MONTO,
  INICIO_OPERACION_SIN_PROPIETARIO,
]

/**
 * ¿El alta la rechazó una cuota del plan?
 *
 * Lo usan los formularios para acompañar el mensaje con el link a los planes:
 * es el único error de guardado que no se arregla corrigiendo el formulario.
 */
export function esLimiteDePlan(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes(INICIO_LIMITE_DE_PLAN)
}

/**
 * Mensaje para mostrar cuando algo falla contra la base, al guardar o al leer.
 *
 * `respaldo` es lo que se muestra cuando el error no es uno de los conocidos:
 * conviene que sea específico de la pantalla ("No se pudo crear el lead").
 */
export function mensajeDeError(error: unknown, respaldo: string): string {
  if (!(error instanceof Error)) return respaldo
  return mensajeDeNegocio(error.message) ?? error.message ?? respaldo
}

/**
 * El mensaje legible que le corresponde a un texto de error, o `null` si no es
 * ninguno de los conocidos.
 *
 * Separado de `mensajeDeError` para que `interpretarErrorSupabase` —que corre
 * en la capa de API, donde todavía existe el `code` de Postgres— pueda
 * preguntar "¿esto es un mensaje de negocio?" sin heredar el respaldo, que
 * devuelve el texto crudo. Las dos entradas comparten estas reglas en vez de
 * tener cada una su copia.
 */
export function mensajeDeNegocio(texto: string): string | null {

  // El trigger ya redacta el motivo con el número exacto del plan, así que se
  // deja tal cual y sólo se le agrega la salida. Se recorta desde el fragmento
  // para descartar el prefijo que le antepone la capa de API ("No se pudo crear
  // el lead: "): encabezar con un "no se pudo" antes del motivo lo hace sonar a
  // falla del sistema y no a un tope que el usuario puede levantar.
  const desdeLimite = texto.indexOf(INICIO_LIMITE_DE_PLAN)
  if (desdeLimite !== -1) {
    return `${texto.slice(desdeLimite).trim()} ${SALIDA_LIMITE_DE_PLAN}`
  }

  for (const inicio of MENSAJES_YA_REDACTADOS) {
    const desde = texto.indexOf(inicio)
    if (desde !== -1) return texto.slice(desde).trim()
  }

  for (const [fragmento, mensaje] of Object.entries(POR_TEXTO)) {
    if (texto.includes(fragmento)) return mensaje
  }

  // Los triggers de fecha ya levantan la excepción con un texto pensado para
  // leerse; se deja pasar tal cual en vez de reescribirlo acá.
  if (texto.includes('fecha pasada')) return texto

  // 23514 sin nombre reconocido: al menos no mostrar el volcado de Postgres.
  if (texto.includes('violates check constraint')) {
    return 'Alguno de los datos no cumple con lo que acepta el sistema. Revisá los valores cargados.'
  }

  return null
}

/**
 * ¿El error es el 416 de un `?page=` que apunta más allá del último resultado?
 *
 * PostgREST contesta `416 Range Not Satisfiable` cuando el offset del `.range()`
 * cae después de la última fila —un `?page=` tipeado a mano, un bookmark viejo,
 * o datos que encogieron desde que se guardó el link—.
 *
 * Se mira el texto y no el código porque la capa de API envuelve el error de
 * Supabase en un `Error` pelado: el `code` (PGRST103) y el status quedan por el
 * camino y a la UI le llega sólo el mensaje. Se busca el fragmento y no la
 * frase entera para no depender del prefijo que le agrega cada `listar*`.
 *
 * Importa que sea específico. Este error no se arregla reintentando —la base va
 * a contestar lo mismo— y la única salida es volver a una página que exista;
 * una caída de red es al revés, y mandar ahí al usuario a la página 1 sería
 * llevarlo al lugar equivocado.
 */
export function esPaginaFueraDeRango(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /range not satisfiable/i.test(error.message)
}

/** Lo que se muestra cuando el listado falló por algo que no reconocemos. */
const MENSAJE_LISTADO_GENERICO =
  'No pudimos cargar los datos. Probá de nuevo en unos segundos.'

/**
 * Mensaje para un listado que no cargó. Siempre en español y siempre nuestro.
 *
 * A diferencia de `mensajeDeError`, esta NUNCA devuelve el texto del servidor:
 * un listado que falla no le da al usuario ningún dato accionable con el que
 * corregir algo —no hay un formulario que ajustar—, así que mostrarle
 * "Requested range not satisfiable" es ruido en inglés y nada más. Lo que sí
 * sirve es decirle qué pasó y, cuando la hay, ofrecerle la salida.
 *
 * El caso del `?page=` fuera de rango se nombra aparte porque tiene arreglo de
 * un click; el resto cae en el genérico, que invita a reintentar porque casi
 * siempre es un problema de red que se va solo.
 */
export function mensajeDeListado(error: unknown): string {
  if (esPaginaFueraDeRango(error)) {
    return 'Esta página ya no tiene resultados con los filtros actuales.'
  }

  // Los conocidos del catálogo sí sirven leídos: "No autorizado" le explica al
  // usuario por qué no ve nada, y eso no lo dice el genérico.
  if (error instanceof Error) {
    for (const [fragmento, mensaje] of Object.entries(POR_TEXTO)) {
      if (error.message.includes(fragmento)) return mensaje
    }
  }

  return MENSAJE_LISTADO_GENERICO
}

/**
 * Alias histórico de `mensajeDeError`, para los formularios.
 *
 * El nombre nació cuando esto sólo traducía fallas de guardado; ahora también
 * lo usan pantallas de lectura, que no "guardan" nada.
 */
export function mensajeDeGuardado(error: unknown, respaldo: string): string {
  return mensajeDeError(error, respaldo)
}
