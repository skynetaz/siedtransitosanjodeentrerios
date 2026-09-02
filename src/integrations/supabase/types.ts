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
      audit_log: {
        Row: {
          accion: string
          created_at: string
          id: string
          meta: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exam_access_codes: {
        Row: {
          aspirante_id: string
          categoria_slug: string | null
          clase: Database["public"]["Enums"]["license_class"]
          clases_incluidas: string[] | null
          codigo: string
          created_at: string
          created_by: string | null
          dni: string | null
          exam_id: string | null
          expires_at: string | null
          id: string
          inspector_id: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          aspirante_id: string
          categoria_slug?: string | null
          clase: Database["public"]["Enums"]["license_class"]
          clases_incluidas?: string[] | null
          codigo: string
          created_at?: string
          created_by?: string | null
          dni?: string | null
          exam_id?: string | null
          expires_at?: string | null
          id?: string
          inspector_id?: string | null
          status?: string
          used_at?: string | null
        }
        Update: {
          aspirante_id?: string
          categoria_slug?: string | null
          clase?: Database["public"]["Enums"]["license_class"]
          clases_incluidas?: string[] | null
          codigo?: string
          created_at?: string
          created_by?: string | null
          dni?: string | null
          exam_id?: string | null
          expires_at?: string | null
          id?: string
          inspector_id?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_access_codes_aspirante_id_fkey"
            columns: ["aspirante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_access_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_access_codes_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_access_codes_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_categories: {
        Row: {
          activa: boolean
          cantidad_preguntas: number
          clases: string[]
          created_at: string
          duracion_minutos: number
          grupo: string
          incluye_senales: boolean
          max_errores: number
          nombre: string
          orden: number
          preguntas_senales: number
          slug: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          cantidad_preguntas?: number
          clases?: string[]
          created_at?: string
          duracion_minutos?: number
          grupo?: string
          incluye_senales?: boolean
          max_errores?: number
          nombre: string
          orden?: number
          preguntas_senales?: number
          slug: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          cantidad_preguntas?: number
          clases?: string[]
          created_at?: string
          duracion_minutos?: number
          grupo?: string
          incluye_senales?: boolean
          max_errores?: number
          nombre?: string
          orden?: number
          preguntas_senales?: number
          slug?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_configs: {
        Row: {
          cantidad_preguntas: number
          clase: Database["public"]["Enums"]["license_class"]
          distribucion_temas: Json
          duracion_minutos: number
          max_errores: number
          updated_at: string
        }
        Insert: {
          cantidad_preguntas?: number
          clase: Database["public"]["Enums"]["license_class"]
          distribucion_temas?: Json
          duracion_minutos?: number
          max_errores?: number
          updated_at?: string
        }
        Update: {
          cantidad_preguntas?: number
          clase?: Database["public"]["Enums"]["license_class"]
          distribucion_temas?: Json
          duracion_minutos?: number
          max_errores?: number
          updated_at?: string
        }
        Relationships: []
      }
      exam_events: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          meta: Json | null
          motivo: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          meta?: Json | null
          motivo?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          meta?: Json | null
          motivo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_events_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          answered_at: string | null
          correcta: boolean | null
          exam_id: string
          id: string
          orden: number
          question_id: string
          respuesta_dada: string | null
          snapshot: Json
        }
        Insert: {
          answered_at?: string | null
          correcta?: boolean | null
          exam_id: string
          id?: string
          orden: number
          question_id: string
          respuesta_dada?: string | null
          snapshot: Json
        }
        Update: {
          answered_at?: string | null
          correcta?: boolean | null
          exam_id?: string
          id?: string
          orden?: number
          question_id?: string
          respuesta_dada?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          aspirante_id: string
          categoria_slug: string | null
          clase: Database["public"]["Enums"]["license_class"]
          clases_incluidas: string[] | null
          codigo_utilizado: string | null
          config_snapshot: Json | null
          correctas: number
          created_at: string
          datos_aspirante: Json | null
          eliminado_por_pregunta: string | null
          finished_at: string | null
          focus_lost_count: number
          id: string
          incorrectas: number
          inspector_id: string | null
          is_emulation: boolean
          motivo_finalizacion: string | null
          porcentaje: number | null
          puntaje: number
          signature_aspirante: string | null
          signature_inspector: string | null
          signed_aspirante_at: string | null
          signed_inspector_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["exam_status"]
          tiempo_utilizado_seg: number | null
          total_preguntas: number
          updated_at: string
        }
        Insert: {
          aspirante_id: string
          categoria_slug?: string | null
          clase: Database["public"]["Enums"]["license_class"]
          clases_incluidas?: string[] | null
          codigo_utilizado?: string | null
          config_snapshot?: Json | null
          correctas?: number
          created_at?: string
          datos_aspirante?: Json | null
          eliminado_por_pregunta?: string | null
          finished_at?: string | null
          focus_lost_count?: number
          id?: string
          incorrectas?: number
          inspector_id?: string | null
          is_emulation?: boolean
          motivo_finalizacion?: string | null
          porcentaje?: number | null
          puntaje?: number
          signature_aspirante?: string | null
          signature_inspector?: string | null
          signed_aspirante_at?: string | null
          signed_inspector_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          tiempo_utilizado_seg?: number | null
          total_preguntas?: number
          updated_at?: string
        }
        Update: {
          aspirante_id?: string
          categoria_slug?: string | null
          clase?: Database["public"]["Enums"]["license_class"]
          clases_incluidas?: string[] | null
          codigo_utilizado?: string | null
          config_snapshot?: Json | null
          correctas?: number
          created_at?: string
          datos_aspirante?: Json | null
          eliminado_por_pregunta?: string | null
          finished_at?: string | null
          focus_lost_count?: number
          id?: string
          incorrectas?: number
          inspector_id?: string | null
          is_emulation?: boolean
          motivo_finalizacion?: string | null
          porcentaje?: number | null
          puntaje?: number
          signature_aspirante?: string | null
          signature_inspector?: string | null
          signed_aspirante_at?: string | null
          signed_inspector_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          tiempo_utilizado_seg?: number | null
          total_preguntas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_aspirante_id_fkey"
            columns: ["aspirante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_eliminado_por_pregunta_fkey"
            columns: ["eliminado_por_pregunta"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string
          created_at: string
          dni: string | null
          email: string | null
          id: string
          license_class: Database["public"]["Enums"]["license_class"] | null
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string
          created_at?: string
          dni?: string | null
          email?: string | null
          id: string
          license_class?: Database["public"]["Enums"]["license_class"] | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string
          created_at?: string
          dni?: string | null
          email?: string | null
          id?: string
          license_class?: Database["public"]["Enums"]["license_class"] | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          activa: boolean
          clase: Database["public"]["Enums"]["license_class"]
          created_at: string
          eliminatoria: boolean
          fuente: string | null
          id: string
          nivel: string
          opciones_incorrectas: string[]
          opciones_revisadas: boolean
          orden: number
          peso: number
          pregunta: string
          respuesta_correcta: string
          respuestas_aceptadas: string[]
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          clase: Database["public"]["Enums"]["license_class"]
          created_at?: string
          eliminatoria?: boolean
          fuente?: string | null
          id?: string
          nivel?: string
          opciones_incorrectas?: string[]
          opciones_revisadas?: boolean
          orden?: number
          peso?: number
          pregunta: string
          respuesta_correcta: string
          respuestas_aceptadas?: string[]
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          clase?: Database["public"]["Enums"]["license_class"]
          created_at?: string
          eliminatoria?: boolean
          fuente?: string | null
          id?: string
          nivel?: string
          opciones_incorrectas?: string[]
          opciones_revisadas?: boolean
          orden?: number
          peso?: number
          pregunta?: string
          respuesta_correcta?: string
          respuestas_aceptadas?: string[]
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role_any: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "inspector" | "aspirante"
      exam_status:
        | "esperando"
        | "habilitado"
        | "rindiendo"
        | "finalizado"
        | "aprobado"
        | "desaprobado"
        | "cancelado"
      license_class: "A" | "B" | "C" | "D" | "E" | "UNICA"
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
      app_role: ["admin", "inspector", "aspirante"],
      exam_status: [
        "esperando",
        "habilitado",
        "rindiendo",
        "finalizado",
        "aprobado",
        "desaprobado",
        "cancelado",
      ],
      license_class: ["A", "B", "C", "D", "E", "UNICA"],
    },
  },
} as const
