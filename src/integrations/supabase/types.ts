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
      household_invites: {
        Row: {
          code: string
          created_at: string
          household_id: string
        }
        Insert: {
          code: string
          created_at?: string
          household_id: string
        }
        Update: {
          code?: string
          created_at?: string
          household_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_pantry_flags: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_pantry_flags_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          added_by: string | null
          category: string
          created_at: string
          expires_on: string | null
          household_id: string
          id: string
          location: string
          name: string
          quantity: string | null
        }
        Insert: {
          added_by?: string | null
          category?: string
          created_at?: string
          expires_on?: string | null
          household_id: string
          id?: string
          location?: string
          name: string
          quantity?: string | null
        }
        Update: {
          added_by?: string | null
          category?: string
          created_at?: string
          expires_on?: string | null
          household_id?: string
          id?: string
          location?: string
          name?: string
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          category: string
          created_at: string
          household_id: string
          id: string
          name: string
          note: string | null
          purchased_at: string | null
          quantity: string | null
          requested_by: string
          status: string
        }
        Insert: {
          category?: string
          created_at?: string
          household_id: string
          id?: string
          name: string
          note?: string | null
          purchased_at?: string | null
          quantity?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          note?: string | null
          purchased_at?: string | null
          quantity?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          cooked: boolean
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          plan_date: string
          recipe_id: string | null
          slot: string
          title: string
        }
        Insert: {
          cooked?: boolean
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          plan_date: string
          recipe_id?: string | null
          slot?: string
          title: string
        }
        Update: {
          cooked?: boolean
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          plan_date?: string
          recipe_id?: string | null
          slot?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          accent?: string
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          accent?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      recipe_favourites: {
        Row: {
          created_at: string
          household_id: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_favourites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_favourites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          category: string
          id: string
          name: string
          optional: boolean
          quantity: string | null
          recipe_id: string
        }
        Insert: {
          category?: string
          id?: string
          name: string
          optional?: boolean
          quantity?: string | null
          recipe_id: string
        }
        Update: {
          category?: string
          id?: string
          name?: string
          optional?: boolean
          quantity?: string | null
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          household_id: string | null
          id: string
          minutes: number
          servings: number
          steps: string[]
          tags: string[]
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          household_id?: string | null
          id?: string
          minutes?: number
          servings?: number
          steps?: string[]
          tags?: string[]
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          household_id?: string | null
          id?: string
          minutes?: number
          servings?: number
          steps?: string[]
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      staples: {
        Row: {
          category: string
          created_at: string
          household_id: string
          id: string
          interval_days: number
          last_purchased_on: string | null
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          household_id: string
          id?: string
          interval_days?: number
          last_purchased_on?: string | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          interval_days?: number
          last_purchased_on?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "staples_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
