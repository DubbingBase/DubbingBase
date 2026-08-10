export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          points_awarded: number | null
          previous_value: Json | null
          reverted_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          points_awarded?: number | null
          previous_value?: Json | null
          reverted_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          points_awarded?: number | null
          previous_value?: Json | null
          reverted_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dubbing_project_crew: {
        Row: {
          created_at: string | null
          dubbing_project_id: number
          id: number
          job_id: number
          person_id: number
        }
        Insert: {
          created_at?: string | null
          dubbing_project_id: number
          id?: number
          job_id: number
          person_id: number
        }
        Update: {
          created_at?: string | null
          dubbing_project_id?: number
          id?: number
          job_id?: number
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dubbing_project_crew_dubbing_project_id_fkey"
            columns: ["dubbing_project_id"]
            isOneToOne: false
            referencedRelation: "dubbing_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dubbing_project_crew_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dubbing_project_crew_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "voice_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      dubbing_projects: {
        Row: {
          content_id: number
          content_type: string
          created_at: string | null
          id: number
          language: string | null
          status: string | null
          studio_id: number | null
          updated_at: string | null
        }
        Insert: {
          content_id: number
          content_type: string
          created_at?: string | null
          id?: number
          language?: string | null
          status?: string | null
          studio_id?: number | null
          updated_at?: string | null
        }
        Update: {
          content_id?: number
          content_type?: string
          created_at?: string | null
          id?: number
          language?: string | null
          status?: string | null
          studio_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dubbing_projects_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_task_locks: {
        Row: {
          category: string
          entity_id: string
          locked_at: string | null
        }
        Insert: {
          category: string
          entity_id: string
          locked_at?: string | null
        }
        Update: {
          category?: string
          entity_id?: string
          locked_at?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      project_attachments: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          dubbing_project_id: number
          file_name: string
          file_path: string
          id: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          dubbing_project_id: number
          file_name: string
          file_path: string
          id?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          dubbing_project_id?: number
          file_name?: string
          file_path?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_dubbing_project_id_fkey"
            columns: ["dubbing_project_id"]
            isOneToOne: false
            referencedRelation: "dubbing_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      source: {
        Row: {
          id: number
          name: string | null
          suggested_at: string | null
          user_id: number | null
        }
        Insert: {
          id?: number
          name?: string | null
          suggested_at?: string | null
          user_id?: number | null
        }
        Update: {
          id?: number
          name?: string | null
          suggested_at?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      studios: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          id: number
          logo_url: string | null
          name: string
          social_media_links: Json | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          logo_url?: string | null
          name: string
          social_media_links?: Json | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          social_media_links?: Json | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          id: string
          nationality: string | null
          social_media_links: Json | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          id?: string
          nationality?: string | null
          social_media_links?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          id?: string
          nationality?: string | null
          social_media_links?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["user_report_status"]
          target_url: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["user_report_status"]
          target_url: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["user_report_status"]
          target_url?: string
        }
        Relationships: []
      }
      user_voice_actor_links: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          voice_actor_id: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          voice_actor_id: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          voice_actor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_voice_actor_links_voice_actor_id_fkey"
            columns: ["voice_actor_id"]
            isOneToOne: false
            referencedRelation: "voice_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_actor_subscriptions: {
        Row: {
          created_at: string
          user_id: string
          voice_actor_id: number
        }
        Insert: {
          created_at?: string
          user_id: string
          voice_actor_id: number
        }
        Update: {
          created_at?: string
          user_id?: string
          voice_actor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_actor_subscriptions_voice_actor_id_fkey"
            columns: ["voice_actor_id"]
            isOneToOne: false
            referencedRelation: "voice_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_actors: {
        Row: {
          awards: string | null
          bio: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          firstname: string
          id: number
          lastname: string
          nationality: string | null
          profile_picture: string | null
          social_media_links: Json | null
          status: Database["public"]["Enums"]["voice_actor_status"] | null
          tmdb_id: number | null
          updated_at: string | null
          updated_by: string | null
          wikidata_id: string | null
          years_active: string | null
          voice_actor_name: string | null
        }
        Insert: {
          awards?: string | null
          bio?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          firstname: string
          id?: number
          lastname: string
          nationality?: string | null
          profile_picture?: string | null
          social_media_links?: Json | null
          status?: Database["public"]["Enums"]["voice_actor_status"] | null
          tmdb_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
          wikidata_id?: string | null
          years_active?: string | null
        }
        Update: {
          awards?: string | null
          bio?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          firstname?: string
          id?: number
          lastname?: string
          nationality?: string | null
          profile_picture?: string | null
          social_media_links?: Json | null
          status?: Database["public"]["Enums"]["voice_actor_status"] | null
          tmdb_id?: number | null
          updated_at?: string | null
          updated_by?: string | null
          wikidata_id?: string | null
          years_active?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string | null
          id: number
          user_id: string
          vote_type: string
          work_id: number
        }
        Insert: {
          created_at?: string | null
          id?: never
          user_id: string
          vote_type: string
          work_id: number
        }
        Update: {
          created_at?: string | null
          id?: never
          user_id?: string
          vote_type?: string
          work_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "work"
            referencedColumns: ["id"]
          },
        ]
      }
      work: {
        Row: {
          actor_id: number | null
          character_id: number | null
          character_name: string | null
          created_at: string | null
          created_by: string | null
          dubbing_project_id: number
          highlight: boolean | null
          id: number
          performance: string | null
          reviewed_status: string | null
          source_id: number | null
          status: string | null
          suggestions: string | null
          updated_at: string | null
          updated_by: string | null
          voice_actor_id: number | null
        }
        Insert: {
          actor_id?: number | null
          character_id?: number | null
          character_name?: string | null
          created_at?: string | null
          created_by?: string | null
          dubbing_project_id: number
          highlight?: boolean | null
          id?: number
          performance?: string | null
          reviewed_status?: string | null
          source_id?: number | null
          status?: string | null
          suggestions?: string | null
          updated_at?: string | null
          updated_by?: string | null
          voice_actor_id?: number | null
        }
        Update: {
          actor_id?: number | null
          character_id?: number | null
          character_name?: string | null
          created_at?: string | null
          created_by?: string | null
          dubbing_project_id?: number
          highlight?: boolean | null
          id?: number
          performance?: string | null
          reviewed_status?: string | null
          source_id?: number | null
          status?: string | null
          suggestions?: string | null
          updated_at?: string | null
          updated_by?: string | null
          voice_actor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_dubbing_project_id_fkey"
            columns: ["dubbing_project_id"]
            isOneToOne: false
            referencedRelation: "dubbing_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_voice_actor_id_fkey"
            columns: ["voice_actor_id"]
            isOneToOne: false
            referencedRelation: "voice_actors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_media_queue_message: {
        Args: { p_msg_id: number }
        Returns: boolean
      }
      archive_media_queue_message_with_error: {
        Args: { p_error: string; p_msg_id: number }
        Returns: boolean
      }
      clear_media_queue: { Args: never; Returns: boolean }
      delete_media_queue_item: { Args: { p_id: number }; Returns: boolean }
      dubbing_project_completeness: {
        Args: { dp: Database["public"]["Tables"]["dubbing_projects"]["Row"] }
        Returns: number
      }
      enqueue_media_fetch: {
        Args: {
          p_episode_number?: number
          p_media_type: string
          p_season_number?: number
          p_tmdb_id: number
        }
        Returns: number
      }
      find_duplicate_voice_actors_rpc: { Args: never; Returns: Json }
      get_media_queue_depth: { Args: never; Returns: number }
      get_media_queue_items: {
        Args: never
        Returns: {
          created_at: string
          episode_number: number
          error_message: string
          id: number
          media_type: string
          season_number: number
          status: string
          tmdb_id: number
          updated_at: string
          user_id: string
        }[]
      }
      get_media_queue_locked_count: { Args: never; Returns: number }
      get_media_queue_status: {
        Args: {
          p_episode_number?: number
          p_media_type: string
          p_season_number?: number
          p_tmdb_id: number
        }
        Returns: Json
      }
      get_recent_contributions: {
        Args: { limit_param?: number }
        Returns: {
          action: string
          created_at: string
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          points_awarded: number
          user_name: string
        }[]
      }
      get_top_contributors: {
        Args: { limit_param?: number }
        Returns: {
          raw_user_meta_data: Json
          score: number
          user_id: string
        }[]
      }
      get_top_voice_actors: {
        Args: { limit_param?: number }
        Returns: {
          role_count: number
          voice_actor: Json
        }[]
      }
      get_work_votes_with_user: {
        Args: { p_user_id?: string; p_work_ids: number[] }
        Returns: {
          down_count: number
          up_count: number
          user_vote: string
          work_id: number
        }[]
      }
      match_voice_actor: {
        Args: { p_firstname: string; p_lastname: string }
        Returns: {
          awards: string | null
          bio: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          firstname: string
          id: number
          lastname: string
          nationality: string | null
          profile_picture: string | null
          social_media_links: Json | null
          status: Database["public"]["Enums"]["voice_actor_status"] | null
          tmdb_id: number | null
          updated_at: string | null
          updated_by: string | null
          wikidata_id: string | null
          years_active: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "voice_actors"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      merge_voice_actors: {
        Args: { p_keep_id: number; p_other_ids: number[] }
        Returns: undefined
      }
      normalize_actor_name: { Args: { str: string }; Returns: string }
      pop_media_queue_message: {
        Args: { p_vt_seconds?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      voice_actor_completeness: {
        Args: { va: Database["public"]["Tables"]["voice_actors"]["Row"] }
        Returns: number
      }
      voice_actor_name: {
        Args: { "": Database["public"]["Tables"]["voice_actors"]["Row"] }
        Returns: {
          error: true
        } & "the function public.voice_actor_name with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
    }
    Enums: {
      user_report_status: "pending" | "resolved" | "dismissed"
      voice_actor_status: "active" | "not contacted" | "not answered"
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
      user_report_status: ["pending", "resolved", "dismissed"],
      voice_actor_status: ["active", "not contacted", "not answered"],
    },
  },
} as const

