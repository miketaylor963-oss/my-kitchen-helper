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
      app_writer: {
        Row: {
          added_at: string
          household_id: number
          person_id: number | null
          user_id: string
        }
        Insert: {
          added_at?: string
          household_id?: number
          person_id?: number | null
          user_id: string
        }
        Update: {
          added_at?: string
          household_id?: number
          person_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_writer_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_writer_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      component: {
        Row: {
          carbs_g: number | null
          cook_time_minutes: number | null
          created_at: string
          cuisine_id: number | null
          description: string | null
          dietary_category_id: number | null
          external_ref: string | null
          gi_index: number | null
          household_id: number
          id: number
          import_id: number | null
          name: string
          notes: string | null
          prep_time_minutes: number | null
          protein_g: number | null
          serves: number | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carbs_g?: number | null
          cook_time_minutes?: number | null
          created_at?: string
          cuisine_id?: number | null
          description?: string | null
          dietary_category_id?: number | null
          external_ref?: string | null
          gi_index?: number | null
          household_id?: number
          id?: number
          import_id?: number | null
          name: string
          notes?: string | null
          prep_time_minutes?: number | null
          protein_g?: number | null
          serves?: number | null
          source?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          carbs_g?: number | null
          cook_time_minutes?: number | null
          created_at?: string
          cuisine_id?: number | null
          description?: string | null
          dietary_category_id?: number | null
          external_ref?: string | null
          gi_index?: number | null
          household_id?: number
          id?: number
          import_id?: number | null
          name?: string
          notes?: string | null
          prep_time_minutes?: number | null
          protein_g?: number | null
          serves?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "cuisine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_dietary_category_id_fkey"
            columns: ["dietary_category_id"]
            isOneToOne: false
            referencedRelation: "dietary_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_log"
            referencedColumns: ["id"]
          },
        ]
      }
      component_family: {
        Row: {
          code: string
          framework_layer_id: number
          id: number
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          framework_layer_id: number
          id?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          framework_layer_id?: number
          id?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "component_family_framework_layer_id_fkey"
            columns: ["framework_layer_id"]
            isOneToOne: false
            referencedRelation: "framework_layer"
            referencedColumns: ["id"]
          },
        ]
      }
      component_ingredient: {
        Row: {
          component_id: number
          group_name: string | null
          id: number
          ingredient_id: number | null
          ingredient_name: string
          notes: string | null
          quantity: number | null
          sort_order: number | null
          unit: string | null
        }
        Insert: {
          component_id: number
          group_name?: string | null
          id?: number
          ingredient_id?: number | null
          ingredient_name: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
        }
        Update: {
          component_id?: number
          group_name?: string | null
          id?: number
          ingredient_id?: number | null
          ingredient_name?: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "component_ingredient_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_ingredient_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
        ]
      }
      component_layer: {
        Row: {
          component_family_id: number | null
          component_id: number
          framework_layer_id: number
        }
        Insert: {
          component_family_id?: number | null
          component_id: number
          framework_layer_id: number
        }
        Update: {
          component_family_id?: number | null
          component_id?: number
          framework_layer_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "component_layer_component_family_id_fkey"
            columns: ["component_family_id"]
            isOneToOne: false
            referencedRelation: "component_family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_layer_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_layer_framework_layer_id_fkey"
            columns: ["framework_layer_id"]
            isOneToOne: false
            referencedRelation: "framework_layer"
            referencedColumns: ["id"]
          },
        ]
      }
      component_nutritional_tag: {
        Row: {
          component_id: number
          nutritional_tag_id: number
        }
        Insert: {
          component_id: number
          nutritional_tag_id: number
        }
        Update: {
          component_id?: number
          nutritional_tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "component_nutritional_tag_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_nutritional_tag_nutritional_tag_id_fkey"
            columns: ["nutritional_tag_id"]
            isOneToOne: false
            referencedRelation: "nutritional_tag"
            referencedColumns: ["id"]
          },
        ]
      }
      component_restriction: {
        Row: {
          component_id: number
          restriction_id: number
        }
        Insert: {
          component_id: number
          restriction_id: number
        }
        Update: {
          component_id?: number
          restriction_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "component_restriction_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_restriction_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "dietary_restriction"
            referencedColumns: ["id"]
          },
        ]
      }
      component_step: {
        Row: {
          component_id: number
          content: string
          group_name: string | null
          id: number
          sort_order: number
          timer_seconds: number | null
          title: string | null
        }
        Insert: {
          component_id: number
          content: string
          group_name?: string | null
          id?: number
          sort_order: number
          timer_seconds?: number | null
          title?: string | null
        }
        Update: {
          component_id?: number
          content?: string
          group_name?: string | null
          id?: number
          sort_order?: number
          timer_seconds?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "component_step_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component"
            referencedColumns: ["id"]
          },
        ]
      }
      cuisine: {
        Row: {
          code: string
          id: number
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          id?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          id?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      dietary_category: {
        Row: {
          code: string
          id: number
          name: string
          rank: number
          sort_order: number | null
        }
        Insert: {
          code: string
          id?: number
          name: string
          rank: number
          sort_order?: number | null
        }
        Update: {
          code?: string
          id?: number
          name?: string
          rank?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      dietary_restriction: {
        Row: {
          code: string
          id: number
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          id?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          id?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      framework: {
        Row: {
          code: string
          description: string | null
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      framework_layer: {
        Row: {
          code: string
          framework_id: number
          id: number
          is_required: boolean
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          framework_id: number
          id?: number
          is_required?: boolean
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          framework_id?: number
          id?: number
          is_required?: boolean
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "framework_layer_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework"
            referencedColumns: ["id"]
          },
        ]
      }
      household: {
        Row: {
          created_at: string
          id: number
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      import_log: {
        Row: {
          error_message: string | null
          external_ref: string
          household_id: number
          id: number
          imported_at: string
          imported_by_user_id: string | null
          notes: string | null
          raw_json: Json
          status: string
        }
        Insert: {
          error_message?: string | null
          external_ref: string
          household_id?: number
          id?: number
          imported_at?: string
          imported_by_user_id?: string | null
          notes?: string | null
          raw_json: Json
          status: string
        }
        Update: {
          error_message?: string | null
          external_ref?: string
          household_id?: number
          id?: number
          imported_at?: string
          imported_by_user_id?: string | null
          notes?: string | null
          raw_json?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient: {
        Row: {
          canonical_name: string
          category_id: number | null
          created_at: string
          default_unit: string | null
          dietary_category_id: number | null
          id: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          canonical_name: string
          category_id?: number | null
          created_at?: string
          default_unit?: string | null
          dietary_category_id?: number | null
          id?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          category_id?: number | null
          created_at?: string
          default_unit?: string | null
          dietary_category_id?: number | null
          id?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ingredient_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_dietary_category_id_fkey"
            columns: ["dietary_category_id"]
            isOneToOne: false
            referencedRelation: "dietary_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_alias: {
        Row: {
          alias: string
          id: number
          ingredient_id: number
        }
        Insert: {
          alias: string
          id?: number
          ingredient_id: number
        }
        Update: {
          alias?: string
          id?: number
          ingredient_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_alias_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_category: {
        Row: {
          code: string
          id: number
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          id?: number
          name: string
          sort_order: number
        }
        Update: {
          code?: string
          id?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      meal: {
        Row: {
          carbs_g: number | null
          cook_time_minutes: number | null
          created_at: string
          cuisine_id: number | null
          description: string | null
          dietary_category_id: number | null
          external_ref: string | null
          framework_id: number | null
          gi_index: number | null
          household_id: number
          id: number
          import_id: number | null
          name: string
          notes: string | null
          prep_time_minutes: number | null
          protein_g: number | null
          serves: number | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carbs_g?: number | null
          cook_time_minutes?: number | null
          created_at?: string
          cuisine_id?: number | null
          description?: string | null
          dietary_category_id?: number | null
          external_ref?: string | null
          framework_id?: number | null
          gi_index?: number | null
          household_id?: number
          id?: number
          import_id?: number | null
          name: string
          notes?: string | null
          prep_time_minutes?: number | null
          protein_g?: number | null
          serves?: number | null
          source?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          carbs_g?: number | null
          cook_time_minutes?: number | null
          created_at?: string
          cuisine_id?: number | null
          description?: string | null
          dietary_category_id?: number | null
          external_ref?: string | null
          framework_id?: number | null
          gi_index?: number | null
          household_id?: number
          id?: number
          import_id?: number | null
          name?: string
          notes?: string | null
          prep_time_minutes?: number | null
          protein_g?: number | null
          serves?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "cuisine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_dietary_category_id_fkey"
            columns: ["dietary_category_id"]
            isOneToOne: false
            referencedRelation: "dietary_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_log"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_component: {
        Row: {
          component_id: number
          framework_layer_id: number
          id: number
          meal_id: number
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          component_id: number
          framework_layer_id: number
          id?: number
          meal_id: number
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          component_id?: number
          framework_layer_id?: number
          id?: number
          meal_id?: number
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_component_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "component"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_component_framework_layer_id_fkey"
            columns: ["framework_layer_id"]
            isOneToOne: false
            referencedRelation: "framework_layer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_component_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_cooked_log: {
        Row: {
          actual_serves: number | null
          cooked_by: number | null
          cooked_date: string
          created_at: string
          household_id: number
          id: number
          meal_id: number
          meal_plan_entry_id: number | null
          notes: string | null
          rating: number | null
        }
        Insert: {
          actual_serves?: number | null
          cooked_by?: number | null
          cooked_date: string
          created_at?: string
          household_id?: number
          id?: number
          meal_id: number
          meal_plan_entry_id?: number | null
          notes?: string | null
          rating?: number | null
        }
        Update: {
          actual_serves?: number | null
          cooked_by?: number | null
          cooked_date?: string
          created_at?: string
          household_id?: number
          id?: number
          meal_id?: number
          meal_plan_entry_id?: number | null
          notes?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_cooked_log_cooked_by_fkey"
            columns: ["cooked_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_cooked_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_cooked_log_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_cooked_log_meal_plan_entry_id_fkey"
            columns: ["meal_plan_entry_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_format: {
        Row: {
          code: string
          description: string | null
          id: number
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      meal_ingredient: {
        Row: {
          group_name: string | null
          id: number
          ingredient_id: number | null
          ingredient_name: string
          meal_id: number
          notes: string | null
          quantity: number | null
          sort_order: number | null
          unit: string | null
        }
        Insert: {
          group_name?: string | null
          id?: number
          ingredient_id?: number | null
          ingredient_name: string
          meal_id: number
          notes?: string | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
        }
        Update: {
          group_name?: string | null
          id?: number
          ingredient_id?: number | null
          ingredient_name?: string
          meal_id?: number
          notes?: string | null
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredient_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredient_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_meal_format: {
        Row: {
          meal_format_id: number
          meal_id: number
        }
        Insert: {
          meal_format_id: number
          meal_id: number
        }
        Update: {
          meal_format_id?: number
          meal_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_meal_format_meal_format_id_fkey"
            columns: ["meal_format_id"]
            isOneToOne: false
            referencedRelation: "meal_format"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_meal_format_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_meal_type: {
        Row: {
          meal_id: number
          meal_type_id: number
        }
        Insert: {
          meal_id: number
          meal_type_id: number
        }
        Update: {
          meal_id?: number
          meal_type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_meal_type_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_meal_type_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "meal_type"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_nutritional_tag: {
        Row: {
          meal_id: number
          nutritional_tag_id: number
        }
        Insert: {
          meal_id: number
          nutritional_tag_id: number
        }
        Update: {
          meal_id?: number
          nutritional_tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_nutritional_tag_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_nutritional_tag_nutritional_tag_id_fkey"
            columns: ["nutritional_tag_id"]
            isOneToOne: false
            referencedRelation: "nutritional_tag"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan: {
        Row: {
          created_at: string
          end_date: string
          household_id: number
          id: number
          name: string
          notes: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          household_id?: number
          id?: number
          name: string
          notes?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          household_id?: number
          id?: number
          name?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entry: {
        Row: {
          entry_date: string
          id: number
          meal_id: number | null
          meal_plan_id: number
          meal_type_id: number
          notes: string | null
          serves: number | null
          sort_order: number | null
        }
        Insert: {
          entry_date: string
          id?: number
          meal_id?: number | null
          meal_plan_id: number
          meal_type_id: number
          notes?: string | null
          serves?: number | null
          sort_order?: number | null
        }
        Update: {
          entry_date?: string
          id?: number
          meal_id?: number | null
          meal_plan_id?: number
          meal_type_id?: number
          notes?: string | null
          serves?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entry_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entry_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entry_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "meal_type"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entry_diner: {
        Row: {
          entry_id: number
          person_id: number
        }
        Insert: {
          entry_id: number
          person_id: number
        }
        Update: {
          entry_id?: number
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entry_diner_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entry_diner_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_restriction: {
        Row: {
          meal_id: number
          restriction_id: number
        }
        Insert: {
          meal_id: number
          restriction_id: number
        }
        Update: {
          meal_id?: number
          restriction_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_restriction_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_restriction_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "dietary_restriction"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_step: {
        Row: {
          content: string
          group_name: string | null
          id: number
          meal_id: number
          sort_order: number
          timer_seconds: number | null
          title: string | null
        }
        Insert: {
          content: string
          group_name?: string | null
          id?: number
          meal_id: number
          sort_order: number
          timer_seconds?: number | null
          title?: string | null
        }
        Update: {
          content?: string
          group_name?: string | null
          id?: number
          meal_id?: number
          sort_order?: number
          timer_seconds?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_step_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_type: {
        Row: {
          code: string
          id: number
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          id?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          id?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      nutritional_tag: {
        Row: {
          code: string
          description: string | null
          id: number
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      person: {
        Row: {
          created_at: string
          dietary_category_id: number | null
          household_id: number
          id: number
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          dietary_category_id?: number | null
          household_id?: number
          id?: number
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          dietary_category_id?: number | null
          household_id?: number
          id?: number
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_dietary_category_id_fkey"
            columns: ["dietary_category_id"]
            isOneToOne: false
            referencedRelation: "dietary_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      person_restriction: {
        Row: {
          person_id: number
          restriction_id: number
        }
        Insert: {
          person_id: number
          restriction_id: number
        }
        Update: {
          person_id?: number
          restriction_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_restriction_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_restriction_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "dietary_restriction"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list: {
        Row: {
          generated_at: string
          household_id: number
          id: number
          meal_plan_id: number | null
          name: string
          notes: string | null
        }
        Insert: {
          generated_at?: string
          household_id?: number
          id?: number
          meal_plan_id?: number | null
          name: string
          notes?: string | null
        }
        Update: {
          generated_at?: string
          household_id?: number
          id?: number
          meal_plan_id?: number | null
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_item: {
        Row: {
          id: number
          ingredient_id: number | null
          ingredient_name: string
          is_checked: boolean
          is_in_stock: boolean
          notes: string | null
          quantity: number | null
          shopping_list_id: number
          sort_order: number | null
          source: string
          unit: string | null
        }
        Insert: {
          id?: number
          ingredient_id?: number | null
          ingredient_name: string
          is_checked?: boolean
          is_in_stock?: boolean
          notes?: string | null
          quantity?: number | null
          shopping_list_id: number
          sort_order?: number | null
          source: string
          unit?: string | null
        }
        Update: {
          id?: number
          ingredient_id?: number | null
          ingredient_name?: string
          is_checked?: boolean
          is_in_stock?: boolean
          notes?: string | null
          quantity?: number | null
          shopping_list_id?: number
          sort_order?: number | null
          source?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_item_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_item_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_list"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
