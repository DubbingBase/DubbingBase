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
          actor_id: number
          content_id: number
          content_type: string | null
          created_at: string | null
          created_by: string | null
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
          actor_id: number
          content_id: number
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
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
          actor_id?: number
          content_id?: number
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
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
      get_top_voice_actors: {
        Args: { limit_param?: number }
        Returns: {
          role_count: number
          voice_actor: Json
        }[]
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
      voice_actor_name: {
        Args: { "": Database["public"]["Tables"]["voice_actors"]["Row"] }
        Returns: string
      }
    }
    Enums: {
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
      voice_actor_status: ["active", "not contacted", "not answered"],
    },
  },
} as const

