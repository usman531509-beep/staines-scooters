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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          id: string
          label: string | null
          module: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          id?: string
          label?: string | null
          module: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          id?: string
          label?: string | null
          module?: string
        }
        Relationships: []
      }
      admin_signatures: {
        Row: {
          signature_data: string
          signed_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          signature_data: string
          signed_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          signature_data?: string
          signed_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          duration_minutes: number
          id: string
          notes: string | null
          scheduled_at: string
          service_type: string
          staff_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          scheduled_at: string
          service_type: string
          staff_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          scheduled_at?: string
          service_type?: string
          staff_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      cash_out_requests: {
        Row: {
          approved_by: string | null
          card_id: string
          cash_value_pence: number
          created_at: string
          customer_signature: string | null
          decided_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          points: number
          requested_by: string | null
          status: Database["public"]["Enums"]["cash_out_status"]
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          card_id: string
          cash_value_pence: number
          created_at?: string
          customer_signature?: string | null
          decided_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          points: number
          requested_by?: string | null
          status?: Database["public"]["Enums"]["cash_out_status"]
          user_id: string
        }
        Update: {
          approved_by?: string | null
          card_id?: string
          cash_value_pence?: number
          created_at?: string
          customer_signature?: string | null
          decided_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          points?: number
          requested_by?: string | null
          status?: Database["public"]["Enums"]["cash_out_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_out_requests_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden: boolean
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          doc_type?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          accident_date: string
          claim_reference: string | null
          claim_submitted_date: string | null
          closed_date: string | null
          commission_amount_pence: number
          commission_received: boolean
          commission_received_date: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_full_name: string
          customer_phone: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          status: string
          storage_amount_pence: number | null
          storage_received: boolean
          storage_received_date: string | null
          updated_at: string
          vehicle_reg: string | null
        }
        Insert: {
          accident_date: string
          claim_reference?: string | null
          claim_submitted_date?: string | null
          closed_date?: string | null
          commission_amount_pence?: number
          commission_received?: boolean
          commission_received_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_full_name: string
          customer_phone?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          storage_amount_pence?: number | null
          storage_received?: boolean
          storage_received_date?: string | null
          updated_at?: string
          vehicle_reg?: string | null
        }
        Update: {
          accident_date?: string
          claim_reference?: string | null
          claim_submitted_date?: string | null
          closed_date?: string | null
          commission_amount_pence?: number
          commission_received?: boolean
          commission_received_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_full_name?: string
          customer_phone?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          storage_amount_pence?: number | null
          storage_received?: boolean
          storage_received_date?: string | null
          updated_at?: string
          vehicle_reg?: string | null
        }
        Relationships: []
      }
      contact_enquiries: {
        Row: {
          bike: string | null
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          name: string
          phone: string
          reg: string | null
          service: string | null
          status: string
        }
        Insert: {
          bike?: string | null
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          name: string
          phone: string
          reg?: string | null
          service?: string | null
          status?: string
        }
        Update: {
          bike?: string | null
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string
          reg?: string | null
          service?: string | null
          status?: string
        }
        Relationships: []
      }
      credit_payments: {
        Row: {
          amount_pence: number
          created_at: string
          id: string
          method: string
          note: string | null
          recorded_by: string | null
          sale_id: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_pence: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          recorded_by?: string | null
          sale_id: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_pence?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          recorded_by?: string | null
          sale_id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_plan_installments: {
        Row: {
          amount_pence: number
          charge_attempts: number
          created_at: string
          due_date: string
          id: string
          last_charge_at: string | null
          last_charge_error: string | null
          method: string | null
          paid_at: string | null
          paid_pence: number
          plan_id: string
          seq: number
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_pence: number
          charge_attempts?: number
          created_at?: string
          due_date: string
          id?: string
          last_charge_at?: string | null
          last_charge_error?: string | null
          method?: string | null
          paid_at?: string | null
          paid_pence?: number
          plan_id: string
          seq: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_pence?: number
          charge_attempts?: number
          created_at?: string
          due_date?: string
          id?: string
          last_charge_at?: string | null
          last_charge_error?: string | null
          method?: string | null
          paid_at?: string | null
          paid_pence?: number
          plan_id?: string
          seq?: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_plan_installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "customer_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_plans: {
        Row: {
          autopay_card_id: string | null
          autopay_enabled: boolean
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          frequency: string
          id: string
          installment_count: number
          notes: string | null
          start_date: string
          status: string
          title: string
          total_pence: number
          updated_at: string
        }
        Insert: {
          autopay_card_id?: string | null
          autopay_enabled?: boolean
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          frequency?: string
          id?: string
          installment_count: number
          notes?: string | null
          start_date?: string
          status?: string
          title?: string
          total_pence: number
          updated_at?: string
        }
        Update: {
          autopay_card_id?: string | null
          autopay_enabled?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          frequency?: string
          id?: string
          installment_count?: number
          notes?: string | null
          start_date?: string
          status?: string
          title?: string
          total_pence?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_saved_cards: {
        Row: {
          brand: string | null
          created_at: string
          environment: string
          exp_month: number | null
          exp_year: number | null
          id: string
          last4: string | null
          payment_method_id: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          environment?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          last4?: string | null
          payment_method_id: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          environment?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          last4?: string | null
          payment_method_id?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_stripe_customers: {
        Row: {
          created_at: string
          environment: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dawat_dinner_attendees: {
        Row: {
          amount_owed_pence: number
          amount_paid_pence: number
          attended: boolean
          created_at: string
          dinner_id: string
          paid_at: string | null
          profile_id: string
          stripe_payment_intent: string | null
          updated_at: string
        }
        Insert: {
          amount_owed_pence?: number
          amount_paid_pence?: number
          attended?: boolean
          created_at?: string
          dinner_id: string
          paid_at?: string | null
          profile_id: string
          stripe_payment_intent?: string | null
          updated_at?: string
        }
        Update: {
          amount_owed_pence?: number
          amount_paid_pence?: number
          attended?: boolean
          created_at?: string
          dinner_id?: string
          paid_at?: string | null
          profile_id?: string
          stripe_payment_intent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dawat_dinner_attendees_dinner_id_fkey"
            columns: ["dinner_id"]
            isOneToOne: false
            referencedRelation: "dawat_dinners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dawat_dinner_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "dawat_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dawat_dinners: {
        Row: {
          calculation_type: string
          created_at: string
          created_by: string | null
          cycle_number: number | null
          date: string
          deleted_at: string | null
          id: string
          payer_id: string
          restaurant_name: string
          total_amount_pence: number
          updated_at: string
        }
        Insert: {
          calculation_type: string
          created_at?: string
          created_by?: string | null
          cycle_number?: number | null
          date: string
          deleted_at?: string | null
          id?: string
          payer_id: string
          restaurant_name: string
          total_amount_pence: number
          updated_at?: string
        }
        Update: {
          calculation_type?: string
          created_at?: string
          created_by?: string | null
          cycle_number?: number | null
          date?: string
          deleted_at?: string | null
          id?: string
          payer_id?: string
          restaurant_name?: string
          total_amount_pence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dawat_dinners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dawat_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dawat_dinners_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "dawat_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dawat_profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          card_saved_at: string | null
          created_at: string
          default_payment_method_id: string | null
          id: string
          pay_token: string | null
          role: string
          stripe_customer_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_saved_at?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          id: string
          pay_token?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_saved_at?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          id?: string
          pay_token?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      dawat_raffle_queue: {
        Row: {
          created_at: string
          cycle_number: number
          dinner_id: string | null
          id: string
          paid_at: string | null
          profile_id: string
          status: string
          turn_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_number: number
          dinner_id?: string | null
          id?: string
          paid_at?: string | null
          profile_id: string
          status?: string
          turn_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_number?: number
          dinner_id?: string | null
          id?: string
          paid_at?: string | null
          profile_id?: string
          status?: string
          turn_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dawat_raffle_queue_dinner_id_fkey"
            columns: ["dinner_id"]
            isOneToOne: false
            referencedRelation: "dawat_dinners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dawat_raffle_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "dawat_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          body: string | null
          created_at: string
          error: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string
          template: string | null
          to_address: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject: string
          template?: string | null
          to_address: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string | null
          to_address?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          batch_id: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          recipient_email: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
          template_data: Json
          template_name: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_email: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_data?: Json
          template_name: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          batch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_email?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_data?: Json
          template_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_reminder_settings: {
        Row: {
          created_at: string
          days_before: number | null
          description: string
          enabled: boolean
          key: string
          label: string
          offset_days: number | null
          offset_months: number | null
          repeat_every_days: number | null
          schedule_note: string
          send_days: string | null
          sort_order: number
          stale_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_before?: number | null
          description?: string
          enabled?: boolean
          key: string
          label: string
          offset_days?: number | null
          offset_months?: number | null
          repeat_every_days?: number | null
          schedule_note?: string
          send_days?: string | null
          sort_order?: number
          stale_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_before?: number | null
          description?: string
          enabled?: boolean
          key?: string
          label?: string
          offset_days?: number | null
          offset_months?: number | null
          repeat_every_days?: number | null
          schedule_note?: string
          send_days?: string | null
          sort_order?: number
          stale_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          body_text: string | null
          created_at: string
          error_message: string | null
          html: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          subject: string | null
          template_name: string
          user_id: string | null
        }
        Insert: {
          body_text?: string | null
          created_at?: string
          error_message?: string | null
          html?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          subject?: string | null
          template_name: string
          user_id?: string | null
        }
        Update: {
          body_text?: string | null
          created_at?: string
          error_message?: string | null
          html?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          subject?: string | null
          template_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_pence: number
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          expense_date: string
          id: string
          is_template: boolean
          next_run_date: string | null
          notes: string | null
          payment_method: string
          recurrence: string
          tax_pence: number
          template_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_pence: number
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_template?: boolean
          next_run_date?: string | null
          notes?: string | null
          payment_method?: string
          recurrence?: string
          tax_pence?: number
          template_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_pence?: number
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_template?: boolean
          next_run_date?: string | null
          notes?: string | null
          payment_method?: string
          recurrence?: string
          tax_pence?: number
          template_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_agreements: {
        Row: {
          accessories_pence: number
          affordability: Json
          apr_pct: number
          autopay_card_id: string | null
          autopay_enabled: boolean
          cash_price_pence: number
          company_signature_data: string | null
          company_signed_at: string | null
          company_signed_by: string | null
          company_signed_name: string | null
          created_at: string
          created_by: string | null
          credit_pence: number
          customer_id: string | null
          customer_snapshot: Json
          deleted_at: string | null
          deposit_pence: number
          fees_pence: number
          final_payment_pence: number | null
          first_payment_date: string
          frequency: string
          id: string
          instalment_pence: number
          interest_pence: number
          method: string
          notes: string | null
          part_ex_pence: number
          part_ex_settlement_pence: number
          rate_pct: number
          ref_no: number
          sign_token: string | null
          signature_data: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          status: string
          term_count: number
          total_payable_pence: number
          updated_at: string
          vehicle: Json
          withdrawal_deadline: string | null
        }
        Insert: {
          accessories_pence?: number
          affordability?: Json
          apr_pct?: number
          autopay_card_id?: string | null
          autopay_enabled?: boolean
          cash_price_pence?: number
          company_signature_data?: string | null
          company_signed_at?: string | null
          company_signed_by?: string | null
          company_signed_name?: string | null
          created_at?: string
          created_by?: string | null
          credit_pence?: number
          customer_id?: string | null
          customer_snapshot?: Json
          deleted_at?: string | null
          deposit_pence?: number
          fees_pence?: number
          final_payment_pence?: number | null
          first_payment_date?: string
          frequency?: string
          id?: string
          instalment_pence?: number
          interest_pence?: number
          method?: string
          notes?: string | null
          part_ex_pence?: number
          part_ex_settlement_pence?: number
          rate_pct?: number
          ref_no?: number
          sign_token?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          status?: string
          term_count?: number
          total_payable_pence?: number
          updated_at?: string
          vehicle?: Json
          withdrawal_deadline?: string | null
        }
        Update: {
          accessories_pence?: number
          affordability?: Json
          apr_pct?: number
          autopay_card_id?: string | null
          autopay_enabled?: boolean
          cash_price_pence?: number
          company_signature_data?: string | null
          company_signed_at?: string | null
          company_signed_by?: string | null
          company_signed_name?: string | null
          created_at?: string
          created_by?: string | null
          credit_pence?: number
          customer_id?: string | null
          customer_snapshot?: Json
          deleted_at?: string | null
          deposit_pence?: number
          fees_pence?: number
          final_payment_pence?: number | null
          first_payment_date?: string
          frequency?: string
          id?: string
          instalment_pence?: number
          interest_pence?: number
          method?: string
          notes?: string | null
          part_ex_pence?: number
          part_ex_settlement_pence?: number
          rate_pct?: number
          ref_no?: number
          sign_token?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          status?: string
          term_count?: number
          total_payable_pence?: number
          updated_at?: string
          vehicle?: Json
          withdrawal_deadline?: string | null
        }
        Relationships: []
      }
      finance_conversation_notes: {
        Row: {
          agreement_id: string
          body: string
          channel: string
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          agreement_id: string
          body: string
          channel?: string
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          agreement_id?: string
          body?: string
          channel?: string
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_conversation_notes_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "finance_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_instalments: {
        Row: {
          agreement_id: string
          amount_pence: number
          charge_attempts: number
          closing_pence: number
          due_date: string
          id: string
          interest_pence: number
          last_charge_at: string | null
          last_charge_error: string | null
          method: string | null
          opening_pence: number
          paid_at: string | null
          paid_pence: number
          principal_pence: number
          seq: number
          status: string
          stripe_payment_intent: string | null
        }
        Insert: {
          agreement_id: string
          amount_pence: number
          charge_attempts?: number
          closing_pence: number
          due_date: string
          id?: string
          interest_pence: number
          last_charge_at?: string | null
          last_charge_error?: string | null
          method?: string | null
          opening_pence: number
          paid_at?: string | null
          paid_pence?: number
          principal_pence: number
          seq: number
          status?: string
          stripe_payment_intent?: string | null
        }
        Update: {
          agreement_id?: string
          amount_pence?: number
          charge_attempts?: number
          closing_pence?: number
          due_date?: string
          id?: string
          interest_pence?: number
          last_charge_at?: string | null
          last_charge_error?: string | null
          method?: string | null
          opening_pence?: number
          paid_at?: string | null
          paid_pence?: number
          principal_pence?: number
          seq?: number
          status?: string
          stripe_payment_intent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_instalments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "finance_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_permissions: {
        Row: {
          perms: string[]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          perms?: string[]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          perms?: string[]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_reconciliations: {
        Row: {
          actual_pence: number
          created_at: string
          created_by: string | null
          expected_pence: number
          id: string
          method: string
          note: string | null
          period_from: string
          period_to: string
        }
        Insert: {
          actual_pence?: number
          created_at?: string
          created_by?: string | null
          expected_pence?: number
          id?: string
          method: string
          note?: string | null
          period_from: string
          period_to: string
        }
        Update: {
          actual_pence?: number
          created_at?: string
          created_by?: string | null
          expected_pence?: number
          id?: string
          method?: string
          note?: string | null
          period_from?: string
          period_to?: string
        }
        Relationships: []
      }
      finance_recoveries: {
        Row: {
          agreement_id: string
          condition: string | null
          costs_pence: number
          court_order_ref: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          mileage: string | null
          notes: string | null
          recovered_on: string
          sale_pence: number
          sold_on: string | null
          status: string
          updated_at: string
          valuation_pence: number
        }
        Insert: {
          agreement_id: string
          condition?: string | null
          costs_pence?: number
          court_order_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          mileage?: string | null
          notes?: string | null
          recovered_on?: string
          sale_pence?: number
          sold_on?: string | null
          status?: string
          updated_at?: string
          valuation_pence?: number
        }
        Update: {
          agreement_id?: string
          condition?: string | null
          costs_pence?: number
          court_order_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          mileage?: string | null
          notes?: string | null
          recovered_on?: string
          sale_pence?: number
          sold_on?: string | null
          status?: string
          updated_at?: string
          valuation_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_recoveries_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "finance_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_settings: {
        Row: {
          agreement_template: string | null
          company_name: string
          company_number: string | null
          default_method: string
          default_rate_pct: number
          email: string | null
          extra_terms: string | null
          fca_frn: string | null
          id: number
          interest_rebate_enabled: boolean
          late_fee_pence: number
          phone: string | null
          registered_address: string | null
          reminder_days_before: number
          trading_address: string | null
          updated_at: string
        }
        Insert: {
          agreement_template?: string | null
          company_name?: string
          company_number?: string | null
          default_method?: string
          default_rate_pct?: number
          email?: string | null
          extra_terms?: string | null
          fca_frn?: string | null
          id?: number
          interest_rebate_enabled?: boolean
          late_fee_pence?: number
          phone?: string | null
          registered_address?: string | null
          reminder_days_before?: number
          trading_address?: string | null
          updated_at?: string
        }
        Update: {
          agreement_template?: string | null
          company_name?: string
          company_number?: string | null
          default_method?: string
          default_rate_pct?: number
          email?: string | null
          extra_terms?: string | null
          fca_frn?: string | null
          id?: number
          interest_rebate_enabled?: boolean
          late_fee_pence?: number
          phone?: string | null
          registered_address?: string | null
          reminder_days_before?: number
          trading_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          agreement_id: string
          amount_pence: number
          created_at: string
          created_by: string | null
          id: string
          interest_pence: number
          kind: string
          method: string | null
          note: string | null
          principal_pence: number
          reference: string | null
          undo_id: string | null
        }
        Insert: {
          agreement_id: string
          amount_pence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          interest_pence?: number
          kind: string
          method?: string | null
          note?: string | null
          principal_pence?: number
          reference?: string | null
          undo_id?: string | null
        }
        Update: {
          agreement_id?: string
          amount_pence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          interest_pence?: number
          kind?: string
          method?: string | null
          note?: string | null
          principal_pence?: number
          reference?: string | null
          undo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "finance_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_undo: {
        Row: {
          agreement_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          snapshot: Json
          undone_at: string | null
        }
        Insert: {
          agreement_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          snapshot: Json
          undone_at?: string | null
        }
        Update: {
          agreement_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          snapshot?: Json
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_undo_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "finance_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          card_id: string | null
          created_at: string
          details: Json
          id: string
          reason: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          reason: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_accident_reports: {
        Row: {
          accident_at: string | null
          agreement_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          insurance_claim: string | null
          is_deleted: boolean | null
          location: string | null
          photos: Json | null
          police_reference: string | null
          updated_at: string
          vehicle_id: string | null
          videos: Json | null
          witnesses: string | null
        }
        Insert: {
          accident_at?: string | null
          agreement_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          insurance_claim?: string | null
          is_deleted?: boolean | null
          location?: string | null
          photos?: Json | null
          police_reference?: string | null
          updated_at?: string
          vehicle_id?: string | null
          videos?: Json | null
          witnesses?: string | null
        }
        Update: {
          accident_at?: string | null
          agreement_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          insurance_claim?: string | null
          is_deleted?: boolean | null
          location?: string | null
          photos?: Json | null
          police_reference?: string | null
          updated_at?: string
          vehicle_id?: string | null
          videos?: Json | null
          witnesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_accident_reports_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "hx_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_accident_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_accident_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_additional_drivers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          date_of_birth: string | null
          deleted_at: string | null
          driving_licence_number: string | null
          email: string | null
          full_name: string
          id: string
          is_deleted: boolean | null
          licence_expiry: string | null
          mobile: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          date_of_birth?: string | null
          deleted_at?: string | null
          driving_licence_number?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_deleted?: boolean | null
          licence_expiry?: string | null
          mobile?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          driving_licence_number?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_deleted?: boolean | null
          licence_expiry?: string | null
          mobile?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hx_additional_drivers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_agreements: {
        Row: {
          actual_return_date: string | null
          body_html: string | null
          body_styles: Json | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          deposit_amount: number
          end_date: string | null
          id: string
          is_deleted: boolean
          notes: string | null
          sent_at: string | null
          share_token: string | null
          signature_data: string | null
          signature_ip: string | null
          signature_name: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          signing_mode: string
          start_date: string
          status: Database["public"]["Enums"]["hx_agreement_status"]
          terms: string | null
          token_expires_at: string | null
          updated_at: string
          vehicle_id: string
          viewed_at: string | null
          weekly_rent: number
        }
        Insert: {
          actual_return_date?: string | null
          body_html?: string | null
          body_styles?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          deposit_amount?: number
          end_date?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          sent_at?: string | null
          share_token?: string | null
          signature_data?: string | null
          signature_ip?: string | null
          signature_name?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signing_mode?: string
          start_date: string
          status?: Database["public"]["Enums"]["hx_agreement_status"]
          terms?: string | null
          token_expires_at?: string | null
          updated_at?: string
          vehicle_id: string
          viewed_at?: string | null
          weekly_rent?: number
        }
        Update: {
          actual_return_date?: string | null
          body_html?: string | null
          body_styles?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          deposit_amount?: number
          end_date?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          sent_at?: string | null
          share_token?: string | null
          signature_data?: string | null
          signature_ip?: string | null
          signature_name?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signing_mode?: string
          start_date?: string
          status?: Database["public"]["Enums"]["hx_agreement_status"]
          terms?: string | null
          token_expires_at?: string | null
          updated_at?: string
          vehicle_id?: string
          viewed_at?: string | null
          weekly_rent?: number
        }
        Relationships: [
          {
            foreignKeyName: "hx_agreements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_agreements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hx_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          role: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          role?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          role?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      hx_communication_log: {
        Row: {
          channel: string
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          occurred_at: string
          staff_id: string | null
          staff_name: string | null
          summary: string
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          staff_id?: string | null
          staff_name?: string | null
          summary: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          staff_id?: string | null
          staff_name?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "hx_communication_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_customers: {
        Row: {
          address: string | null
          cbt_expiry: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          deposit_paid: number | null
          driving_licence_number: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          full_name: string
          home_phone: string | null
          id: string
          is_deleted: boolean
          licence_expiry: string | null
          mobile: string | null
          ni_number: string | null
          notes: string | null
          updated_at: string
          weekly_rent_amount: number | null
        }
        Insert: {
          address?: string | null
          cbt_expiry?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deposit_paid?: number | null
          driving_licence_number?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          full_name: string
          home_phone?: string | null
          id?: string
          is_deleted?: boolean
          licence_expiry?: string | null
          mobile?: string | null
          ni_number?: string | null
          notes?: string | null
          updated_at?: string
          weekly_rent_amount?: number | null
        }
        Update: {
          address?: string | null
          cbt_expiry?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deposit_paid?: number | null
          driving_licence_number?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          full_name?: string
          home_phone?: string | null
          id?: string
          is_deleted?: boolean
          licence_expiry?: string | null
          mobile?: string | null
          ni_number?: string | null
          notes?: string | null
          updated_at?: string
          weekly_rent_amount?: number | null
        }
        Relationships: []
      }
      hx_damage_reports: {
        Row: {
          agreement_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_liability: number | null
          deleted_at: string | null
          description: string
          estimated_cost: number | null
          id: string
          insurance_claim_number: string | null
          is_deleted: boolean | null
          photos: Json | null
          reported_on: string
          status: string | null
          updated_at: string
          vehicle_id: string | null
          videos: Json | null
        }
        Insert: {
          agreement_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_liability?: number | null
          deleted_at?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          insurance_claim_number?: string | null
          is_deleted?: boolean | null
          photos?: Json | null
          reported_on?: string
          status?: string | null
          updated_at?: string
          vehicle_id?: string | null
          videos?: Json | null
        }
        Update: {
          agreement_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_liability?: number | null
          deleted_at?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          insurance_claim_number?: string | null
          is_deleted?: boolean | null
          photos?: Json | null
          reported_on?: string
          status?: string | null
          updated_at?: string
          vehicle_id?: string | null
          videos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_damage_reports_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "hx_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_damage_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_damage_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_documents: {
        Row: {
          agreement_id: string | null
          category: string | null
          country_of_issue: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          doc_number: string | null
          doc_type: string | null
          expiry_date: string | null
          id: string
          is_deleted: boolean
          issue_date: string | null
          metadata: Json | null
          mime_type: string | null
          name: string
          notes: string | null
          pcn_id: string | null
          replaces_id: string | null
          size_bytes: number | null
          storage_path: string
          subcategory: string | null
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          agreement_id?: string | null
          category?: string | null
          country_of_issue?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          doc_number?: string | null
          doc_type?: string | null
          expiry_date?: string | null
          id?: string
          is_deleted?: boolean
          issue_date?: string | null
          metadata?: Json | null
          mime_type?: string | null
          name: string
          notes?: string | null
          pcn_id?: string | null
          replaces_id?: string | null
          size_bytes?: number | null
          storage_path: string
          subcategory?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          agreement_id?: string | null
          category?: string | null
          country_of_issue?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          doc_number?: string | null
          doc_type?: string | null
          expiry_date?: string | null
          id?: string
          is_deleted?: boolean
          issue_date?: string | null
          metadata?: Json | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          pcn_id?: string | null
          replaces_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          subcategory?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_documents_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "hx_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_documents_pcn_id_fkey"
            columns: ["pcn_id"]
            isOneToOne: false
            referencedRelation: "hx_pcns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_documents_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "hx_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          expense_date: string
          id: string
          is_deleted: boolean
          method: Database["public"]["Enums"]["hx_payment_method"] | null
          notes: string | null
          reference: string | null
          updated_at: string
          vehicle_id: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_deleted?: boolean
          method?: Database["public"]["Enums"]["hx_payment_method"] | null
          notes?: string | null
          reference?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_deleted?: boolean
          method?: Database["public"]["Enums"]["hx_payment_method"] | null
          notes?: string | null
          reference?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_income: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          income_date: string
          is_deleted: boolean
          method: Database["public"]["Enums"]["hx_payment_method"] | null
          notes: string | null
          reference: string | null
          source: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          income_date?: string
          is_deleted?: boolean
          method?: Database["public"]["Enums"]["hx_payment_method"] | null
          notes?: string | null
          reference?: string | null
          source?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          income_date?: string
          is_deleted?: boolean
          method?: Database["public"]["Enums"]["hx_payment_method"] | null
          notes?: string | null
          reference?: string | null
          source?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_income_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_income_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_payments: {
        Row: {
          agreement_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean
          kind: string
          method: Database["public"]["Enums"]["hx_payment_method"]
          notes: string | null
          payment_date: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          kind?: string
          method?: Database["public"]["Enums"]["hx_payment_method"]
          notes?: string | null
          payment_date?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          kind?: string
          method?: Database["public"]["Enums"]["hx_payment_method"]
          notes?: string | null
          payment_date?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "hx_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_pcns: {
        Row: {
          agreement_id: string | null
          amount: number | null
          assigned_staff_id: string | null
          attachment_path: string | null
          authority: string | null
          category: string | null
          created_at: string
          created_by: string | null
          customer_acknowledged: boolean
          customer_id: string | null
          deadline_date: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean
          notes: string | null
          offence_date: string | null
          outcome: string | null
          received_date: string | null
          reference_number: string | null
          response_letters_sent: Json
          status: Database["public"]["Enums"]["hx_pcn_status"]
          subcategory: string | null
          type: Database["public"]["Enums"]["hx_pcn_type"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          agreement_id?: string | null
          amount?: number | null
          assigned_staff_id?: string | null
          attachment_path?: string | null
          authority?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          customer_acknowledged?: boolean
          customer_id?: string | null
          deadline_date?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          offence_date?: string | null
          outcome?: string | null
          received_date?: string | null
          reference_number?: string | null
          response_letters_sent?: Json
          status?: Database["public"]["Enums"]["hx_pcn_status"]
          subcategory?: string | null
          type?: Database["public"]["Enums"]["hx_pcn_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          agreement_id?: string | null
          amount?: number | null
          assigned_staff_id?: string | null
          attachment_path?: string | null
          authority?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          customer_acknowledged?: boolean
          customer_id?: string | null
          deadline_date?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          offence_date?: string | null
          outcome?: string | null
          received_date?: string | null
          reference_number?: string | null
          response_letters_sent?: Json
          status?: Database["public"]["Enums"]["hx_pcn_status"]
          subcategory?: string | null
          type?: Database["public"]["Enums"]["hx_pcn_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_pcns_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "hx_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_pcns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_pcns_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_recycle_bin: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          deleted_by_name: string | null
          entity_id: string
          entity_label: string | null
          entity_type: string
          id: string
          snapshot: Json | null
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string | null
          entity_id: string
          entity_label?: string | null
          entity_type: string
          id?: string
          snapshot?: Json | null
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_name?: string | null
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          id?: string
          snapshot?: Json | null
        }
        Relationships: []
      }
      hx_settings: {
        Row: {
          address: string | null
          brand_name: string
          default_terms: string | null
          email: string | null
          id: number
          phone: string | null
          rents_cars: boolean
          rents_motorbikes: boolean
          rents_vans: boolean
          updated_at: string
          vat_rate: number
          vat_registered: boolean
        }
        Insert: {
          address?: string | null
          brand_name?: string
          default_terms?: string | null
          email?: string | null
          id?: number
          phone?: string | null
          rents_cars?: boolean
          rents_motorbikes?: boolean
          rents_vans?: boolean
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          address?: string | null
          brand_name?: string
          default_terms?: string | null
          email?: string | null
          id?: number
          phone?: string | null
          rents_cars?: boolean
          rents_motorbikes?: boolean
          rents_vans?: boolean
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: []
      }
      hx_staff_permissions: {
        Row: {
          can_manage_agreements: boolean
          can_manage_customers: boolean
          can_manage_expenses: boolean
          can_manage_payments: boolean
          can_manage_pcns: boolean
          can_manage_staff: boolean
          can_manage_vehicles: boolean
          can_view_financials: boolean
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_agreements?: boolean
          can_manage_customers?: boolean
          can_manage_expenses?: boolean
          can_manage_payments?: boolean
          can_manage_pcns?: boolean
          can_manage_staff?: boolean
          can_manage_vehicles?: boolean
          can_view_financials?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_agreements?: boolean
          can_manage_customers?: boolean
          can_manage_expenses?: boolean
          can_manage_payments?: boolean
          can_manage_pcns?: boolean
          can_manage_staff?: boolean
          can_manage_vehicles?: boolean
          can_view_financials?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hx_support_tickets: {
        Row: {
          body: string | null
          created_at: string
          id: string
          reply: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          reply?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          reply?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hx_vehicle_inspections: {
        Row: {
          accessories: string | null
          additional_notes: string | null
          agreement_id: string | null
          bodywork: string | null
          brakes: string | null
          cleanliness: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          existing_damage: string | null
          fuel_level: string | null
          helmet_issued: boolean | null
          id: string
          inspection_type: string
          is_deleted: boolean | null
          keys_issued: number | null
          lights: string | null
          lock_issued: boolean | null
          mileage: number | null
          photos: Json | null
          signature_data: string | null
          signature_ip: string | null
          signed_at: string | null
          staff_id: string | null
          staff_name: string | null
          tracker_installed: boolean | null
          tyre_condition: string | null
          updated_at: string
          vehicle_id: string
          videos: Json | null
        }
        Insert: {
          accessories?: string | null
          additional_notes?: string | null
          agreement_id?: string | null
          bodywork?: string | null
          brakes?: string | null
          cleanliness?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          existing_damage?: string | null
          fuel_level?: string | null
          helmet_issued?: boolean | null
          id?: string
          inspection_type: string
          is_deleted?: boolean | null
          keys_issued?: number | null
          lights?: string | null
          lock_issued?: boolean | null
          mileage?: number | null
          photos?: Json | null
          signature_data?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          staff_id?: string | null
          staff_name?: string | null
          tracker_installed?: boolean | null
          tyre_condition?: string | null
          updated_at?: string
          vehicle_id: string
          videos?: Json | null
        }
        Update: {
          accessories?: string | null
          additional_notes?: string | null
          agreement_id?: string | null
          bodywork?: string | null
          brakes?: string | null
          cleanliness?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          existing_damage?: string | null
          fuel_level?: string | null
          helmet_issued?: boolean | null
          id?: string
          inspection_type?: string
          is_deleted?: boolean | null
          keys_issued?: number | null
          lights?: string | null
          lock_issued?: boolean | null
          mileage?: number | null
          photos?: Json | null
          signature_data?: string | null
          signature_ip?: string | null
          signed_at?: string | null
          staff_id?: string | null
          staff_name?: string | null
          tracker_installed?: boolean | null
          tyre_condition?: string | null
          updated_at?: string
          vehicle_id?: string
          videos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hx_vehicle_inspections_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "hx_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_vehicle_inspections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "hx_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hx_vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "hx_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      hx_vehicles: {
        Row: {
          colour: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deposit_amount: number | null
          engine_number: string | null
          id: string
          insurance_expiry: string | null
          insurance_status: string | null
          is_deleted: boolean
          make: string | null
          mileage: number | null
          model: string | null
          mot_expiry: string | null
          notes: string | null
          registration_number: string
          road_tax_status: string | null
          status: Database["public"]["Enums"]["hx_vehicle_status"]
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["hx_vehicle_type"]
          vin: string | null
          weekly_rent_price: number | null
          year: number | null
        }
        Insert: {
          colour?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deposit_amount?: number | null
          engine_number?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_status?: string | null
          is_deleted?: boolean
          make?: string | null
          mileage?: number | null
          model?: string | null
          mot_expiry?: string | null
          notes?: string | null
          registration_number: string
          road_tax_status?: string | null
          status?: Database["public"]["Enums"]["hx_vehicle_status"]
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["hx_vehicle_type"]
          vin?: string | null
          weekly_rent_price?: number | null
          year?: number | null
        }
        Update: {
          colour?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deposit_amount?: number | null
          engine_number?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_status?: string | null
          is_deleted?: boolean
          make?: string | null
          mileage?: number | null
          model?: string | null
          mot_expiry?: string | null
          notes?: string | null
          registration_number?: string
          road_tax_status?: string | null
          status?: Database["public"]["Enums"]["hx_vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["hx_vehicle_type"]
          vin?: string | null
          weekly_rent_price?: number | null
          year?: number | null
        }
        Relationships: []
      }
      insurance_reminders: {
        Row: {
          attempts: number
          created_at: string
          customer_name: string | null
          days_offset: number | null
          error_message: string | null
          id: string
          idempotency_key: string
          insurance_expiry_date: string
          recipient_email: string | null
          registration: string
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          stage: string
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          days_offset?: number | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          insurance_expiry_date: string
          recipient_email?: string | null
          registration: string
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          days_offset?: number | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          insurance_expiry_date?: string
          recipient_email?: string | null
          registration?: string
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_settings: {
        Row: {
          customer_can_edit: boolean
          enabled: boolean
          expired_count: number
          expired_enabled: boolean
          expired_interval_days: number
          id: number
          max_months_after_expiry: number
          monthly_enabled: boolean
          monthly_interval_months: number
          ownership_link_enabled: boolean
          pre_days: number[]
          pre_enabled: boolean
          sender_display_name: string
          updated_at: string
          updated_by: string | null
          whatsapp_enabled: boolean
        }
        Insert: {
          customer_can_edit?: boolean
          enabled?: boolean
          expired_count?: number
          expired_enabled?: boolean
          expired_interval_days?: number
          id?: number
          max_months_after_expiry?: number
          monthly_enabled?: boolean
          monthly_interval_months?: number
          ownership_link_enabled?: boolean
          pre_days?: number[]
          pre_enabled?: boolean
          sender_display_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_enabled?: boolean
        }
        Update: {
          customer_can_edit?: boolean
          enabled?: boolean
          expired_count?: number
          expired_enabled?: boolean
          expired_interval_days?: number
          id?: number
          max_months_after_expiry?: number
          monthly_enabled?: boolean
          monthly_interval_months?: number
          ownership_link_enabled?: boolean
          pre_days?: number[]
          pre_enabled?: boolean
          sender_display_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      insurance_templates: {
        Row: {
          body: string
          cta_text: string
          enabled: boolean
          heading: string
          intro: string
          key: string
          label: string
          sort_order: number
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          cta_text?: string
          enabled?: boolean
          heading: string
          intro?: string
          key: string
          label: string
          sort_order?: number
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          cta_text?: string
          enabled?: boolean
          heading?: string
          intro?: string
          key?: string
          label?: string
          sort_order?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lost_damaged_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          id: string
          notes: string | null
          occurred_on: string
          product_id: string | null
          quantity: number
          reason: Database["public"]["Enums"]["lost_damaged_reason"]
          recorded_by: string | null
          total_cost_pence: number | null
          unit_cost_pence: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          id?: string
          notes?: string | null
          occurred_on?: string
          product_id?: string | null
          quantity: number
          reason?: Database["public"]["Enums"]["lost_damaged_reason"]
          recorded_by?: string | null
          total_cost_pence?: number | null
          unit_cost_pence?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          occurred_on?: string
          product_id?: string | null
          quantity?: number
          reason?: Database["public"]["Enums"]["lost_damaged_reason"]
          recorded_by?: string | null
          total_cost_pence?: number | null
          unit_cost_pence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_damaged_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          barcode: string
          card_number: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          joined_at: string
          level: string
          lifetime_points: number
          lifetime_spend_pence: number
          points_balance: number
          ref_number: number
          status: Database["public"]["Enums"]["card_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode: string
          card_number: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          joined_at?: string
          level?: string
          lifetime_points?: number
          lifetime_spend_pence?: number
          points_balance?: number
          ref_number?: number
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string
          card_number?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          joined_at?: string
          level?: string
          lifetime_points?: number
          lifetime_spend_pence?: number
          points_balance?: number
          ref_number?: number
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          birthday_voucher_pence: number
          cash_out_enabled: boolean
          cash_out_requires_owner_approval: boolean
          default_voucher_expiry_days: number
          id: boolean
          inactive_days: number
          inactive_voucher_pence: number
          level_gold_pence: number
          level_silver_pence: number
          level_vip_pence: number
          max_daily_cash_out_pence: number
          min_cash_out_pence: number
          points_apply_after_discount: boolean
          points_include_vat: boolean
          points_per_pound: number
          points_value_threshold: number
          referral_voucher_pence: number
          rental_earns_points: boolean
          updated_at: string
        }
        Insert: {
          birthday_voucher_pence?: number
          cash_out_enabled?: boolean
          cash_out_requires_owner_approval?: boolean
          default_voucher_expiry_days?: number
          id?: boolean
          inactive_days?: number
          inactive_voucher_pence?: number
          level_gold_pence?: number
          level_silver_pence?: number
          level_vip_pence?: number
          max_daily_cash_out_pence?: number
          min_cash_out_pence?: number
          points_apply_after_discount?: boolean
          points_include_vat?: boolean
          points_per_pound?: number
          points_value_threshold?: number
          referral_voucher_pence?: number
          rental_earns_points?: boolean
          updated_at?: string
        }
        Update: {
          birthday_voucher_pence?: number
          cash_out_enabled?: boolean
          cash_out_requires_owner_approval?: boolean
          default_voucher_expiry_days?: number
          id?: boolean
          inactive_days?: number
          inactive_voucher_pence?: number
          level_gold_pence?: number
          level_silver_pence?: number
          level_vip_pence?: number
          max_daily_cash_out_pence?: number
          min_cash_out_pence?: number
          points_apply_after_discount?: boolean
          points_include_vat?: boolean
          points_per_pound?: number
          points_value_threshold?: number
          referral_voucher_pence?: number
          rental_earns_points?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      mot_audit_log: {
        Row: {
          actor: string | null
          created_at: string
          details: Json
          event: string
          id: string
          registration: string | null
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          details?: Json
          event: string
          id?: string
          registration?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          details?: Json
          event?: string
          id?: string
          registration?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      mot_not_found_notices: {
        Row: {
          corrected_at: string | null
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          recipient_email: string | null
          registration: string
          registration_normalized: string
          resend_requested_by: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          corrected_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          recipient_email?: string | null
          registration: string
          registration_normalized: string
          resend_requested_by?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          corrected_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          recipient_email?: string | null
          registration?: string
          registration_normalized?: string
          resend_requested_by?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mot_not_found_notices_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mot_ownership_tokens: {
        Row: {
          action: string
          created_at: string
          expires_at: string
          id: string
          mot_expiry_date: string | null
          registration: string
          token: string
          used_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          mot_expiry_date?: string | null
          registration: string
          token: string
          used_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          mot_expiry_date?: string | null
          registration?: string
          token?: string
          used_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mot_ownership_tokens_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mot_reminders: {
        Row: {
          attempts: number
          created_at: string
          customer_name: string | null
          days_offset: number | null
          error_message: string | null
          id: string
          idempotency_key: string
          mot_expiry_date: string
          recipient_email: string | null
          registration: string
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          stage: string
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          days_offset?: number | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          mot_expiry_date: string
          recipient_email?: string | null
          registration: string
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          days_offset?: number | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          mot_expiry_date?: string
          recipient_email?: string | null
          registration?: string
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mot_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mot_settings: {
        Row: {
          enabled: boolean
          expired_count: number
          expired_enabled: boolean
          expired_interval_days: number
          id: number
          max_months_after_expiry: number
          monthly_enabled: boolean
          monthly_interval_months: number
          not_found_email_enabled: boolean
          not_found_repeat_prevented: boolean
          ownership_add_prompt_enabled: boolean
          ownership_confirm_heading: string
          ownership_link_enabled: boolean
          ownership_removed_message: string
          pre_days: number[]
          pre_enabled: boolean
          sender_display_name: string
          sync_interval_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          expired_count?: number
          expired_enabled?: boolean
          expired_interval_days?: number
          id?: number
          max_months_after_expiry?: number
          monthly_enabled?: boolean
          monthly_interval_months?: number
          not_found_email_enabled?: boolean
          not_found_repeat_prevented?: boolean
          ownership_add_prompt_enabled?: boolean
          ownership_confirm_heading?: string
          ownership_link_enabled?: boolean
          ownership_removed_message?: string
          pre_days?: number[]
          pre_enabled?: boolean
          sender_display_name?: string
          sync_interval_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          expired_count?: number
          expired_enabled?: boolean
          expired_interval_days?: number
          id?: number
          max_months_after_expiry?: number
          monthly_enabled?: boolean
          monthly_interval_months?: number
          not_found_email_enabled?: boolean
          not_found_repeat_prevented?: boolean
          ownership_add_prompt_enabled?: boolean
          ownership_confirm_heading?: string
          ownership_link_enabled?: boolean
          ownership_removed_message?: string
          pre_days?: number[]
          pre_enabled?: boolean
          sender_display_name?: string
          sync_interval_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mot_sync_runs: {
        Row: {
          api_errors: number
          checked: number
          failed: number
          finished_at: string | null
          id: string
          not_found: number
          notes: string | null
          started_at: string
          status: string
          trigger_source: string
          unchanged: number
          updated: number
        }
        Insert: {
          api_errors?: number
          checked?: number
          failed?: number
          finished_at?: string | null
          id?: string
          not_found?: number
          notes?: string | null
          started_at?: string
          status?: string
          trigger_source?: string
          unchanged?: number
          updated?: number
        }
        Update: {
          api_errors?: number
          checked?: number
          failed?: number
          finished_at?: string | null
          id?: string
          not_found?: number
          notes?: string | null
          started_at?: string
          status?: string
          trigger_source?: string
          unchanged?: number
          updated?: number
        }
        Relationships: []
      }
      mot_templates: {
        Row: {
          body: string
          cta_text: string
          enabled: boolean
          heading: string
          intro: string
          key: string
          label: string
          sort_order: number
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          cta_text?: string
          enabled?: boolean
          heading: string
          intro: string
          key: string
          label: string
          sort_order?: number
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          cta_text?: string
          enabled?: boolean
          heading?: string
          intro?: string
          key?: string
          label?: string
          sort_order?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      offer_progress: {
        Row: {
          completed_at: string | null
          count: number
          id: string
          offer_id: string
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          count?: number
          id?: string
          offer_id: string
          target: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          count?: number
          id?: string
          offer_id?: string
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_progress_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_redemptions: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          offer_name: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          sale_id: string
          savings_pence: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          offer_name: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          sale_id: string
          savings_pence?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          offer_name?: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          sale_id?: string
          savings_pence?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_redemptions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_redemptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          product_id: string | null
          product_ids: string[] | null
          reward_percent: number | null
          reward_value_pence: number | null
          reward_voucher_type:
            | Database["public"]["Enums"]["voucher_type"]
            | null
          rules: Json
          starts_at: string | null
          target_user_id: string | null
          voucher_reward_name: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          offer_type: Database["public"]["Enums"]["offer_type"]
          product_id?: string | null
          product_ids?: string[] | null
          reward_percent?: number | null
          reward_value_pence?: number | null
          reward_voucher_type?:
            | Database["public"]["Enums"]["voucher_type"]
            | null
          rules?: Json
          starts_at?: string | null
          target_user_id?: string | null
          voucher_reward_name?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          offer_type?: Database["public"]["Enums"]["offer_type"]
          product_id?: string | null
          product_ids?: string[] | null
          reward_percent?: number | null
          reward_value_pence?: number | null
          reward_voucher_type?:
            | Database["public"]["Enums"]["voucher_type"]
            | null
          rules?: Json
          starts_at?: string | null
          target_user_id?: string | null
          voucher_reward_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          balance_after: number
          card_id: string
          cash_out_id: string | null
          created_at: string
          id: string
          points: number
          reason: string | null
          sale_id: string | null
          staff_id: string | null
          tx_type: Database["public"]["Enums"]["point_tx_type"]
          user_id: string
          voucher_id: string | null
        }
        Insert: {
          balance_after: number
          card_id: string
          cash_out_id?: string | null
          created_at?: string
          id?: string
          points: number
          reason?: string | null
          sale_id?: string | null
          staff_id?: string | null
          tx_type: Database["public"]["Enums"]["point_tx_type"]
          user_id: string
          voucher_id?: string | null
        }
        Update: {
          balance_after?: number
          card_id?: string
          cash_out_id?: string | null
          created_at?: string
          id?: string
          points?: number
          reason?: string | null
          sale_id?: string | null
          staff_id?: string | null
          tx_type?: Database["public"]["Enums"]["point_tx_type"]
          user_id?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_customers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_title_presets: {
        Row: {
          created_at: string
          id: string
          product_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_title_presets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price_pence: number
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          exclude_from_best_sellers: boolean
          id: string
          image_url: string | null
          is_active: boolean
          is_service: boolean
          min_stock: number
          name: string
          pin_to_best_sellers: boolean
          pos_sort_order: number | null
          retail_price_pence: number
          sku: string | null
          stock_qty: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price_pence?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          exclude_from_best_sellers?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_service?: boolean
          min_stock?: number
          name: string
          pin_to_best_sellers?: boolean
          pos_sort_order?: number | null
          retail_price_pence?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price_pence?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          exclude_from_best_sellers?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_service?: boolean
          min_stock?: number
          name?: string
          pin_to_best_sellers?: boolean
          pos_sort_order?: number | null
          retail_price_pence?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bike_make: string | null
          bike_model: string | null
          bike_reg: string | null
          created_at: string
          credit_pay_token: string | null
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          duplicate_flagged: boolean
          duplicate_reasons: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          referral_code: string | null
          referral_reward_points: number
          referral_rewarded: boolean
          referred_by: string | null
          short_code: string | null
          signup_ip: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bike_make?: string | null
          bike_model?: string | null
          bike_reg?: string | null
          created_at?: string
          credit_pay_token?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duplicate_flagged?: boolean
          duplicate_reasons?: string | null
          email?: string | null
          full_name: string
          id: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          referral_reward_points?: number
          referral_rewarded?: boolean
          referred_by?: string | null
          short_code?: string | null
          signup_ip?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bike_make?: string | null
          bike_model?: string | null
          bike_reg?: string | null
          created_at?: string
          credit_pay_token?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duplicate_flagged?: boolean
          duplicate_reasons?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          referral_reward_points?: number
          referral_rewarded?: boolean
          referred_by?: string | null
          short_code?: string | null
          signup_ip?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          received_qty: number
          sku: string | null
          total_pence: number
          unit_cost_pence: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          received_qty?: number
          sku?: string | null
          total_pence?: number
          unit_cost_pence?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_qty?: number
          sku?: string | null
          total_pence?: number
          unit_cost_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          po_number: string
          received_date: string | null
          status: string
          subtotal_pence: number
          supplier_id: string | null
          tax_pence: number
          total_pence: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          po_number: string
          received_date?: string | null
          status?: string
          subtotal_pence?: number
          supplier_id?: string | null
          tax_pence?: number
          total_pence?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          po_number?: string
          received_date?: string | null
          status?: string
          subtotal_pence?: number
          supplier_id?: string | null
          tax_pence?: number
          total_pence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_reads: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          notification_id: string
          read_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          notification_id: string
          read_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          notification_id?: string
          read_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "push_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          deleted_at: string | null
          delivery_stats: Json
          id: string
          image_url: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          deleted_at?: string | null
          delivery_stats?: Json
          id?: string
          image_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          delivery_stats?: Json
          id?: string
          image_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          created_at: string
          device_label: string | null
          disabled_at: string | null
          endpoint: string | null
          id: string
          last_seen_at: string
          native_token: string | null
          p256dh: string | null
          platform: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key?: string | null
          created_at?: string
          device_label?: string | null
          disabled_at?: string | null
          endpoint?: string | null
          id?: string
          last_seen_at?: string
          native_token?: string | null
          p256dh?: string | null
          platform: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string | null
          created_at?: string
          device_label?: string | null
          disabled_at?: string | null
          endpoint?: string | null
          id?: string
          last_seen_at?: string
          native_token?: string | null
          p256dh?: string | null
          platform?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          discount_pence: number
          id: string
          name: string
          product_id: string | null
          quantity: number
          quote_id: string
          sku: string | null
          total_pence: number
          unit_price_pence: number
        }
        Insert: {
          created_at?: string
          discount_pence?: number
          id?: string
          name: string
          product_id?: string | null
          quantity?: number
          quote_id: string
          sku?: string | null
          total_pence?: number
          unit_price_pence?: number
        }
        Update: {
          created_at?: string
          discount_pence?: number
          id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sku?: string | null
          total_pence?: number
          unit_price_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_pence: number
          expires_at: string | null
          id: string
          notes: string | null
          quote_number: string
          status: string
          subtotal_pence: number
          tax_pence: number
          total_pence: number
          updated_at: string
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_pence?: number
          expires_at?: string | null
          id?: string
          notes?: string | null
          quote_number: string
          status?: string
          subtotal_pence?: number
          tax_pence?: number
          total_pence?: number
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_pence?: number
          expires_at?: string | null
          id?: string
          notes?: string | null
          quote_number?: string
          status?: string
          subtotal_pence?: number
          tax_pence?: number
          total_pence?: number
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_items: {
        Row: {
          amount_pence: number
          created_at: string
          id: string
          name: string
          product_id: string | null
          quantity: number
          refund_id: string
          return_to_stock: boolean
          sale_item_id: string | null
        }
        Insert: {
          amount_pence?: number
          created_at?: string
          id?: string
          name: string
          product_id?: string | null
          quantity?: number
          refund_id: string
          return_to_stock?: boolean
          sale_item_id?: string | null
        }
        Update: {
          amount_pence?: number
          created_at?: string
          id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          refund_id?: string
          return_to_stock?: boolean
          sale_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_items_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_pence: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          payment_method: string
          reason: string | null
          refund_number: string
          sale_id: string | null
        }
        Insert: {
          amount_pence: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          reason?: string | null
          refund_number: string
          sale_id?: string | null
        }
        Update: {
          amount_pence?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          reason?: string | null
          refund_number?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_arrears_installments: {
        Row: {
          admin_id: string
          amount_pence: number
          created_at: string
          due_date: string
          id: string
          method: string | null
          note: string | null
          paid_at: string | null
          plan_id: string
          seq: number
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string
          amount_pence: number
          created_at?: string
          due_date: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          plan_id: string
          seq: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          amount_pence?: number
          created_at?: string
          due_date?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          plan_id?: string
          seq?: number
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_arrears_installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "rental_arrears_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_arrears_plans: {
        Row: {
          active: boolean
          admin_id: string
          autopay_consent_at: string | null
          autopay_enabled: boolean
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          card_updated_at: string | null
          completed_email_at: string | null
          created_at: string
          default_payment_method_id: string | null
          final_pence: number
          id: string
          notes: string | null
          pay_token: string | null
          start_date: string
          stripe_customer_id: string | null
          title: string
          total_pence: number
          updated_at: string
          user_id: string
          vehicles: Json
          weekly_pence: number
        }
        Insert: {
          active?: boolean
          admin_id?: string
          autopay_consent_at?: string | null
          autopay_enabled?: boolean
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_updated_at?: string | null
          completed_email_at?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          final_pence?: number
          id?: string
          notes?: string | null
          pay_token?: string | null
          start_date: string
          stripe_customer_id?: string | null
          title?: string
          total_pence: number
          updated_at?: string
          user_id: string
          vehicles?: Json
          weekly_pence: number
        }
        Update: {
          active?: boolean
          admin_id?: string
          autopay_consent_at?: string | null
          autopay_enabled?: boolean
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_updated_at?: string | null
          completed_email_at?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          final_pence?: number
          id?: string
          notes?: string | null
          pay_token?: string | null
          start_date?: string
          stripe_customer_id?: string | null
          title?: string
          total_pence?: number
          updated_at?: string
          user_id?: string
          vehicles?: Json
          weekly_pence?: number
        }
        Relationships: []
      }
      rental_bikes: {
        Row: {
          active: boolean
          admin_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          make: string
          model: string
          mot_alert_sent_for: string | null
          mot_checked_at: string | null
          mot_expiry_date: string | null
          mot_status: string | null
          notes: string | null
          registration: string
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          admin_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          make: string
          model?: string
          mot_alert_sent_for?: string | null
          mot_checked_at?: string | null
          mot_expiry_date?: string | null
          mot_status?: string | null
          notes?: string | null
          registration: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          admin_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          make?: string
          model?: string
          mot_alert_sent_for?: string | null
          mot_checked_at?: string | null
          mot_expiry_date?: string | null
          mot_status?: string | null
          notes?: string | null
          registration?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      rental_customers: {
        Row: {
          address: string | null
          admin_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          full_name: string
          id: string
          licence_number: string | null
          notes: string | null
          phone: string | null
          photo_path: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admin_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          licence_number?: string | null
          notes?: string | null
          phone?: string | null
          photo_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admin_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          licence_number?: string | null
          notes?: string | null
          phone?: string | null
          photo_path?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_documents: {
        Row: {
          admin_id: string
          created_at: string
          doc_type: string
          expires_at: string | null
          file_name: string
          id: string
          rental_id: string
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          admin_id?: string
          created_at?: string
          doc_type: string
          expires_at?: string | null
          file_name: string
          id?: string
          rental_id: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          rental_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_documents_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_payments: {
        Row: {
          admin_id: string
          amount_pence: number
          created_at: string
          id: string
          kind: string
          method: string
          note: string | null
          paid_at: string
          pcn_id: string | null
          recorded_by: string | null
          rental_id: string
          stripe_session_id: string | null
          updated_at: string
          week_id: string | null
        }
        Insert: {
          admin_id?: string
          amount_pence?: number
          created_at?: string
          id?: string
          kind?: string
          method?: string
          note?: string | null
          paid_at?: string
          pcn_id?: string | null
          recorded_by?: string | null
          rental_id: string
          stripe_session_id?: string | null
          updated_at?: string
          week_id?: string | null
        }
        Update: {
          admin_id?: string
          amount_pence?: number
          created_at?: string
          id?: string
          kind?: string
          method?: string
          note?: string | null
          paid_at?: string
          pcn_id?: string | null
          recorded_by?: string | null
          rental_id?: string
          stripe_session_id?: string | null
          updated_at?: string
          week_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_pcn_fk"
            columns: ["pcn_id"]
            isOneToOne: false
            referencedRelation: "rental_pcns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_payments_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "rental_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_pcns: {
        Row: {
          admin_id: string
          amount_pence: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          document_path: string | null
          id: string
          issued_on: string
          notes: string | null
          reference: string | null
          rental_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_id?: string
          amount_pence?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_path?: string | null
          id?: string
          issued_on: string
          notes?: string | null
          reference?: string | null
          rental_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          amount_pence?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_path?: string | null
          id?: string
          issued_on?: string
          notes?: string | null
          reference?: string | null
          rental_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_pcns_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_settings: {
        Row: {
          created_at: string
          default_billing_day: number
          default_deposit_pence: number
          default_weekly_rate_pence: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          default_billing_day?: number
          default_deposit_pence?: number
          default_weekly_rate_pence?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          default_billing_day?: number
          default_deposit_pence?: number
          default_weekly_rate_pence?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rental_stripe_accounts: {
        Row: {
          admin_id: string
          charges_enabled: boolean
          connected_at: string
          details_submitted: boolean
          display_name: string | null
          email: string | null
          livemode: boolean
          payouts_enabled: boolean
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          charges_enabled?: boolean
          connected_at?: string
          details_submitted?: boolean
          display_name?: string | null
          email?: string | null
          livemode?: boolean
          payouts_enabled?: boolean
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          charges_enabled?: boolean
          connected_at?: string
          details_submitted?: boolean
          display_name?: string | null
          email?: string | null
          livemode?: boolean
          payouts_enabled?: boolean
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rental_weeks: {
        Row: {
          admin_id: string
          amount_pence: number
          charge_attempts: number
          created_at: string
          days_charged: number
          deleted_at: string | null
          id: string
          last_charge_at: string | null
          last_charge_error: string | null
          paid_at: string | null
          rental_id: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          admin_id?: string
          amount_pence?: number
          charge_attempts?: number
          created_at?: string
          days_charged?: number
          deleted_at?: string | null
          id?: string
          last_charge_at?: string | null
          last_charge_error?: string | null
          paid_at?: string | null
          rental_id: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          admin_id?: string
          amount_pence?: number
          charge_attempts?: number
          created_at?: string
          days_charged?: number
          deleted_at?: string | null
          id?: string
          last_charge_at?: string | null
          last_charge_error?: string | null
          paid_at?: string | null
          rental_id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_weeks_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          admin_id: string
          autopay_consent_at: string | null
          autopay_enabled: boolean
          bike_id: string | null
          billing_day: number
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          card_updated_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          default_payment_method_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_paid_pence: number
          deposit_pence: number
          deposit_refunded_at: string | null
          deposit_refunded_pence: number
          end_date: string | null
          id: string
          notes: string | null
          pay_token: string | null
          rental_customer_id: string | null
          start_date: string
          status: string
          stripe_customer_id: string | null
          updated_at: string
          weekly_rate_pence: number
        }
        Insert: {
          admin_id?: string
          autopay_consent_at?: string | null
          autopay_enabled?: boolean
          bike_id?: string | null
          billing_day?: number
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          default_payment_method_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_paid_pence?: number
          deposit_pence?: number
          deposit_refunded_at?: string | null
          deposit_refunded_pence?: number
          end_date?: string | null
          id?: string
          notes?: string | null
          pay_token?: string | null
          rental_customer_id?: string | null
          start_date: string
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          weekly_rate_pence?: number
        }
        Update: {
          admin_id?: string
          autopay_consent_at?: string | null
          autopay_enabled?: boolean
          bike_id?: string | null
          billing_day?: number
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          card_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          default_payment_method_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_paid_pence?: number
          deposit_pence?: number
          deposit_refunded_at?: string | null
          deposit_refunded_pence?: number
          end_date?: string | null
          id?: string
          notes?: string | null
          pay_token?: string | null
          rental_customer_id?: string | null
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
          weekly_rate_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "rentals_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "rental_bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_rental_customer_id_fkey"
            columns: ["rental_customer_id"]
            isOneToOne: false
            referencedRelation: "rental_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      road_tax_audit_log: {
        Row: {
          actor: string | null
          created_at: string
          details: Json
          event: string
          id: string
          registration: string | null
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          details?: Json
          event: string
          id?: string
          registration?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          details?: Json
          event?: string
          id?: string
          registration?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      road_tax_not_found_notices: {
        Row: {
          corrected_at: string | null
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          recipient_email: string | null
          registration: string
          registration_normalized: string
          resend_requested_by: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          corrected_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          recipient_email?: string | null
          registration: string
          registration_normalized: string
          resend_requested_by?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          corrected_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          recipient_email?: string | null
          registration?: string
          registration_normalized?: string
          resend_requested_by?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      road_tax_reminders: {
        Row: {
          attempts: number
          created_at: string
          customer_name: string | null
          days_offset: number | null
          error_message: string | null
          id: string
          idempotency_key: string
          recipient_email: string | null
          registration: string
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          stage: string
          status: string
          tax_due_date: string
          tax_status: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          days_offset?: number | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          recipient_email?: string | null
          registration: string
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          stage?: string
          status?: string
          tax_due_date: string
          tax_status?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          days_offset?: number | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          recipient_email?: string | null
          registration?: string
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          stage?: string
          status?: string
          tax_due_date?: string
          tax_status?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "road_tax_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      road_tax_settings: {
        Row: {
          enabled: boolean
          help_link_wording: string
          id: number
          max_months_after_due: number
          monthly_enabled: boolean
          monthly_interval_months: number
          not_found_email_enabled: boolean
          not_found_repeat_prevented: boolean
          not_found_share_with_mot: boolean
          ownership_link_enabled: boolean
          pre_days: number[]
          pre_enabled: boolean
          sender_display_name: string
          sorn_excluded: boolean
          sorn_info_enabled: boolean
          sync_enabled: boolean
          sync_interval_hours: number
          untaxed_count: number
          untaxed_enabled: boolean
          untaxed_interval_days: number
          updated_at: string
          updated_by: string | null
          whatsapp_enabled: boolean
        }
        Insert: {
          enabled?: boolean
          help_link_wording?: string
          id?: number
          max_months_after_due?: number
          monthly_enabled?: boolean
          monthly_interval_months?: number
          not_found_email_enabled?: boolean
          not_found_repeat_prevented?: boolean
          not_found_share_with_mot?: boolean
          ownership_link_enabled?: boolean
          pre_days?: number[]
          pre_enabled?: boolean
          sender_display_name?: string
          sorn_excluded?: boolean
          sorn_info_enabled?: boolean
          sync_enabled?: boolean
          sync_interval_hours?: number
          untaxed_count?: number
          untaxed_enabled?: boolean
          untaxed_interval_days?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_enabled?: boolean
        }
        Update: {
          enabled?: boolean
          help_link_wording?: string
          id?: number
          max_months_after_due?: number
          monthly_enabled?: boolean
          monthly_interval_months?: number
          not_found_email_enabled?: boolean
          not_found_repeat_prevented?: boolean
          not_found_share_with_mot?: boolean
          ownership_link_enabled?: boolean
          pre_days?: number[]
          pre_enabled?: boolean
          sender_display_name?: string
          sorn_excluded?: boolean
          sorn_info_enabled?: boolean
          sync_enabled?: boolean
          sync_interval_hours?: number
          untaxed_count?: number
          untaxed_enabled?: boolean
          untaxed_interval_days?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      road_tax_sync_runs: {
        Row: {
          api_errors: number
          checked: number
          failed: number
          finished_at: string | null
          id: string
          not_found: number
          notes: string | null
          sorn: number
          started_at: string
          status: string
          taxed: number
          trigger_source: string | null
          unchanged: number
          untaxed: number
          updated: number
        }
        Insert: {
          api_errors?: number
          checked?: number
          failed?: number
          finished_at?: string | null
          id?: string
          not_found?: number
          notes?: string | null
          sorn?: number
          started_at?: string
          status?: string
          taxed?: number
          trigger_source?: string | null
          unchanged?: number
          untaxed?: number
          updated?: number
        }
        Update: {
          api_errors?: number
          checked?: number
          failed?: number
          finished_at?: string | null
          id?: string
          not_found?: number
          notes?: string | null
          sorn?: number
          started_at?: string
          status?: string
          taxed?: number
          trigger_source?: string | null
          unchanged?: number
          untaxed?: number
          updated?: number
        }
        Relationships: []
      }
      road_tax_templates: {
        Row: {
          body: string
          cta_text: string
          enabled: boolean
          heading: string
          intro: string
          key: string
          label: string
          sort_order: number
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          cta_text?: string
          enabled?: boolean
          heading: string
          intro?: string
          key: string
          label: string
          sort_order?: number
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          cta_text?: string
          enabled?: boolean
          heading?: string
          intro?: string
          key?: string
          label?: string
          sort_order?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          cost_price_pence: number | null
          created_at: string
          description: string | null
          discount_pence: number
          id: string
          is_service: boolean
          line_total_pence: number
          mileage: number | null
          name: string
          product_id: string | null
          qty: number
          sale_id: string
          sku: string | null
          unit_price_pence: number
          vat_rate: number
        }
        Insert: {
          cost_price_pence?: number | null
          created_at?: string
          description?: string | null
          discount_pence?: number
          id?: string
          is_service?: boolean
          line_total_pence: number
          mileage?: number | null
          name: string
          product_id?: string | null
          qty?: number
          sale_id: string
          sku?: string | null
          unit_price_pence: number
          vat_rate?: number
        }
        Update: {
          cost_price_pence?: number | null
          created_at?: string
          description?: string | null
          discount_pence?: number
          id?: string
          is_service?: boolean
          line_total_pence?: number
          mileage?: number | null
          name?: string
          product_id?: string | null
          qty?: number
          sale_id?: string
          sku?: string | null
          unit_price_pence?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_pence: number
          appointment_id: string | null
          card_id: string | null
          card_part_pence: number | null
          cash_part_pence: number | null
          cash_tendered_pence: number | null
          created_at: string
          credit_amount_pence: number
          credit_customer_address: string | null
          credit_customer_bike_reg: string | null
          credit_customer_dob: string | null
          credit_customer_email: string | null
          credit_customer_name: string | null
          credit_customer_phone: string | null
          credit_paid_pence: number
          credit_pay_token: string | null
          credit_status: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          discount_pence: number
          id: string
          is_credit_only: boolean
          notes: string | null
          payment_method: string
          points_awarded: number
          pos_customer_id: string | null
          receipt_no: number
          refunded: boolean
          staff_id: string | null
          subtotal_pence: number
          tax_pence: number
          till_session_id: string | null
          user_id: string | null
          vehicle_id: string | null
          voucher_id: string | null
        }
        Insert: {
          amount_pence: number
          appointment_id?: string | null
          card_id?: string | null
          card_part_pence?: number | null
          cash_part_pence?: number | null
          cash_tendered_pence?: number | null
          created_at?: string
          credit_amount_pence?: number
          credit_customer_address?: string | null
          credit_customer_bike_reg?: string | null
          credit_customer_dob?: string | null
          credit_customer_email?: string | null
          credit_customer_name?: string | null
          credit_customer_phone?: string | null
          credit_paid_pence?: number
          credit_pay_token?: string | null
          credit_status?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          discount_pence?: number
          id?: string
          is_credit_only?: boolean
          notes?: string | null
          payment_method?: string
          points_awarded?: number
          pos_customer_id?: string | null
          receipt_no?: number
          refunded?: boolean
          staff_id?: string | null
          subtotal_pence?: number
          tax_pence?: number
          till_session_id?: string | null
          user_id?: string | null
          vehicle_id?: string | null
          voucher_id?: string | null
        }
        Update: {
          amount_pence?: number
          appointment_id?: string | null
          card_id?: string | null
          card_part_pence?: number | null
          cash_part_pence?: number | null
          cash_tendered_pence?: number | null
          created_at?: string
          credit_amount_pence?: number
          credit_customer_address?: string | null
          credit_customer_bike_reg?: string | null
          credit_customer_dob?: string | null
          credit_customer_email?: string | null
          credit_customer_name?: string | null
          credit_customer_phone?: string | null
          credit_paid_pence?: number
          credit_pay_token?: string | null
          credit_status?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          discount_pence?: number
          id?: string
          is_credit_only?: boolean
          notes?: string | null
          payment_method?: string
          points_awarded?: number
          pos_customer_id?: string | null
          receipt_no?: number
          refunded?: boolean
          staff_id?: string | null
          subtotal_pence?: number
          tax_pence?: number
          till_session_id?: string | null
          user_id?: string | null
          vehicle_id?: string | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_customer_id_fkey"
            columns: ["pos_customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_till_session_id_fkey"
            columns: ["till_session_id"]
            isOneToOne: false
            referencedRelation: "till_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reminders: {
        Row: {
          attempts: number
          created_at: string
          customer_name: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          product_name: string | null
          purchase_at: string
          recipient_email: string | null
          reminder_type: string
          sale_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          product_name?: string | null
          purchase_at: string
          recipient_email?: string | null
          reminder_type: string
          sale_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_name?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          product_name?: string | null
          purchase_at?: string
          recipient_email?: string | null
          reminder_type?: string
          sale_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reminders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_claims: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          token: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          token?: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          token?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          categories: boolean
          created_at: string
          customers: boolean
          expenses: boolean
          pos: boolean
          products: boolean
          refunds: boolean
          reports: boolean
          sales: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: boolean
          created_at?: string
          customers?: boolean
          expenses?: boolean
          pos?: boolean
          products?: boolean
          refunds?: boolean
          reports?: boolean
          sales?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: boolean
          created_at?: string
          customers?: boolean
          expenses?: boolean
          pos?: boolean
          products?: boolean
          refunds?: boolean
          reports?: boolean
          sales?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_adjustment_requests: {
        Row: {
          batch_id: string | null
          count_exclude_financial: boolean
          count_movement_type: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_path: string | null
          id: string
          product_id: string
          qty_change: number
          reason: string | null
          reason_type: string
          requested_by: string | null
          status: string
          value_pence: number
        }
        Insert: {
          batch_id?: string | null
          count_exclude_financial?: boolean
          count_movement_type?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_path?: string | null
          id?: string
          product_id: string
          qty_change: number
          reason?: string | null
          reason_type: string
          requested_by?: string | null
          status?: string
          value_pence?: number
        }
        Update: {
          batch_id?: string | null
          count_exclude_financial?: boolean
          count_movement_type?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_path?: string | null
          id?: string
          product_id?: string
          qty_change?: number
          reason?: string | null
          reason_type?: string
          requested_by?: string | null
          status?: string
          value_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_requests_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          batch_code: string
          cost_pence: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          opening_qty: number
          product_id: string
          received_at: string
          reference: string | null
          remaining_qty: number
          sale_price_pence: number | null
          status: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          batch_code: string
          cost_pence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opening_qty: number
          product_id: string
          received_at?: string
          reference?: string | null
          remaining_qty: number
          sale_price_pence?: number | null
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          batch_code?: string
          cost_pence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opening_qty?: number
          product_id?: string
          received_at?: string
          reference?: string | null
          remaining_qty?: number
          sale_price_pence?: number | null
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_postings: {
        Row: {
          cash_delta_pence: number
          created_at: string
          exclude_financial: boolean
          id: string
          inventory_delta_pence: number
          movement_id: string
          physical_value_delta_pence: number
          profit_delta_pence: number
        }
        Insert: {
          cash_delta_pence?: number
          created_at?: string
          exclude_financial: boolean
          id?: string
          inventory_delta_pence: number
          movement_id: string
          physical_value_delta_pence: number
          profit_delta_pence: number
        }
        Update: {
          cash_delta_pence?: number
          created_at?: string
          exclude_financial?: boolean
          id?: string
          inventory_delta_pence?: number
          movement_id?: string
          physical_value_delta_pence?: number
          profit_delta_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_postings_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movement_undos: {
        Row: {
          movement_id: string
          reason: string | null
          undo_movement_id: string | null
          undone_at: string
          undone_by: string | null
        }
        Insert: {
          movement_id: string
          reason?: string | null
          undo_movement_id?: string | null
          undone_at?: string
          undone_by?: string | null
        }
        Update: {
          movement_id?: string
          reason?: string | null
          undo_movement_id?: string | null
          undone_at?: string
          undone_by?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          approval_status: string | null
          approved_by: string | null
          batch_id: string | null
          cost_value_pence: number | null
          created_at: string
          created_by: string | null
          evidence_path: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          qty_after: number | null
          qty_before: number | null
          quantity: number
          reason: string | null
          reason_type: string | null
          reference_id: string | null
          reference_type: string | null
          retail_value_pence: number | null
        }
        Insert: {
          approval_status?: string | null
          approved_by?: string | null
          batch_id?: string | null
          cost_value_pence?: number | null
          created_at?: string
          created_by?: string | null
          evidence_path?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          qty_after?: number | null
          qty_before?: number | null
          quantity: number
          reason?: string | null
          reason_type?: string | null
          reference_id?: string | null
          reference_type?: string | null
          retail_value_pence?: number | null
        }
        Update: {
          approval_status?: string | null
          approved_by?: string | null
          batch_id?: string | null
          cost_value_pence?: number | null
          created_at?: string
          created_by?: string | null
          evidence_path?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          qty_after?: number | null
          qty_before?: number | null
          quantity?: number
          reason?: string | null
          reason_type?: string | null
          reference_id?: string | null
          reference_type?: string | null
          retail_value_pence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_settings: {
        Row: {
          approval_threshold_pence: number | null
          id: number
          updated_at: string
        }
        Insert: {
          approval_threshold_pence?: number | null
          id?: number
          updated_at?: string
        }
        Update: {
          approval_threshold_pence?: number | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      till_cash_movements: {
        Row: {
          amount_pence: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          reason: string | null
          till_session_id: string
        }
        Insert: {
          amount_pence: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          reason?: string | null
          till_session_id: string
        }
        Update: {
          amount_pence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          reason?: string | null
          till_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "till_cash_movements_till_session_id_fkey"
            columns: ["till_session_id"]
            isOneToOne: false
            referencedRelation: "till_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      till_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_count_pence: number | null
          created_at: string
          deleted_at: string | null
          expected_close_pence: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_float_pence: number
          updated_at: string
          variance_pence: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_count_pence?: number | null
          created_at?: string
          deleted_at?: string | null
          expected_close_pence?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_float_pence?: number
          updated_at?: string
          variance_pence?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_count_pence?: number | null
          created_at?: string
          deleted_at?: string | null
          expected_close_pence?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_float_pence?: number
          updated_at?: string
          variance_pence?: number | null
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
      vehicles: {
        Row: {
          colour: string | null
          created_at: string
          dvla_attempts: number
          dvla_error: string | null
          dvla_last_checked_at: string | null
          dvla_last_success_at: string | null
          dvla_sync_status: string
          dvsa_attempts: number
          dvsa_error: string | null
          dvsa_last_checked_at: string | null
          dvsa_last_success_at: string | null
          dvsa_sync_status: string
          engine_capacity: number | null
          fuel_type: string | null
          id: string
          insurance_cycle_key: string | null
          insurance_expiry_date: string | null
          insurance_policy_number: string | null
          insurance_status: string
          insurance_updated_at: string | null
          insurance_updated_by: string | null
          insurer: string | null
          make: string | null
          mileage: number | null
          model: string | null
          month_of_first_registration: string | null
          mot_cycle_key: string | null
          mot_expiry_date: string | null
          mot_last_result: string | null
          mot_last_test_date: string | null
          mot_status: string
          mot_test_due_date: string | null
          notes: string | null
          registration: string
          registration_normalized: string | null
          removed_at: string | null
          sorn_declared: boolean
          source: string | null
          tax_cycle_key: string | null
          tax_due_date: string | null
          tax_status: string
          updated_at: string
          user_id: string | null
          vin: string | null
          year: number | null
          year_of_manufacture: number | null
        }
        Insert: {
          colour?: string | null
          created_at?: string
          dvla_attempts?: number
          dvla_error?: string | null
          dvla_last_checked_at?: string | null
          dvla_last_success_at?: string | null
          dvla_sync_status?: string
          dvsa_attempts?: number
          dvsa_error?: string | null
          dvsa_last_checked_at?: string | null
          dvsa_last_success_at?: string | null
          dvsa_sync_status?: string
          engine_capacity?: number | null
          fuel_type?: string | null
          id?: string
          insurance_cycle_key?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_status?: string
          insurance_updated_at?: string | null
          insurance_updated_by?: string | null
          insurer?: string | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          month_of_first_registration?: string | null
          mot_cycle_key?: string | null
          mot_expiry_date?: string | null
          mot_last_result?: string | null
          mot_last_test_date?: string | null
          mot_status?: string
          mot_test_due_date?: string | null
          notes?: string | null
          registration: string
          registration_normalized?: string | null
          removed_at?: string | null
          sorn_declared?: boolean
          source?: string | null
          tax_cycle_key?: string | null
          tax_due_date?: string | null
          tax_status?: string
          updated_at?: string
          user_id?: string | null
          vin?: string | null
          year?: number | null
          year_of_manufacture?: number | null
        }
        Update: {
          colour?: string | null
          created_at?: string
          dvla_attempts?: number
          dvla_error?: string | null
          dvla_last_checked_at?: string | null
          dvla_last_success_at?: string | null
          dvla_sync_status?: string
          dvsa_attempts?: number
          dvsa_error?: string | null
          dvsa_last_checked_at?: string | null
          dvsa_last_success_at?: string | null
          dvsa_sync_status?: string
          engine_capacity?: number | null
          fuel_type?: string | null
          id?: string
          insurance_cycle_key?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_status?: string
          insurance_updated_at?: string | null
          insurance_updated_by?: string | null
          insurer?: string | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          month_of_first_registration?: string | null
          mot_cycle_key?: string | null
          mot_expiry_date?: string | null
          mot_last_result?: string | null
          mot_last_test_date?: string | null
          mot_status?: string
          mot_test_due_date?: string | null
          notes?: string | null
          registration?: string
          registration_normalized?: string | null
          removed_at?: string | null
          sorn_declared?: boolean
          source?: string | null
          tax_cycle_key?: string | null
          tax_due_date?: string | null
          tax_status?: string
          updated_at?: string
          user_id?: string | null
          vin?: string | null
          year?: number | null
          year_of_manufacture?: number | null
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          expires_at: string | null
          id: string
          issued_sale_id: string | null
          min_spend_pence: number
          name: string
          percent: number | null
          ref_number: number
          source: string | null
          status: Database["public"]["Enums"]["voucher_status"]
          used_at: string | null
          used_sale_id: string | null
          user_id: string | null
          value_pence: number
          voucher_type: Database["public"]["Enums"]["voucher_type"]
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string | null
          id?: string
          issued_sale_id?: string | null
          min_spend_pence?: number
          name: string
          percent?: number | null
          ref_number?: number
          source?: string | null
          status?: Database["public"]["Enums"]["voucher_status"]
          used_at?: string | null
          used_sale_id?: string | null
          user_id?: string | null
          value_pence?: number
          voucher_type: Database["public"]["Enums"]["voucher_type"]
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string | null
          id?: string
          issued_sale_id?: string | null
          min_spend_pence?: number
          name?: string
          percent?: number | null
          ref_number?: number
          source?: string | null
          status?: Database["public"]["Enums"]["voucher_status"]
          used_at?: string | null
          used_sale_id?: string | null
          user_id?: string | null
          value_pence?: number
          voucher_type?: Database["public"]["Enums"]["voucher_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_issued_sale_id_fkey"
            columns: ["issued_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          _batch: string
          _delta: number
          _evidence: string
          _movement_type?: string
          _product: string
          _reason: string
          _reason_type: string
        }
        Returns: Json
      }
      adjust_stock_execute: {
        Args: {
          _approved_by: string
          _batch: string
          _delta: number
          _evidence: string
          _movement_type?: string
          _product: string
          _reason: string
          _reason_type: string
          _user: string
        }
        Returns: Json
      }
      adjust_stock_preview: {
        Args: { _batch: string; _delta: number; _product: string }
        Returns: Json
      }
      db_storage_usage: { Args: never; Returns: Json }
      decide_stock_adjustment: {
        Args: { _approve: boolean; _id: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_user_by_phone: {
        Args: { _phone: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          short_code: string
        }[]
      }
      find_user_by_short_code: {
        Args: { _code: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          short_code: string
        }[]
      }
      generate_profile_short_code: { Args: never; Returns: string }
      get_admin_contacts: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          phone: string
          role: string
          short_code: string
        }[]
      }
      get_loyalty_settings: {
        Args: never
        Returns: {
          birthday_voucher_pence: number
          cash_out_enabled: boolean
          cash_out_requires_owner_approval: boolean
          default_voucher_expiry_days: number
          id: boolean
          inactive_days: number
          inactive_voucher_pence: number
          level_gold_pence: number
          level_silver_pence: number
          level_vip_pence: number
          max_daily_cash_out_pence: number
          min_cash_out_pence: number
          points_apply_after_discount: boolean
          points_include_vat: boolean
          points_per_pound: number
          points_value_threshold: number
          referral_voucher_pence: number
          rental_earns_points: boolean
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "loyalty_settings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profile_summaries: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          short_code: string
        }[]
      }
      has_dawat_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      hx_get_agreement_by_token: {
        Args: { p_token: string }
        Returns: {
          actual_return_date: string | null
          body_html: string | null
          body_styles: Json | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          deposit_amount: number
          end_date: string | null
          id: string
          is_deleted: boolean
          notes: string | null
          sent_at: string | null
          share_token: string | null
          signature_data: string | null
          signature_ip: string | null
          signature_name: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          signing_mode: string
          start_date: string
          status: Database["public"]["Enums"]["hx_agreement_status"]
          terms: string | null
          token_expires_at: string | null
          updated_at: string
          vehicle_id: string
          viewed_at: string | null
          weekly_rent: number
        }[]
        SetofOptions: {
          from: "*"
          to: "hx_agreements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hx_has_access: { Args: { _user_id: string }; Returns: boolean }
      hx_is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_dawat_member: { Args: { _user_id: string }; Returns: boolean }
      is_rental_admin: { Args: { _uid: string }; Returns: boolean }
      is_rental_staff: { Args: { _uid: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_hmc_code: { Args: never; Returns: string }
      phone_available: { Args: { p_phone: string }; Returns: boolean }
      post_stock_count: {
        Args: {
          _batch: string
          _counted: number
          _exclude_financial: boolean
          _expected: number
          _product: string
        }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      receive_stock: {
        Args: {
          _cost_pence: number
          _notes: string
          _product: string
          _qty: number
          _received: string
          _reference: string
          _supplier: string
        }
        Returns: string
      }
      receive_stock_v2: {
        Args: {
          _cost_pence: number
          _make_live: boolean
          _notes: string
          _product: string
          _qty: number
          _received: string
          _reference: string
          _sale_price_pence: number
          _supplier: string
        }
        Returns: string
      }
      rental_can_access: { Args: { _admin: string }; Returns: boolean }
      rental_is_master: { Args: { _uid: string }; Returns: boolean }
      rental_is_owner: {
        Args: { _rental_id: string; _uid: string }
        Returns: boolean
      }
      rental_scope_admin: { Args: { _uid: string }; Returns: string }
      set_stock_approval_threshold: {
        Args: { _pence: number }
        Returns: undefined
      }
      set_stock_batch_archived: {
        Args: { _archived: boolean; _batch: string }
        Returns: undefined
      }
      stock_count_accounts: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      undo_stock_movement: {
        Args: { _movement: string; _reason: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "staff" | "customer"
      card_status: "active" | "suspended" | "closed"
      cash_out_status: "pending" | "approved" | "paid" | "rejected"
      hx_agreement_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "cancelled"
        | "expired"
        | "active"
        | "completed"
      hx_payment_method: "cash" | "bank_transfer" | "card" | "other"
      hx_pcn_status:
        | "new"
        | "sent_to_customer"
        | "awaiting_response"
        | "paid"
        | "disputed"
        | "transferred"
        | "closed"
        | "awaiting_driver_details"
        | "driver_identified"
        | "transferred_to_driver"
        | "customer_responded"
        | "appealed"
        | "under_investigation"
        | "cancelled"
      hx_pcn_type:
        | "parking_ticket"
        | "pcn"
        | "speeding"
        | "police_letter"
        | "nip"
        | "bus_lane"
        | "congestion_ulez"
        | "damage_claim"
        | "accident"
      hx_vehicle_status:
        | "available"
        | "rented"
        | "in_repair"
        | "off_road"
        | "sold"
        | "stolen"
        | "written_off"
      hx_vehicle_type: "motorbike" | "car" | "van"
      lost_damaged_reason: "lost" | "damaged" | "theft" | "expired" | "other"
      offer_type:
        | "buy_x_get_1"
        | "spend_threshold"
        | "category"
        | "bundle"
        | "level"
        | "birthday"
        | "referral"
        | "inactive"
        | "seasonal"
        | "double_points"
        | "percent_off_product"
        | "fixed_off_product"
        | "percent_off_category"
        | "fixed_off_category"
      point_tx_type: "earn" | "redeem" | "adjust" | "refund" | "cash_out"
      voucher_status: "active" | "used" | "expired" | "cancelled"
      voucher_type: "fixed" | "percent" | "free_item" | "free_service"
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
      app_role: ["owner", "admin", "staff", "customer"],
      card_status: ["active", "suspended", "closed"],
      cash_out_status: ["pending", "approved", "paid", "rejected"],
      hx_agreement_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "cancelled",
        "expired",
        "active",
        "completed",
      ],
      hx_payment_method: ["cash", "bank_transfer", "card", "other"],
      hx_pcn_status: [
        "new",
        "sent_to_customer",
        "awaiting_response",
        "paid",
        "disputed",
        "transferred",
        "closed",
        "awaiting_driver_details",
        "driver_identified",
        "transferred_to_driver",
        "customer_responded",
        "appealed",
        "under_investigation",
        "cancelled",
      ],
      hx_pcn_type: [
        "parking_ticket",
        "pcn",
        "speeding",
        "police_letter",
        "nip",
        "bus_lane",
        "congestion_ulez",
        "damage_claim",
        "accident",
      ],
      hx_vehicle_status: [
        "available",
        "rented",
        "in_repair",
        "off_road",
        "sold",
        "stolen",
        "written_off",
      ],
      hx_vehicle_type: ["motorbike", "car", "van"],
      lost_damaged_reason: ["lost", "damaged", "theft", "expired", "other"],
      offer_type: [
        "buy_x_get_1",
        "spend_threshold",
        "category",
        "bundle",
        "level",
        "birthday",
        "referral",
        "inactive",
        "seasonal",
        "double_points",
        "percent_off_product",
        "fixed_off_product",
        "percent_off_category",
        "fixed_off_category",
      ],
      point_tx_type: ["earn", "redeem", "adjust", "refund", "cash_out"],
      voucher_status: ["active", "used", "expired", "cancelled"],
      voucher_type: ["fixed", "percent", "free_item", "free_service"],
    },
  },
} as const
