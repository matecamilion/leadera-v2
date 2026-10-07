import type { QueryKey } from '@tanstack/react-query'

/**
 * Todas las claves de React Query, en un solo lugar.
 *
 * Convención: `[dominio, ...subclave, uid, ...params]`.
 *
 * El uid del usuario logueado va en toda clave con datos de la cuenta: el cache
 * vive en memoria y sobrevive a un cambio de sesión en la misma pestaña, así que
 * sin él el siguiente que entra podría leer lo que dejó el anterior —fresco por
 * `staleTime` o como placeholder— antes de que la base llegue a filtrar nada.
 * `AuthProvider` además vacía el cache cuando cambia el usuario; la clave es la
 * segunda capa, para lo que escribe una mutación que termina después del logout.
 *
 * El uid va DESPUÉS del dominio y su subclave, nunca antes: así las
 * invalidaciones por prefijo (`claves.leads.raiz`, `claves.tareas.raiz`, …)
 * siguen alcanzando a todo el dominio sin saber de qué usuario es. Lo que sí
 * necesita el uid es cualquier lectura o escritura exacta —`setQueryData`,
 * `getQueryData`, `removeQueries`, o invalidar una ficha puntual—.
 *
 * Cada entrada de primer nivel es una raíz: dos claves que no comparten raíz no
 * se alcanzan entre sí con una invalidación por prefijo.
 */

type Uid = string | undefined

