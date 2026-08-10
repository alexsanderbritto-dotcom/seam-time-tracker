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
      catalog_operations: {
        Row: {
          created_at: string
          expected_per_hour: number | null
          id: string
          is_last_operation: boolean
          name: string
          sector_id: string
        }
        Insert: {
          created_at?: string
          expected_per_hour?: number | null
          id?: string
          is_last_operation?: boolean
          name: string
          sector_id: string
        }
        Update: {
          created_at?: string
          expected_per_hour?: number | null
          id?: string
          is_last_operation?: boolean
          name?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_operations_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          role: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          role?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      operations: {
        Row: {
          catalog_operation_id: string | null
          created_at: string
          id: string
          name: string
          product_id: string
          standard_time: number | null
        }
        Insert: {
          catalog_operation_id?: string | null
          created_at?: string
          id?: string
          name: string
          product_id: string
          standard_time?: number | null
        }
        Update: {
          catalog_operation_id?: string | null
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          standard_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_catalog_operation_id_fkey"
            columns: ["catalog_operation_id"]
            isOneToOne: false
            referencedRelation: "catalog_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entries: {
        Row: {
          created_at: string
          employee_id: string
          entry_date: string
          id: string
          operation_id: string
          product_id: string
          quantity: number
          slot_end: string
          slot_start: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          entry_date?: string
          id?: string
          operation_id: string
          product_id: string
          quantity?: number
          slot_end: string
          slot_start: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          entry_date?: string
          id?: string
          operation_id?: string
          product_id?: string
          quantity?: number
          slot_end?: string
          slot_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cliente: string | null
          created_at: string
          delivery_date: string | null
          empresa: string | null
          entry_date: string | null
          forecast_date: string | null
          id: string
          name: string
          nf_number: string | null
          nf_out_number: string | null
          op_number: string
          photo_url: string | null
          reference: string
          status: string
          total_quantity: number
          unit_value: number
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          delivery_date?: string | null
          empresa?: string | null
          entry_date?: string | null
          forecast_date?: string | null
          id?: string
          name: string
          nf_number?: string | null
          nf_out_number?: string | null
          op_number: string
          photo_url?: string | null
          reference: string
          status?: string
          total_quantity?: number
          unit_value?: number
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          delivery_date?: string | null
          empresa?: string | null
          entry_date?: string | null
          forecast_date?: string | null
          id?: string
          name?: string
          nf_number?: string | null
          nf_out_number?: string | null
          op_number?: string
          photo_url?: string | null
          reference?: string
          status?: string
          total_quantity?: number
          unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      schedule_config: {
        Row: {
          breaks: Json
          end_time: string
          id: string
          slot_minutes: number
          start_time: string
          updated_at: string
        }
        Insert: {
          breaks?: Json
          end_time?: string
          id?: string
          slot_minutes?: number
          start_time?: string
          updated_at?: string
        }
        Update: {
          breaks?: Json
          end_time?: string
          id?: string
          slot_minutes?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalc_product_status: {
        Args: { _product_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
