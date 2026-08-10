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
      activity_log: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          entity: string | null
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string | null
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          entity?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          entity?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          product_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          city: string | null
          created_at: string
          customer_id: string
          ext_number: string | null
          id: string
          int_number: string | null
          label: string | null
          municipality: string | null
          neighborhood: string | null
          phone: string | null
          postal_code: string | null
          recipient_first_name: string | null
          recipient_last_name: string | null
          references_text: string | null
          special_instructions: string | null
          state: string | null
          street: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          customer_id: string
          ext_number?: string | null
          id?: string
          int_number?: string | null
          label?: string | null
          municipality?: string | null
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          recipient_first_name?: string | null
          recipient_last_name?: string | null
          references_text?: string | null
          special_instructions?: string | null
          state?: string | null
          street?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          customer_id?: string
          ext_number?: string | null
          id?: string
          int_number?: string | null
          label?: string | null
          municipality?: string | null
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          recipient_first_name?: string | null
          recipient_last_name?: string | null
          references_text?: string | null
          special_instructions?: string | null
          state?: string | null
          street?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          contact_channel: string | null
          created_at: string
          created_by: string | null
          first_name: string
          id: string
          is_demo: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          phone_normalized: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          contact_channel?: string | null
          created_at?: string
          created_by?: string | null
          first_name: string
          id?: string
          is_demo?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          contact_channel?: string | null
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          is_demo?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cutter_price_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          modality: Database["public"]["Enums"]["cutter_modality"]
          price: number
          size_cm: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          modality: Database["public"]["Enums"]["cutter_modality"]
          price: number
          size_cm: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          modality?: Database["public"]["Enums"]["cutter_modality"]
          price?: number
          size_cm?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      note_attachments: {
        Row: {
          created_at: string
          external_url: string | null
          file_name: string | null
          id: string
          note_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          note_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          note_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "order_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_folio_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      order_item_images: {
        Row: {
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          order_item_id: string
          sort_order: number
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          order_item_id: string
          sort_order?: number
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          order_item_id?: string
          sort_order?: number
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_images_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          cutter_modality: Database["public"]["Enums"]["cutter_modality"] | null
          cutter_size_cm: number | null
          description: string | null
          done_at: string | null
          done_by: string | null
          done_quantity: number
          id: string
          is_done: boolean
          notes: string | null
          order_id: string
          price_applied_at: string
          price_overridden: boolean
          price_override_reason: string | null
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          sort_order: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          cutter_modality?:
            | Database["public"]["Enums"]["cutter_modality"]
            | null
          cutter_size_cm?: number | null
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          done_quantity?: number
          id?: string
          is_done?: boolean
          notes?: string | null
          order_id: string
          price_applied_at?: string
          price_overridden?: boolean
          price_override_reason?: string | null
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_price?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          cutter_modality?:
            | Database["public"]["Enums"]["cutter_modality"]
            | null
          cutter_size_cm?: number | null
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          done_quantity?: number
          id?: string
          is_done?: boolean
          notes?: string | null
          order_id?: string
          price_applied_at?: string
          price_overridden?: boolean
          price_override_reason?: string | null
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          important: boolean
          order_id: string
          order_item_id: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          important?: boolean
          order_id: string
          order_item_id?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          important?: boolean
          order_id?: string
          order_item_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assignee_id: string | null
          balance: number
          client_notes: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          discount: number
          due_date: string | null
          folio: string | null
          id: string
          is_demo: boolean
          is_draft: boolean
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          priority: Database["public"]["Enums"]["order_priority"]
          review_status: string
          shipping_cost: number
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          balance?: number
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          discount?: number
          due_date?: string | null
          folio?: string | null
          id?: string
          is_demo?: boolean
          is_draft?: boolean
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          priority?: Database["public"]["Enums"]["order_priority"]
          review_status?: string
          shipping_cost?: number
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          balance?: number
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          discount?: number
          due_date?: string | null
          folio?: string | null
          id?: string
          is_demo?: boolean
          is_draft?: boolean
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          priority?: Database["public"]["Enums"]["order_priority"]
          review_status?: string
          shipping_cost?: number
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attachments: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attachments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          notes: string | null
          order_id: string
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          order_id: string
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          order_id?: string
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_delivery_details: {
        Row: {
          created_at: string
          delivery_date: string | null
          delivery_time: string | null
          first_name: string | null
          instructions: string | null
          last_name: string | null
          order_id: string
          phone: string | null
          place: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          delivery_time?: string | null
          first_name?: string | null
          instructions?: string | null
          last_name?: string | null
          order_id: string
          phone?: string | null
          place?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          delivery_time?: string | null
          first_name?: string | null
          instructions?: string | null
          last_name?: string | null
          order_id?: string
          phone?: string | null
          place?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_delivery_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verification_codes: {
        Row: {
          code: string
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          phone_normalized: string
        }
        Insert: {
          code: string
          consumed?: boolean
          created_at?: string
          expires_at: string
          id?: string
          phone_normalized: string
        }
        Update: {
          code?: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          phone_normalized?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          external_url: string | null
          id: string
          is_primary: boolean
          kind: string | null
          product_id: string
          sort_order: number
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          id?: string
          is_primary?: boolean
          kind?: string | null
          product_id: string
          sort_order?: number
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          external_url?: string | null
          id?: string
          is_primary?: boolean
          kind?: string | null
          product_id?: string
          sort_order?: number
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_rows: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          import_id: string
          product_id: string | null
          raw_data: Json | null
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          import_id: string
          product_id?: string | null
          raw_data?: Json | null
          row_number: number
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          import_id?: string
          product_id?: string | null
          raw_data?: Json | null
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "product_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_rows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_imports: {
        Row: {
          created_at: string
          created_by: string | null
          created_count: number
          error_count: number
          file_name: string | null
          id: string
          skipped_count: number
          status: string
          total_rows: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_count?: number
          file_name?: string | null
          id?: string
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_count?: number
          file_name?: string | null
          id?: string
          skipped_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
        }
        Relationships: []
      }
      product_theme_links: {
        Row: {
          created_at: string
          product_id: string
          theme_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          theme_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_theme_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_theme_links_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "product_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_themes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          base_price: number | null
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_demo: boolean
          manufacturing_notes: string | null
          name: string
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number | null
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          manufacturing_notes?: string | null
          name: string
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          manufacturing_notes?: string | null
          name?: string
          sku?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_details: {
        Row: {
          carrier: string | null
          city: string | null
          created_at: string
          estimated_ship_date: string | null
          ext_number: string | null
          first_name: string | null
          int_number: string | null
          last_name: string | null
          municipality: string | null
          neighborhood: string | null
          order_id: string
          phone: string | null
          postal_code: string | null
          references_text: string | null
          shipping_cost: number | null
          special_instructions: string | null
          state: string | null
          street: string | null
          tracking_image_path: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          city?: string | null
          created_at?: string
          estimated_ship_date?: string | null
          ext_number?: string | null
          first_name?: string | null
          int_number?: string | null
          last_name?: string | null
          municipality?: string | null
          neighborhood?: string | null
          order_id: string
          phone?: string | null
          postal_code?: string | null
          references_text?: string | null
          shipping_cost?: number | null
          special_instructions?: string | null
          state?: string | null
          street?: string | null
          tracking_image_path?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          city?: string | null
          created_at?: string
          estimated_ship_date?: string | null
          ext_number?: string | null
          first_name?: string | null
          int_number?: string | null
          last_name?: string | null
          municipality?: string | null
          neighborhood?: string | null
          order_id?: string
          phone?: string | null
          postal_code?: string | null
          references_text?: string | null
          shipping_cost?: number | null
          special_instructions?: string | null
          state?: string | null
          street?: string | null
          tracking_image_path?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      assign_folio: { Args: { _order_id: string }; Returns: string }
      ensure_profile: {
        Args: { _full_name?: string }
        Returns: {
          out_id: string
          out_role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_client: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_customer_id: { Args: never; Returns: string }
      owns_order: { Args: { _order_id: string }; Returns: boolean }
      place_client_order: { Args: { payload: Json }; Returns: string }
      place_staff_order: { Args: { payload: Json }; Returns: string }
      purge_demo_data: { Args: never; Returns: undefined }
      recalc_order: { Args: { _order_id: string }; Returns: undefined }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "colaborador"
      cutter_modality: "cutter_only" | "cutter_with_stamp"
      delivery_type: "envio" | "entrega_personal"
      order_priority: "baja" | "normal" | "alta" | "urgente"
      order_status:
        | "en_espera"
        | "en_preparacion"
        | "enviado"
        | "finalizado"
        | "pausado"
        | "cancelado"
      payment_status:
        | "sin_pago"
        | "pago_parcial"
        | "pagado"
        | "reembolso"
        | "cancelado"
      product_category: "CORTADORES" | "STENCILS" | "CAJAS" | "OTROS"
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
      app_role: ["admin", "colaborador"],
      cutter_modality: ["cutter_only", "cutter_with_stamp"],
      delivery_type: ["envio", "entrega_personal"],
      order_priority: ["baja", "normal", "alta", "urgente"],
      order_status: [
        "en_espera",
        "en_preparacion",
        "enviado",
        "finalizado",
        "pausado",
        "cancelado",
      ],
      payment_status: [
        "sin_pago",
        "pago_parcial",
        "pagado",
        "reembolso",
        "cancelado",
      ],
      product_category: ["CORTADORES", "STENCILS", "CAJAS", "OTROS"],
    },
  },
} as const