export const claves = {
  actividadReciente: {
    raiz: ['actividad-reciente'] as const,
    resumen: (uid: Uid) => ['actividad-reciente', uid] as const,
  },

  /** Todo lo del panel cuelga de `raiz`. */
  admin: {
    raiz: ['admin'] as const,
    panel: (uid: Uid) => ['admin', 'panel', uid] as const,
    metricas: (uid: Uid, inmobiliariaId: string | undefined) =>
      ['admin', 'metricas', uid, inmobiliariaId] as const,
    cobros: (uid: Uid, inmobiliariaId: string | undefined) =>
      ['admin', 'cobros', uid, inmobiliariaId] as const,
  },

  /** Clave propia y no colgada del lead: el perfil no cambia cuando cambia el lead. */
  agente: {
    raiz: ['agente'] as const,
    nombre: (uid: Uid, agenteId: string | null | undefined) =>
      ['agente', uid, agenteId] as const,
  },

  busqueda: {
    raiz: ['busqueda'] as const,
    criterios: (uid: Uid, busquedaId: string | null | undefined) =>
      ['busqueda', uid, busquedaId] as const,
  },

  busquedasDeLead: {
    raiz: ['busquedas-de-lead'] as const,
    deLead: (uid: Uid, leadId: string | null) => ['busquedas-de-lead', uid, leadId] as const,
  },

  coincidenciasBusqueda: {
    raiz: ['coincidencias-busqueda'] as const,
    deBusqueda: (uid: Uid, busquedaId: string) =>
      ['coincidencias-busqueda', uid, busquedaId] as const,
  },

  /** Compradores donde encaja algo que se ofrece (`buscar_compradores`). */
  compradoresParaOferta: {
    raiz: ['compradores-para-oferta'] as const,
    deCriterios: (uid: Uid, criterios: unknown) =>
      ['compradores-para-oferta', uid, criterios] as const,
  },

  /** Zonas ya usadas en propiedades y búsquedas, para sugerir al tipear. */
  zonasConocidas: {
    raiz: ['zonas-conocidas'] as const,
    todas: (uid: Uid) => ['zonas-conocidas', uid] as const,
  },

  /** Resumen de búsquedas activas: el estado inicial de Coincidencias. */
  demandaActiva: {
    raiz: ['demanda-activa'] as const,
    resumen: (uid: Uid) => ['demanda-activa', uid] as const,
  },

  coincidenciasInternas: {
    raiz: ['coincidencias-internas'] as const,
    dePropiedad: (uid: Uid, propiedadId: string | undefined) =>
      ['coincidencias-internas', uid, propiedadId] as const,
  },

  /**
   * Bandeja de consultas del link público. Las mutaciones invalidan `raiz`, que
   * alcanza a la lista, al badge de la navegación y a la tarjeta de Mi día.
   */
  consultas: {
    raiz: ['consultas'] as const,
    lista: (uid: Uid, filtro: string, agenteId: string, page: number) =>
      ['consultas', 'lista', uid, filtro, agenteId, page] as const,
    volvieron: (uid: Uid, agenteId: string) => ['consultas', 'volvieron', uid, agenteId] as const,
    pendientes: (uid: Uid, rol: string | undefined) =>
      ['consultas', 'pendientes', uid, rol] as const,
    resumen: (uid: Uid, rol: string | undefined) => ['consultas', 'resumen', uid, rol] as const,
    deLead: (uid: Uid, leadId: string) => ['consultas', 'de-lead', uid, leadId] as const,
  },

  dashboard: {
    raiz: ['dashboard'] as const,
    coincidencias: (uid: Uid) => ['dashboard', 'coincidencias', uid] as const,
  },

  detalleMatch: {
    raiz: ['detalle-match'] as const,
    detalle: (uid: Uid, busquedaId: string | undefined, propiedadId: string | undefined) =>
      ['detalle-match', uid, busquedaId, propiedadId] as const,
  },

  /** Todo lo del equipo cuelga de `raiz`, para invalidarlo de una. */
  equipo: {
    raiz: ['equipo'] as const,
    miembros: (uid: Uid, rol: string | undefined, miId: string | undefined) =>
      ['equipo', 'miembros', uid, rol, miId] as const,
    cupo: (uid: Uid, inmobiliariaId: string | undefined) =>
      ['equipo', 'cupo', uid, inmobiliariaId] as const,
    stats: (uid: Uid) => ['equipo', 'stats', uid] as const,
    leads: (uid: Uid, page: number) => ['equipo', 'leads', uid, page] as const,
    invitaciones: (uid: Uid) => ['equipo', 'invitaciones', uid] as const,
    resumenCupo: (uid: Uid) => ['equipo', 'resumen-cupo', uid] as const,
  },

  googleCalendar: {
    raiz: ['google-calendar'] as const,
    conexion: (uid: Uid) => ['google-calendar', uid] as const,
  },

  /**
   * `raiz` alcanza al historial del lead y al timeline de la operación: los
   * eventos de una operación son interacciones con `operacion_id`, así que lo
   * que invalida uno refresca el otro sin wiring extra.
   */
  interacciones: {
    raiz: ['interacciones'] as const,
    deLead: (uid: Uid, leadId: string) => ['interacciones', uid, leadId] as const,
    deOperacion: (uid: Uid, operacionId: string) =>
      ['interacciones', 'de-operacion', uid, operacionId] as const,
  },

  interaccionesPorLead: {
    raiz: ['interacciones-por-lead'] as const,
    resumen: (uid: Uid, ids: string) => ['interacciones-por-lead', 'resumen', uid, ids] as const,
  },

  /** La ficha de un lead. */
  lead: {
    raiz: ['lead'] as const,
    detalle: (uid: Uid, id: string) => ['lead', uid, id] as const,
  },

  leadResumido: {
    raiz: ['lead-resumido'] as const,
    porId: (uid: Uid, id: string | null) => ['lead-resumido', uid, id] as const,
  },

  /**
   * Listado, contador del chip "Todos" y los cortes de Mi día. Los del día
   * cuelgan de acá y no de `dashboard` a propósito: registrar una interacción ya
   * invalida `raiz`, y eso saca al lead de las secciones sin más wiring.
   */
  leads: {
    raiz: ['leads'] as const,
    listado: (uid: Uid, filtro: string, rol: string, busqueda: string, page: number) =>
      ['leads', uid, filtro, rol, busqueda, page] as const,
    total: (uid: Uid, rol: string, busqueda: string) =>
      ['leads', 'total', uid, rol, busqueda] as const,
    delDia: (uid: Uid) => ['leads', 'del-dia', uid] as const,
    contactadosHoy: (uid: Uid) => ['leads', 'contactados-hoy', uid] as const,
    /** Conteo para el badge del menú. Bajo `leads`: lo refresca cualquier invalidación de leads. */
    nuevos: (uid: Uid) => ['leads', 'nuevos', uid] as const,
  },

  leadsCombobox: {
    raiz: ['leads-combobox'] as const,
    busqueda: (uid: Uid, busqueda: string) => ['leads-combobox', uid, busqueda] as const,
  },

  /**
   * El flag va por inmobiliaria y los resúmenes por agente. Registrar una
   * interacción o marcar una visita realizada invalida `resumen`, que alcanza
   * también al detalle.
   */
  /**
   * El link público de consultas del agente: el general (`'general'`) o el de
   * una propiedad. Raíz propia y no colgada de `consultas`: aceptar o descartar
   * una consulta no cambia el link.
   */
  linksConsulta: {
    raiz: ['links-consulta'] as const,
    mio: (uid: Uid, propiedadId: string) => ['links-consulta', uid, propiedadId] as const,
  },

  modeloGestion: {
    raiz: ['modelo-gestion'] as const,
    activo: (uid: Uid, inmobiliariaId: string | undefined) =>
      ['modelo-gestion', 'activo', uid, inmobiliariaId] as const,
    /** Prefijo de resúmenes y detalles: lo que invalidan las mutaciones. */
    resumen: (uid: Uid) => ['modelo-gestion', 'resumen', uid] as const,
    /**
     * `hoy` (hora argentina) va en la clave para que pasada la medianoche el
     * día y la semana se pidan de nuevo en vez de servir los de ayer.
     * `referencia` null es el período en curso.
     */
    periodo: (uid: Uid, periodo: string, hoy: string, referencia: string | null = null) =>
      ['modelo-gestion', 'resumen', uid, periodo, hoy, referencia ?? 'actual'] as const,
    /** Las filas de una métrica. Bajo `resumen` para que la misma invalidación lo alcance. */
    detalle: (uid: Uid, metrica: string, periodo: string, hoy: string, referencia: string | null) =>
      ['modelo-gestion', 'resumen', uid, 'detalle', metrica, periodo, hoy, referencia ?? 'actual'] as const,
  },

  /** La ficha de una operación. */
  operacion: {
    raiz: ['operacion'] as const,
    detalle: (uid: Uid, id: string) => ['operacion', uid, id] as const,
  },

  operaciones: {
    raiz: ['operaciones'] as const,
    listado: (uid: Uid, tipo: string, estado: string, busqueda: string, page: number) =>
      ['operaciones', uid, tipo, estado, busqueda, page] as const,
    enCurso: (uid: Uid, limit: number) => ['operaciones', 'en-curso', uid, limit] as const,
    kanban: (uid: Uid) => ['operaciones', 'kanban', uid] as const,
  },

  /**
   * Dos formas distintas bajo la misma raíz: la tab de la ficha (array de UN
   * lead) y los resúmenes del listado (Map por lead). La subclave las separa
   * —compartir entrada ya rompió el listado una vez— y la raíz común hace que
   * una sola invalidación alcance a las dos.
   */
  operacionesPorLead: {
    raiz: ['operaciones-por-lead'] as const,
    deLead: (uid: Uid, leadId: string | null | undefined) =>
      ['operaciones-por-lead', uid, leadId] as const,
    resumen: (uid: Uid, ids: string) => ['operaciones-por-lead', 'resumen', uid, ids] as const,
    rol: (uid: Uid, ids: string) => ['operaciones-por-lead', 'rol', uid, ids] as const,
  },

  operacionesPorPropiedad: {
    raiz: ['operaciones-por-propiedad'] as const,
    dePropiedad: (uid: Uid, propiedadId: string | null | undefined) =>
      ['operaciones-por-propiedad', uid, propiedadId] as const,
  },

  perfil: {
    raiz: ['perfil'] as const,
    metricas: (uid: Uid) => ['perfil', 'metricas', uid] as const,
    embudo: (uid: Uid) => ['perfil', 'embudo', uid] as const,
    evolucion: (uid: Uid, periodo: string) => ['perfil', 'evolucion', uid, periodo] as const,
  },

  /** La ficha de una propiedad. */
  propiedad: {
    raiz: ['propiedad'] as const,
    detalle: (uid: Uid, id: string) => ['propiedad', uid, id] as const,
  },

  propiedadResumida: {
    raiz: ['propiedad-resumida'] as const,
    porId: (uid: Uid, id: string | null) => ['propiedad-resumida', uid, id] as const,
  },

  propiedades: {
    raiz: ['propiedades'] as const,
    listado: (uid: Uid, filtros: unknown, page: number) =>
      ['propiedades', 'listado', uid, filtros, page] as const,
    porLead: (uid: Uid, leadId: string | undefined) =>
      ['propiedades', 'por-lead', uid, leadId] as const,
    recientes: (uid: Uid, limit: number) => ['propiedades', 'recientes', uid, limit] as const,
  },

  propiedadesCombobox: {
    raiz: ['propiedades-combobox'] as const,
    busqueda: (uid: Uid, busqueda: string) => ['propiedades-combobox', uid, busqueda] as const,
  },

  reporteSemanal: {
    raiz: ['reporte-semanal'] as const,
    activo: (uid: Uid) => ['reporte-semanal', uid] as const,
  },

  /** Todo lo de la suscripción cuelga de `raiz`. */
  suscripcion: {
    raiz: ['suscripcion'] as const,
    /**
     * Sin uid a propósito: son los precios de lista, iguales para todas las
     * cuentas. Igual se van con el resto al vaciar el cache en un logout.
     */
    precios: () => ['suscripcion', 'precios'] as const,
    estado: (uid: Uid, inmobiliariaId: string | undefined) =>
      ['suscripcion', 'estado', uid, inmobiliariaId] as const,
    pagos: (uid: Uid, inmobiliariaId: string | undefined) =>
      ['suscripcion', 'pagos', uid, inmobiliariaId] as const,
  },

  /**
   * Todo lo del calendario cuelga de `raiz`, para invalidarlo de una. Las
   * tareas de un lead también: el `onSettled` de completar, eliminar y crear
   * invalida la raíz entera, así que el panel de la ficha se refresca solo.
   */
  tareas: {
    raiz: ['tareas'] as const,
    eventos: (uid: Uid, desde: string, hasta: string) =>
      ['tareas', 'eventos', uid, desde, hasta] as const,
    porLead: (uid: Uid, leadId: string) => ['tareas', 'por-lead', uid, leadId] as const,
  },

  usoRecursos: {
    raiz: ['uso-recursos'] as const,
    dePlan: (uid: Uid, plan: string | null) => ['uso-recursos', uid, plan] as const,
  },

  /**
   * Las visitas sueltas y sus agregados cuelgan de `raiz`: todo lo que ya la
   * invalida —crear, marcar realizada, cancelar, eliminar— los recalcula. El
   * calendario unificado cuelga de `tareas`.
   */
  visitas: {
    raiz: ['visitas'] as const,
    rango: (uid: Uid, desde: string, hasta: string) => ['visitas', uid, desde, hasta] as const,
    estadisticasPropiedad: (uid: Uid, propiedadId: string) =>
      ['visitas', 'estadisticas-propiedad', uid, propiedadId] as const,
    porLead: (uid: Uid, leadId: string) => ['visitas', 'por-lead', uid, leadId] as const,
  },
}

/**
 * `placeholderData` que mantiene el resultado anterior —para que una tabla no
 * parpadee al paginar o tipear— pero sólo si era del mismo usuario.
 *
 * El `(anterior) => anterior` pelado no alcanza aunque el cache se vacíe al
 * cambiar de sesión: el observer guarda su propia referencia a la última query
 * con datos, y si el componente sigue montado durante el cambio —login con otra
 * cuenta en otra pestaña, por ejemplo— mostraría la lista del usuario anterior
 * mientras carga la del nuevo.
 */
export function anteriorDelMismoUsuario(uid: Uid) {
  return <T>(anterior: T | undefined, consulta?: { queryKey: QueryKey }): T | undefined =>
    uid && consulta?.queryKey.includes(uid) ? anterior : undefined
}
