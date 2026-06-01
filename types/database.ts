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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["attachment_entity"]
          id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["attachment_entity"]
          id?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["attachment_entity"]
          id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_kpi_reports: {
        Row: {
          abv: number | null
          fuel_conversion_pct: number | null
          id: string
          late: boolean
          nob: number
          nso_id: string | null
          promotion_sales: number | null
          report_date: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slow_category_id: string | null
          slow_category_remarks: string | null
          status: Database["public"]["Enums"]["kpi_status"]
          store_id: string
          submitted_at: string
          submitted_by: string
          support_needed: string | null
          top_category_id: string | null
          top_category_remarks: string | null
          total_sales: number
          udc_id: string | null
          walk_ins: number | null
        }
        Insert: {
          abv?: number | null
          fuel_conversion_pct?: number | null
          id?: string
          late?: boolean
          nob: number
          nso_id?: string | null
          promotion_sales?: number | null
          report_date: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slow_category_id?: string | null
          slow_category_remarks?: string | null
          status?: Database["public"]["Enums"]["kpi_status"]
          store_id: string
          submitted_at?: string
          submitted_by: string
          support_needed?: string | null
          top_category_id?: string | null
          top_category_remarks?: string | null
          total_sales: number
          udc_id?: string | null
          walk_ins?: number | null
        }
        Update: {
          abv?: number | null
          fuel_conversion_pct?: number | null
          id?: string
          late?: boolean
          nob?: number
          nso_id?: string | null
          promotion_sales?: number | null
          report_date?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slow_category_id?: string | null
          slow_category_remarks?: string | null
          status?: Database["public"]["Enums"]["kpi_status"]
          store_id?: string
          submitted_at?: string
          submitted_by?: string
          support_needed?: string | null
          top_category_id?: string | null
          top_category_remarks?: string | null
          total_sales?: number
          udc_id?: string | null
          walk_ins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_kpi_reports_nso_id_fkey"
            columns: ["nso_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_reports_slow_category_id_fkey"
            columns: ["slow_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_reports_top_category_id_fkey"
            columns: ["top_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_reports_udc_id_fkey"
            columns: ["udc_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_kpi_stockout_items: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          kpi_report_id: string
          remarks: string | null
          sku: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          kpi_report_id: string
          remarks?: string | null
          sku?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          kpi_report_id?: string
          remarks?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_kpi_stockout_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_stockout_items_kpi_report_id_fkey"
            columns: ["kpi_report_id"]
            isOneToOne: false
            referencedRelation: "daily_kpi_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      health_check: {
        Row: {
          id: number
          note: string | null
        }
        Insert: {
          id?: number
          note?: string | null
        }
        Update: {
          id?: number
          note?: string | null
        }
        Relationships: []
      }
      kpi_config: {
        Row: {
          daily_cutoff_time: string
          id: number
          updated_at: string
        }
        Insert: {
          daily_cutoff_time?: string
          id: number
          updated_at?: string
        }
        Update: {
          daily_cutoff_time?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["region_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["region_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["region_type"]
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          id: string
          module: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      stores: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          dealer_name: string | null
          id: string
          latitude: number | null
          longitude: number | null
          region_id: string | null
          state: string | null
          store_name: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          dealer_name?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          region_id?: string | null
          state?: string | null
          store_name: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          dealer_name?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          region_id?: string | null
          state?: string | null
          store_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_region_assignments: {
        Row: {
          id: string
          region_id: string
          user_id: string
        }
        Insert: {
          id?: string
          region_id: string
          user_id: string
        }
        Update: {
          id?: string
          region_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_region_assignments_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_region_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_store_assignments: {
        Row: {
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_store_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          name: string
          primary_store_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id: string
          mobile?: string | null
          name?: string
          primary_store_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name?: string
          primary_store_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_primary_store_id_fkey"
            columns: ["primary_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accessible_store_ids: { Args: never; Returns: string[] }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_module:
        | "daily_kpi"
        | "nso_visit"
        | "promotion_vm"
        | "resolution"
        | "lms"
        | "coaching"
      app_role:
        | "super_admin"
        | "management"
        | "state_area_manager"
        | "nso"
        | "udc"
        | "dealer"
        | "marketing_vm"
        | "training_admin"
        | "consultant"
      assignment_type: "nso" | "udc" | "dealer"
      attachment_entity:
        | "daily_kpi_report"
        | "checklist_submission"
        | "nso_visit"
        | "promotion_compliance"
      kpi_status: "submitted" | "approved" | "rejected" | "edited"
      region_type: "state" | "area" | "cluster"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_module: [
        "daily_kpi",
        "nso_visit",
        "promotion_vm",
        "resolution",
        "lms",
        "coaching",
      ],
      app_role: [
        "super_admin",
        "management",
        "state_area_manager",
        "nso",
        "udc",
        "dealer",
        "marketing_vm",
        "training_admin",
        "consultant",
      ],
      assignment_type: ["nso", "udc", "dealer"],
      attachment_entity: [
        "daily_kpi_report",
        "checklist_submission",
        "nso_visit",
        "promotion_compliance",
      ],
      kpi_status: ["submitted", "approved", "rejected", "edited"],
      region_type: ["state", "area", "cluster"],
    },
  },
} as const
