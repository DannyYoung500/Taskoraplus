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
      app_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          admin_label: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_value: Json | null
          previous_value: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          admin_label?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          admin_label?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          advertiser_id: string | null
          advertiser_name: string | null
          budget: number
          created_at: string
          ends_at: string | null
          id: string
          name: string
          slots: number
          slots_left: number
          spent: number
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          advertiser_id?: string | null
          advertiser_name?: string | null
          budget?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          slots?: number
          slots_left?: number
          spent?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          advertiser_id?: string | null
          advertiser_name?: string | null
          budget?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          slots?: number
          slots_left?: number
          spent?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          reference: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          notes?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          details: string | null
          id: string
          investigation_note: string | null
          kind: string
          related_id: string | null
          severity: string
          status: Database["public"]["Enums"]["fraud_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          investigation_note?: string | null
          kind: string
          related_id?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["fraud_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          investigation_note?: string | null
          kind?: string
          related_id?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["fraud_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          is_broadcast: boolean
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          is_broadcast?: boolean
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          is_broadcast?: boolean
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          created_at: string
          display_name: string
          id: string
          last_active_at: string | null
          last_checkin: string | null
          level: string
          photo_url: string | null
          referral_code: string
          referred_by: string | null
          status: Database["public"]["Enums"]["user_status"]
          streak: number
          telegram_id: number | null
          updated_at: string
          username: string | null
          task_points: number
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          display_name?: string
          id: string
          last_active_at?: string | null
          last_checkin?: string | null
          level?: string
          photo_url?: string | null
          referral_code: string
          referred_by?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          streak?: number
          telegram_id?: number | null
          updated_at?: string
          username?: string | null
          task_points?: number
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_active_at?: string | null
          last_checkin?: string | null
          level?: string
          photo_url?: string | null
          referral_code?: string
          referred_by?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          streak?: number
          telegram_id?: number | null
          updated_at?: string
          username?: string | null
          task_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          fraud_flag: boolean
          id: string
          proof_text: string | null
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fraud_flag?: boolean
          id?: string
          proof_text?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fraud_flag?: boolean
          id?: string
          proof_text?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          body: string | null
          created_at: string
          id: string
          priority: string
          resolution_notes: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          advertiser: string
          budget: number | null
          campaign_id: string | null
          completion_limit: number
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: string | null
          ends_at: string | null
          id: string
          instructions: string | null
          is_active: boolean
          link: string | null
          platform: Database["public"]["Enums"]["task_platform"]
          proof: Database["public"]["Enums"]["proof_type"]
          requires_review: boolean
          reward: number
          seconds: number
          slots_left: number
          slots_total: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          steps: string[]
          target: string | null
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          advertiser: string
          budget?: number | null
          campaign_id?: string | null
          completion_limit?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string | null
          ends_at?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          link?: string | null
          platform: Database["public"]["Enums"]["task_platform"]
          proof?: Database["public"]["Enums"]["proof_type"]
          requires_review?: boolean
          reward: number
          seconds?: number
          slots_left?: number
          slots_total?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          steps?: string[]
          target?: string | null
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          advertiser?: string
          budget?: number | null
          campaign_id?: string | null
          completion_limit?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string | null
          ends_at?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          link?: string | null
          platform?: Database["public"]["Enums"]["task_platform"]
          proof?: Database["public"]["Enums"]["proof_type"]
          requires_review?: boolean
          reward?: number
          seconds?: number
          slots_left?: number
          slots_total?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          steps?: string[]
          target?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["tx_kind"]
          label: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["tx_kind"]
          label: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          address: string
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          method: string
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          rejection_reason: string | null
          risk_status: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          method: string
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          risk_status?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          method?: string
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          risk_status?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "advertiser" | "user"
      campaign_status:
        | "draft"
        | "pending_funding"
        | "pending_review"
        | "active"
        | "paused"
        | "completed"
        | "rejected"
        | "expired"
        | "cancelled"
      deposit_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      fraud_status: "open" | "investigating" | "cleared" | "actioned"
      proof_type: "auto" | "screenshot" | "username"
      submission_status: "pending" | "verified" | "rejected"
      task_platform:
        | "telegram"
        | "youtube"
        | "whatsapp"
        | "x"
        | "instagram"
        | "tiktok"
        | "discord"
        | "facebook"
      task_status:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "cancelled"
        | "expired"
        | "rejected"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      tx_kind: "reward" | "referral" | "bonus" | "withdrawal"
      user_status: "active" | "suspended" | "banned"
      withdrawal_status:
        | "pending"
        | "processing"
        | "paid"
        | "rejected"
        | "failed"
        | "manual_review"
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
      app_role: ["admin", "advertiser", "user"],
      campaign_status: [
        "draft",
        "pending_funding",
        "pending_review",
        "active",
        "paused",
        "completed",
        "rejected",
        "expired",
        "cancelled",
      ],
      deposit_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      fraud_status: ["open", "investigating", "cleared", "actioned"],
      proof_type: ["auto", "screenshot", "username"],
      submission_status: ["pending", "verified", "rejected"],
      task_platform: [
        "telegram",
        "youtube",
        "whatsapp",
        "x",
        "instagram",
        "tiktok",
        "discord",
        "facebook",
      ],
      task_status: [
        "draft",
        "active",
        "paused",
        "completed",
        "cancelled",
        "expired",
        "rejected",
      ],
      ticket_status: ["open", "pending", "resolved", "closed"],
      tx_kind: ["reward", "referral", "bonus", "withdrawal"],
      user_status: ["active", "suspended", "banned"],
      withdrawal_status: [
        "pending",
        "processing",
        "paid",
        "rejected",
        "failed",
        "manual_review",
      ],
    },
  },
} as const
