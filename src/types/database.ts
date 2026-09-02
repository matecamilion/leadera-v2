/**
 * Tipos generados desde el esquema de Supabase. NO editar a mano.
 * Regenerar con:
 *   supabase gen types typescript --project-id gnnowyphlxebdxbfsmss > src/types/database.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      busquedas: {
        Row: {
          activa: boolean
          agente_id: string | null
          ambientes_min: number | null
          banos_min: number | null
          cocheras_min: number | null
          created_at: string
          expensas_max: number | null
          id: string
          inmobiliaria_id: string
          lead_id: string
          m2_min: number | null
          notas: string | null
          precio_max: number | null
          precio_min: number | null
          tipo_propiedad: Database["public"]["Enums"]["tipo_propiedad"] | null
          updated_at: string
          zona: string | null
        }
        Insert: {
          activa?: boolean
          agente_id?: string | null
          ambientes_min?: number | null
          banos_min?: number | null
          cocheras_min?: number | null
          created_at?: string
          expensas_max?: number | null
          id?: string
          inmobiliaria_id: string
          lead_id: string
          m2_min?: number | null
          notas?: string | null
          precio_max?: number | null
          precio_min?: number | null
          tipo_propiedad?: Database["public"]["Enums"]["tipo_propiedad"] | null
          updated_at?: string
          zona?: string | null
        }
        Update: {
          activa?: boolean
          agente_id?: string | null
          ambientes_min?: number | null
          banos_min?: number | null
          cocheras_min?: number | null
          created_at?: string
          expensas_max?: number | null
          id?: string
          inmobiliaria_id?: string
          lead_id?: string
          m2_min?: number | null
          notas?: string | null
          precio_max?: number | null
          precio_min?: number | null
          tipo_propiedad?: Database["public"]["Enums"]["tipo_propiedad"] | null
          updated_at?: string
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "busquedas_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "busquedas_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "busquedas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      inmobiliarias: {
        Row: {
          created_at: string
          id: string
          limite_usuarios: number
          nombre: string
        }
        Insert: {
          created_at?: string
          id?: string
          limite_usuarios?: number
          nombre: string
        }
        Update: {
          created_at?: string
          id?: string
          limite_usuarios?: number
          nombre?: string
        }
        Relationships: []
      }
      interacciones: {
        Row: {
          agente_id: string
          created_at: string
          detalle: string | null
          fecha: string
          id: string
          lead_id: string
          operacion_id: string | null
          tipo: Database["public"]["Enums"]["tipo_interaccion"]
        }
        Insert: {
          agente_id: string
          created_at?: string
          detalle?: string | null
          fecha?: string
          id?: string
          lead_id: string
          operacion_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_interaccion"]
        }
        Update: {
          agente_id?: string
          created_at?: string
          detalle?: string | null
          fecha?: string
          id?: string
          lead_id?: string
          operacion_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_interaccion"]
        }
        Relationships: [
          {
            foreignKeyName: "interacciones_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          asiste_a: string | null
          creado_por: string
          created_at: string
          expira_at: string
          id: string
          inmobiliaria_id: string
          rol: Database["public"]["Enums"]["rol_agente"]
          token: string
          usado: boolean
          usado_por: string | null
        }
        Insert: {
          asiste_a?: string | null
          creado_por: string
          created_at?: string
          expira_at?: string
          id?: string
          inmobiliaria_id: string
          rol: Database["public"]["Enums"]["rol_agente"]
          token?: string
          usado?: boolean
          usado_por?: string | null
        }
        Update: {
          asiste_a?: string | null
          creado_por?: string
          created_at?: string
          expira_at?: string
          id?: string
          inmobiliaria_id?: string
          rol?: Database["public"]["Enums"]["rol_agente"]
          token?: string
          usado?: boolean
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_asiste_a_fkey"
            columns: ["asiste_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agente_id: string | null
          apellido: string | null
          created_at: string
          descripcion_inicial: string | null
          email: string | null
          estado: Database["public"]["Enums"]["estado_lead"] | null
          fecha_ingreso: string
          fecha_primer_contacto_real: string | null
          fecha_proximo_seguimiento: string | null
          fecha_ultimo_contacto_real: string | null
          id: string
          inmobiliaria_id: string
          nombre: string
          origen: Database["public"]["Enums"]["origen_lead"]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          agente_id?: string | null
          apellido?: string | null
          created_at?: string
          descripcion_inicial?: string | null
          email?: string | null
          estado?: Database["public"]["Enums"]["estado_lead"] | null
          fecha_ingreso?: string
          fecha_primer_contacto_real?: string | null
          fecha_proximo_seguimiento?: string | null
          fecha_ultimo_contacto_real?: string | null
          id?: string
          inmobiliaria_id: string
          nombre: string
          origen?: Database["public"]["Enums"]["origen_lead"]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          agente_id?: string | null
          apellido?: string | null
          created_at?: string
          descripcion_inicial?: string | null
          email?: string | null
          estado?: Database["public"]["Enums"]["estado_lead"] | null
          fecha_ingreso?: string
          fecha_primer_contacto_real?: string | null
          fecha_proximo_seguimiento?: string | null
          fecha_ultimo_contacto_real?: string | null
          id?: string
          inmobiliaria_id?: string
          nombre?: string
          origen?: Database["public"]["Enums"]["origen_lead"]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      operaciones: {
        Row: {
          agente_id: string | null
          busqueda_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_operacion"]
          fecha_cierre: string | null
          fecha_proximo_seguimiento: string | null
          id: string
          inmobiliaria_id: string
          lead_id: string | null
          moneda: string
          monto: number | null
          notas: string | null
          propiedad_id: string | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          titulo: string | null
          updated_at: string
        }
        Insert: {
          agente_id?: string | null
          busqueda_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_operacion"]
          fecha_cierre?: string | null
          fecha_proximo_seguimiento?: string | null
          id?: string
          inmobiliaria_id: string
          lead_id?: string | null
          moneda?: string
          monto?: number | null
          notas?: string | null
          propiedad_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_operacion"]
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          agente_id?: string | null
          busqueda_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_operacion"]
          fecha_cierre?: string | null
          fecha_proximo_seguimiento?: string | null
          id?: string
          inmobiliaria_id?: string
          lead_id?: string | null
          moneda?: string
          monto?: number | null
          notas?: string | null
          propiedad_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_operacion"]
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operaciones_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_busqueda_id_fkey"
            columns: ["busqueda_id"]
            isOneToOne: false
            referencedRelation: "busquedas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string
          asiste_a: string | null
          created_at: string
          email: string
          id: string
          inmobiliaria_id: string
          meta_mensual_ganados: number
          nombre: string
          rol: Database["public"]["Enums"]["rol_agente"]
        }
        Insert: {
          activo?: boolean
          apellido: string
          asiste_a?: string | null
          created_at?: string
          email: string
          id: string
          inmobiliaria_id: string
          meta_mensual_ganados?: number
          nombre: string
          rol?: Database["public"]["Enums"]["rol_agente"]
        }
        Update: {
          activo?: boolean
          apellido?: string
          asiste_a?: string | null
          created_at?: string
          email?: string
          id?: string
          inmobiliaria_id?: string
          meta_mensual_ganados?: number
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_agente"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_asiste_a_fkey"
            columns: ["asiste_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas: {
        Row: {
          asignado_a: string
          completada_en: string | null
          created_at: string
          creado_por: string
          descripcion: string | null
          estado: EstadoTarea
          fecha: string
          hora: string | null
          id: string
          inmobiliaria_id: string
          lead_id: string | null
          operacion_id: string | null
          propiedad_id: string | null
          serie_id: string | null
          titulo: string
        }
        Insert: {
          asignado_a: string
          completada_en?: string | null
          created_at?: string
          creado_por: string
          descripcion?: string | null
          estado?: EstadoTarea
          fecha: string
          hora?: string | null
          id?: string
          inmobiliaria_id: string
          lead_id?: string | null
          operacion_id?: string | null
          propiedad_id?: string | null
          serie_id?: string | null
          titulo: string
        }
        Update: {
          asignado_a?: string
          completada_en?: string | null
          created_at?: string
          creado_por?: string
          descripcion?: string | null
          estado?: EstadoTarea
          fecha?: string
          hora?: string | null
          id?: string
          inmobiliaria_id?: string
          lead_id?: string | null
          operacion_id?: string | null
          propiedad_id?: string | null
          serie_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "tareas_series"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas_series: {
        Row: {
          created_at: string
          hasta: string
          id: string
          inmobiliaria_id: string
          recurrencia: Recurrencia
        }
        Insert: {
          created_at?: string
          hasta: string
          id?: string
          inmobiliaria_id: string
          recurrencia: Recurrencia
        }
        Update: {
          created_at?: string
          hasta?: string
          id?: string
          inmobiliaria_id?: string
          recurrencia?: Recurrencia
        }
        Relationships: []
      }
      visitas: {
        Row: {
          asignado_a: string
          created_at: string
          creado_por: string
          estado: EstadoVisita
          fecha: string
          hora: string | null
          id: string
          inmobiliaria_id: string
          lead_id: string | null
          notas: string | null
          operacion_id: string | null
          propiedad_id: string
        }
        Insert: {
          asignado_a: string
          created_at?: string
          creado_por: string
          estado?: EstadoVisita
          fecha: string
          hora?: string | null
          id?: string
          inmobiliaria_id: string
          lead_id?: string | null
          notas?: string | null
          operacion_id?: string | null
          propiedad_id: string
        }
        Update: {
          asignado_a?: string
          created_at?: string
          creado_por?: string
          estado?: EstadoVisita
          fecha?: string
          hora?: string | null
          id?: string
          inmobiliaria_id?: string
          lead_id?: string | null
          notas?: string | null
          operacion_id?: string | null
          propiedad_id?: string
        }
        Relationships: []
      }
      propiedades: {
        Row: {
          agente_id: string | null
          ambientes: number | null
          banos: number | null
          cocheras: number | null
          created_at: string
          descripcion: string | null
          direccion: string
          disposicion: Database["public"]["Enums"]["disposicion_propiedad"] | null
          estado: Database["public"]["Enums"]["estado_propiedad"]
          expensas: number | null
          fotos_urls: string[]
          id: string
          inmobiliaria_id: string
          lead_propietario_id: string | null
          link_portal: string | null
          metros_cuadrados: number | null
          metros_cubiertos: number | null
          moneda: string
          precio: number | null
          tipo: Database["public"]["Enums"]["tipo_propiedad"]
          updated_at: string
          zona: string | null
        }
        Insert: {
          agente_id?: string | null
          ambientes?: number | null
          banos?: number | null
          cocheras?: number | null
          created_at?: string
          descripcion?: string | null
          direccion: string
          disposicion?: Database["public"]["Enums"]["disposicion_propiedad"] | null
          estado?: Database["public"]["Enums"]["estado_propiedad"]
          expensas?: number | null
          fotos_urls?: string[]
          id?: string
          inmobiliaria_id: string
          lead_propietario_id?: string | null
          link_portal?: string | null
          metros_cuadrados?: number | null
          metros_cubiertos?: number | null
          moneda?: string
          precio?: number | null
          tipo?: Database["public"]["Enums"]["tipo_propiedad"]
          updated_at?: string
          zona?: string | null
        }
        Update: {
          agente_id?: string | null
          ambientes?: number | null
          banos?: number | null
          cocheras?: number | null
          created_at?: string
          descripcion?: string | null
          direccion?: string
          disposicion?: Database["public"]["Enums"]["disposicion_propiedad"] | null
          estado?: Database["public"]["Enums"]["estado_propiedad"]
          expensas?: number | null
          fotos_urls?: string[]
          id?: string
          inmobiliaria_id?: string
          lead_propietario_id?: string | null
          link_portal?: string | null
          metros_cuadrados?: number | null
          metros_cubiertos?: number | null
          moneda?: string
          precio?: number | null
          tipo?: Database["public"]["Enums"]["tipo_propiedad"]
          updated_at?: string
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propiedades_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propiedades_lead_propietario_id_fkey"
            columns: ["lead_propietario_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      operaciones_ordenadas: {
        Row: {
          agente_id: string | null
          busqueda_id: string | null
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_operacion"] | null
          fecha_cierre: string | null
          id: string | null
          inmobiliaria_id: string | null
          lead_id: string | null
          moneda: string | null
          monto: number | null
          notas: string | null
          propiedad_id: string | null
          rango_estado: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"] | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          agente_id?: string | null
          busqueda_id?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_operacion"] | null
          fecha_cierre?: string | null
          id?: string | null
          inmobiliaria_id?: string | null
          lead_id?: string | null
          moneda?: string | null
          monto?: number | null
          notas?: string | null
          propiedad_id?: string | null
          rango_estado?: never
          tipo?: Database["public"]["Enums"]["tipo_operacion"] | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          agente_id?: string | null
          busqueda_id?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_operacion"] | null
          fecha_cierre?: string | null
          id?: string | null
          inmobiliaria_id?: string | null
          lead_id?: string | null
          moneda?: string | null
          monto?: number | null
          notas?: string | null
          propiedad_id?: string | null
          rango_estado?: never
          tipo?: Database["public"]["Enums"]["tipo_operacion"] | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operaciones_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_busqueda_id_fkey"
            columns: ["busqueda_id"]
            isOneToOne: false
            referencedRelation: "busquedas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operaciones_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      /**
       * SECURITY DEFINER: valida que la búsqueda sea de tu inmobiliaria y, si
       * no, lanza excepción. Puntúa sólo las propiedades DISPONIBLE de la
       * agencia; `tipo_propiedad` filtra pero no puntúa. `criterios_evaluados`
       * varía por fila: `expensas_max` sólo cuenta si la propiedad tiene
       * expensas cargadas.
       */
      buscar_coincidencias_busqueda: {
        Args: { p_busqueda_id: string }
        Returns: {
          propiedad_id: string
          score_pct: number
          criterios_evaluados: number
          criterios_cumplidos: number
        }[]
      }
      /**
       * SECURITY DEFINER: devuelve sólo agregados, nunca filas de `visitas`.
       * Valida que la propiedad sea de la inmobiliaria del usuario y, si no,
       * lanza excepción.
       */
      estadisticas_visitas_propiedad: {
        Args: { p_propiedad_id: string }
        Returns: {
          visitas_realizadas: number
          visitas_agendadas: number
          interesados_unicos: number
        }[]
      }
      /** Ídem, para un lead. `bigint` de Postgres, JSON number del lado del cliente. */
      contar_visitas_lead: {
        Args: { p_lead_id: string }
        Returns: number
      }
      obtener_evolucion_agente: {
        Args: { dias: number }
        Returns: {
          fecha: string
          nuevos: number
          ganados: number
          perdidos: number
        }[]
      }
      /**
       * SIN SECURITY DEFINER: corre con el RLS del que la llama, así que no
       * puede devolver interacciones de otra inmobiliaria.
       *
       * Devuelve una fila por cada lead del array QUE TENGA interacciones: los
       * leads sin ninguna no aparecen en el resultado. Se apoya en el índice
       * `idx_interacciones_lead_fecha (lead_id, fecha DESC)`.
       *
       * `total_interacciones` es un `bigint` de Postgres; para los volúmenes
       * de una página del listado llega como JSON number.
       */
      /**
       * SIN SECURITY DEFINER: corre con el RLS del que la llama, así que sólo
       * cuenta las operaciones de la inmobiliaria del usuario.
       *
       * `total` es un `bigint` de Postgres; llega como JSON number. Un estado
       * sin operaciones puede no aparecer en el resultado.
       */
      /**
       * SIN SECURITY DEFINER: corre con el RLS del que la llama.
       *
       * Suma sobre TODAS las operaciones del estado, no sólo las que el tablero
       * carga. Una combinación estado/moneda sin ninguna operación con `monto`
       * cargado no aparece en el resultado.
       */
      suma_montos_por_estado: {
        Args: Record<PropertyKey, never>
        Returns: {
          estado: Database["public"]["Enums"]["estado_operacion"]
          moneda: string
          total_monto: number
        }[]
      }
      conteo_operaciones_por_estado: {
        Args: Record<PropertyKey, never>
        Returns: {
          estado: Database["public"]["Enums"]["estado_operacion"]
          total: number
        }[]
      }
      resumen_interacciones_por_lead: {
        Args: { p_lead_ids: string[] }
        Returns: {
          lead_id: string
          total_interacciones: number
          ultima_fecha: string
          ultimo_tipo: Database["public"]["Enums"]["tipo_interaccion"]
          ultimo_detalle: string | null
        }[]
      }
    }
    Enums: {
      disposicion_propiedad: "FRENTE" | "CONTRAFRENTE" | "INTERNO"
      estado_lead: "CALIENTE" | "TIBIO" | "FRIO" | "GANADO" | "INACTIVO"
      estado_operacion:
        | "PUBLICADA"
        | "EN_NEGOCIACION"
        | "RESERVADA"
        | "CERRADA_GANADA"
        | "CANCELADA"
      estado_propiedad:
        | "DISPONIBLE"
        | "RESERVADA"
        | "VENDIDA"
        | "ALQUILADA"
        | "PAUSADA"
      origen_lead:
        | "FORMULARIO_WEB"
        | "META_ADS"
        | "LANDING"
        | "WHATSAPP"
        | "REFERIDO"
        | "OTRO"
        | "MANUAL"
        | "INSTAGRAM"
        | "FACEBOOK"
      rol_agente: "DUENO" | "AGENTE" | "ASISTENTE"
      tipo_interaccion:
        | "LLAMADA"
        | "WHATSAPP"
        | "EMAIL"
        | "VISITA"
        | "REUNION"
        | "NOTA_INTERNA"
        | "SEGUIMIENTO"
        | "CONSULTA"
      tipo_operacion: "COMPRA" | "VENTA" | "ALQUILER"
      tipo_propiedad:
        | "CASA"
        | "DEPARTAMENTO"
        | "PH"
        | "TERRENO"
        | "LOCAL_COMERCIAL"
        | "GALPON"
        | "OFICINA"
        | "OTRO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      disposicion_propiedad: ["FRENTE", "CONTRAFRENTE", "INTERNO"],
      estado_lead: ["CALIENTE", "TIBIO", "FRIO", "GANADO", "INACTIVO"],
      estado_operacion: [
        "PUBLICADA",
        "EN_NEGOCIACION",
        "RESERVADA",
        "CERRADA_GANADA",
        "CANCELADA",
      ],
      estado_propiedad: [
        "DISPONIBLE",
        "RESERVADA",
        "VENDIDA",
        "ALQUILADA",
        "PAUSADA",
      ],
      origen_lead: [
        "FORMULARIO_WEB",
        "META_ADS",
        "LANDING",
        "WHATSAPP",
        "REFERIDO",
        "OTRO",
        "MANUAL",
        "INSTAGRAM",
        "FACEBOOK",
      ],
      rol_agente: ["DUENO", "AGENTE", "ASISTENTE"],
      tipo_interaccion: [
        "LLAMADA",
        "WHATSAPP",
        "EMAIL",
        "VISITA",
        "REUNION",
        "NOTA_INTERNA",
        "SEGUIMIENTO",
        "CONSULTA",
      ],
      tipo_operacion: ["COMPRA", "VENTA", "ALQUILER"],
      tipo_propiedad: [
        "CASA",
        "DEPARTAMENTO",
        "PH",
        "TERRENO",
        "LOCAL_COMERCIAL",
        "GALPON",
        "OFICINA",
        "OTRO",
      ],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Tareas
//
// `tareas.estado` y `tareas_series.recurrencia` son columnas `text` en la base,
// no enums de Postgres, así que las uniones van declaradas acá y no en
// `Database["public"]["Enums"]`.
// ---------------------------------------------------------------------------

export type EstadoTarea = 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA'
export type Recurrencia = 'DIARIA' | 'SEMANAL' | 'MENSUAL'

/**
 * Alias de las filas generadas, no interfaces escritas a mano: así el tipo no
 * se desincroniza de la tabla si mañana se agrega una columna.
 */
export type Tarea = Database['public']['Tables']['tareas']['Row']
export type TareaSerie = Database['public']['Tables']['tareas_series']['Row']
export type TareaInsert = Database['public']['Tables']['tareas']['Insert']

// ---------------------------------------------------------------------------
// Visitas
//
// Igual que en tareas, `visitas.estado` es una columna `text` y no un enum de
// Postgres, así que la unión se declara acá.
// ---------------------------------------------------------------------------

export type EstadoVisita = 'AGENDADA' | 'REALIZADA' | 'CANCELADA'

export type Visita = Database['public']['Tables']['visitas']['Row']
export type VisitaInsert = Database['public']['Tables']['visitas']['Insert']
