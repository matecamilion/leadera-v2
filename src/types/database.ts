/**
 * Tipos generados desde el esquema de Supabase. NO editar a mano.
 * Regenerar con:
 *   supabase gen types typescript --project-id gnnowyphlxebdxbfsmss > src/types/database.ts
 *
 * Después de regenerar hay que reponer dos cosas que el CLI no puede saber, o
 * el build rompe:
 *   1. Los alias del final del archivo (EstadoTarea, Tarea, Visita, ...), que
 *      se pierden porque el generador escribe el archivo entero.
 *   2. El tipado angosto de tres columnas `text` que en realidad son uniones
 *      cerradas: tareas.estado -> EstadoTarea, tareas_series.recurrencia ->
 *      Recurrencia y visitas.estado -> EstadoVisita. El CLI las emite como
 *      `string` porque no son enums de Postgres.
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
    PostgrestVersion: "14.5"
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
      eventos_facturacion: {
        Row: {
          created_at: string
          detalle: string | null
          id: string
          inmobiliaria_id: string
          moneda: string | null
          monto: number | null
          mp_payment_id: string | null
          raw_payload: Json | null
          tipo: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          id?: string
          inmobiliaria_id: string
          moneda?: string | null
          monto?: number | null
          mp_payment_id?: string | null
          raw_payload?: Json | null
          tipo: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          id?: string
          inmobiliaria_id?: string
          moneda?: string | null
          monto?: number | null
          mp_payment_id?: string | null
          raw_payload?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_facturacion_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_precios_planes: {
        Row: {
          cotizacion_usada: number
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["plan_leadera"]
          precio_ars: number
          precio_usd: number
        }
        Insert: {
          cotizacion_usada: number
          created_at?: string
          id?: string
          plan: Database["public"]["Enums"]["plan_leadera"]
          precio_ars: number
          precio_usd: number
        }
        Update: {
          cotizacion_usada?: number
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_leadera"]
          precio_ars?: number
          precio_usd?: number
        }
        Relationships: []
      }
      inmobiliarias: {
        Row: {
          created_at: string
          estado_suscripcion: Database["public"]["Enums"]["estado_suscripcion"]
          fecha_fin_trial: string
          fecha_inicio_trial: string
          fecha_proximo_cobro: string | null
          fecha_ultimo_pago_fallido: string | null
          id: string
          limite_usuarios: number
          mp_preapproval_id: string | null
          nombre: string
          plan: Database["public"]["Enums"]["plan_leadera"] | null
        }
        Insert: {
          created_at?: string
          estado_suscripcion?: Database["public"]["Enums"]["estado_suscripcion"]
          fecha_fin_trial?: string
          fecha_inicio_trial?: string
          fecha_proximo_cobro?: string | null
          fecha_ultimo_pago_fallido?: string | null
          id?: string
          limite_usuarios?: number
          mp_preapproval_id?: string | null
          nombre: string
          plan?: Database["public"]["Enums"]["plan_leadera"] | null
        }
        Update: {
          created_at?: string
          estado_suscripcion?: Database["public"]["Enums"]["estado_suscripcion"]
          fecha_fin_trial?: string
          fecha_inicio_trial?: string
          fecha_proximo_cobro?: string | null
          fecha_ultimo_pago_fallido?: string | null
          id?: string
          limite_usuarios?: number
          mp_preapproval_id?: string | null
          nombre?: string
          plan?: Database["public"]["Enums"]["plan_leadera"] | null
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
          {
            foreignKeyName: "interacciones_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacciones_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones_ordenadas"
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
          agente_id: string
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
          agente_id: string
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
          agente_id?: string
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
      planes_precio: {
        Row: {
          actualizado_at: string | null
          cotizacion_usada: number | null
          plan: Database["public"]["Enums"]["plan_leadera"]
          precio_ars_actual: number | null
          precio_usd: number
        }
        Insert: {
          actualizado_at?: string | null
          cotizacion_usada?: number | null
          plan: Database["public"]["Enums"]["plan_leadera"]
          precio_ars_actual?: number | null
          precio_usd: number
        }
        Update: {
          actualizado_at?: string | null
          cotizacion_usada?: number | null
          plan?: Database["public"]["Enums"]["plan_leadera"]
          precio_ars_actual?: number | null
          precio_usd?: number
        }
        Relationships: []
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
      propiedades: {
        Row: {
          agente_id: string | null
          ambientes: number | null
          banos: number | null
          cocheras: number | null
          created_at: string
          descripcion: string | null
          direccion: string
          disposicion:
            | Database["public"]["Enums"]["disposicion_propiedad"]
            | null
          estado: Database["public"]["Enums"]["estado_propiedad"]
          expensas: number | null
          finalidad: Database["public"]["Enums"]["finalidad_propiedad"] | null
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
          disposicion?:
            | Database["public"]["Enums"]["disposicion_propiedad"]
            | null
          estado?: Database["public"]["Enums"]["estado_propiedad"]
          expensas?: number | null
          finalidad?: Database["public"]["Enums"]["finalidad_propiedad"] | null
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
          disposicion?:
            | Database["public"]["Enums"]["disposicion_propiedad"]
            | null
          estado?: Database["public"]["Enums"]["estado_propiedad"]
          expensas?: number | null
          finalidad?: Database["public"]["Enums"]["finalidad_propiedad"] | null
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
      tareas: {
        Row: {
          asignado_a: string
          completada_en: string | null
          creado_por: string
          created_at: string | null
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
          creado_por: string
          created_at?: string | null
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
          creado_por?: string
          created_at?: string | null
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
            foreignKeyName: "tareas_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones_ordenadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
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
          created_at: string | null
          hasta: string
          id: string
          inmobiliaria_id: string
          recurrencia: Recurrencia
        }
        Insert: {
          created_at?: string | null
          hasta: string
          id?: string
          inmobiliaria_id: string
          recurrencia: Recurrencia
        }
        Update: {
          created_at?: string | null
          hasta?: string
          id?: string
          inmobiliaria_id?: string
          recurrencia?: Recurrencia
        }
        Relationships: [
          {
            foreignKeyName: "tareas_series_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          asignado_a: string
          creado_por: string
          created_at: string | null
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
          creado_por: string
          created_at?: string | null
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
          creado_por?: string
          created_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "visitas_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_inmobiliaria_id_fkey"
            columns: ["inmobiliaria_id"]
            isOneToOne: false
            referencedRelation: "inmobiliarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_operacion_id_fkey"
            columns: ["operacion_id"]
            isOneToOne: false
            referencedRelation: "operaciones_ordenadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
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
          lead_nombre_completo: string | null
          moneda: string | null
          monto: number | null
          notas: string | null
          propiedad_direccion: string | null
          propiedad_id: string | null
          rango_estado: number | null
          tipo: Database["public"]["Enums"]["tipo_operacion"] | null
          titulo: string | null
          updated_at: string | null
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
      buscar_coincidencias_busqueda: {
        Args: { p_busqueda_id: string }
        Returns: {
          criterios_cumplidos: number
          criterios_evaluados: number
          propiedad_id: string
          score_pct: number
        }[]
      }
      contar_visitas_lead: { Args: { p_lead_id: string }; Returns: number }
      conteo_operaciones_por_estado: {
        Args: never
        Returns: {
          estado: Database["public"]["Enums"]["estado_operacion"]
          total: number
        }[]
      }
      estadisticas_visitas_propiedad: {
        Args: { p_propiedad_id: string }
        Returns: {
          interesados_unicos: number
          visitas_agendadas: number
          visitas_realizadas: number
        }[]
      }
      obtener_evolucion_agente: {
        Args: { dias?: number }
        Returns: {
          fecha: string
          ganados: number
          nuevos: number
          perdidos: number
        }[]
      }
      resumen_interacciones_por_lead: {
        Args: { p_lead_ids: string[] }
        Returns: {
          lead_id: string
          total_interacciones: number
          ultima_fecha: string
          ultimo_detalle: string
          ultimo_tipo: Database["public"]["Enums"]["tipo_interaccion"]
        }[]
      }
      suma_montos_por_estado: {
        Args: never
        Returns: {
          estado: Database["public"]["Enums"]["estado_operacion"]
          moneda: string
          total_monto: number
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
      estado_suscripcion:
        | "TRIAL"
        | "ACTIVA"
        | "GRACIA"
        | "VENCIDA"
        | "CANCELADA"
      finalidad_propiedad: "VENTA" | "ALQUILER" | "AMBAS"
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
      plan_leadera: "SOLO" | "AGENCIA_CHICA" | "AGENCIA_GRANDE"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      estado_suscripcion: ["TRIAL", "ACTIVA", "GRACIA", "VENCIDA", "CANCELADA"],
      finalidad_propiedad: ["VENTA", "ALQUILER", "AMBAS"],
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
      plan_leadera: ["SOLO", "AGENCIA_CHICA", "AGENCIA_GRANDE"],
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
