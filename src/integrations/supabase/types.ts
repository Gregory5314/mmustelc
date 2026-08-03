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
      alumni: {
        Row: {
          added_by: string | null
          contact: string | null
          created_at: string
          full_name: string
          graduation_year: number | null
          id: string
          notes: string | null
        }
        Insert: {
          added_by?: string | null
          contact?: string | null
          created_at?: string
          full_name: string
          graduation_year?: number | null
          id?: string
          notes?: string | null
        }
        Update: {
          added_by?: string | null
          contact?: string | null
          created_at?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      chapter_documents: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          slug: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          slug: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          slug?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      chapter_profile: {
        Row: {
          about: string | null
          contact_email: string | null
          contact_phone: string | null
          id: string
          logo_url: string | null
          motto: string | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          about?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          id?: string
          logo_url?: string | null
          motto?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          about?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          id?: string
          logo_url?: string | null
          motto?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          category: string
          created_at: string
          details: string
          id: string
          read_at: string | null
          status: string
          subject: string
          submitter_id: string
        }
        Insert: {
          category: string
          created_at?: string
          details: string
          id?: string
          read_at?: string | null
          status?: string
          subject: string
          submitter_id: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          read_at?: string | null
          status?: string
          subject?: string
          submitter_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          photo_url: string | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          photo_url?: string | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          photo_url?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      events_attended: {
        Row: {
          created_at: string
          event_date: string
          id: string
          notes: string | null
          profile_id: string
          title: string
        }
        Insert: {
          created_at?: string
          event_date: string
          id?: string
          notes?: string | null
          profile_id: string
          title: string
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          notes?: string | null
          profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_attended_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reports: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          notes: string | null
          period: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      gallery_albums: {
        Row: {
          created_at: string
          id: string
          title: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          uploader_id?: string
        }
        Relationships: []
      }
      gallery_comments: {
        Row: {
          album_id: string
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          album_id: string
          body: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          album_id?: string
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_comments_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_photos: {
        Row: {
          album_id: string | null
          caption: string | null
          content_type: string | null
          created_at: string
          file_name: string | null
          id: string
          position: number
          public_url: string
          size_bytes: number | null
          storage_path: string
          taken_at: string
          title: string | null
          uploader_id: string
        }
        Insert: {
          album_id?: string | null
          caption?: string | null
          content_type?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          position?: number
          public_url: string
          size_bytes?: number | null
          storage_path: string
          taken_at?: string
          title?: string | null
          uploader_id: string
        }
        Update: {
          album_id?: string | null
          caption?: string | null
          content_type?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          position?: number
          public_url?: string
          size_bytes?: number | null
          storage_path?: string
          taken_at?: string
          title?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_reactions: {
        Row: {
          album_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          emoji?: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_reactions_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      link_images: {
        Row: {
          image_url: string
          link_key: string
          storage_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          image_url: string
          link_key: string
          storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          image_url?: string
          link_key?: string
          storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      meeting_reports: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          meeting_date: string
          notes: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          meeting_date: string
          notes?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          meeting_date?: string
          notes?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      mentor_assignments: {
        Row: {
          assigned_by: string | null
          assigned_until: string | null
          created_at: string
          id: string
          profile_id: string
          school: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_until?: string | null
          created_at?: string
          id?: string
          profile_id: string
          school: string
        }
        Update: {
          assigned_by?: string | null
          assigned_until?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          school?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_activities: {
        Row: {
          activity_date: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
        }
        Insert: {
          activity_date: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          course: string | null
          created_at: string
          email: string | null
          email_opt_in: boolean
          full_name: string
          id: string
          mentoring_school: string | null
          phone: string | null
          scholar_code: string
          updated_at: string
          year: number | null
        }
        Insert: {
          avatar_url?: string | null
          course?: string | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          full_name?: string
          id: string
          mentoring_school?: string | null
          phone?: string | null
          scholar_code: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          avatar_url?: string | null
          course?: string | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          full_name?: string
          id?: string
          mentoring_school?: string | null
          phone?: string | null
          scholar_code?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          quote_text: string
          scholar_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          quote_text: string
          scholar_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          quote_text?: string
          scholar_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      scholar_recognition: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          recognition_type: string
          scholar_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          recognition_type?: string
          scholar_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          recognition_type?: string
          scholar_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      get_chapter_admin: {
        Args: never
        Returns: {
          about: string | null
          contact_email: string | null
          contact_phone: string | null
          id: string
          logo_url: string | null
          motto: string | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chapter_profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_member_admin_view: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          course: string
          created_at: string
          email: string
          full_name: string
          id: string
          mentoring_school: string
          phone: string
          scholar_code: string
          year: number
        }[]
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          course: string | null
          created_at: string
          email: string | null
          email_opt_in: boolean
          full_name: string
          id: string
          mentoring_school: string | null
          phone: string | null
          scholar_code: string
          updated_at: string
          year: number | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_chapter_officials: {
        Args: never
        Returns: {
          avatar_url: string
          course: string
          email: string
          full_name: string
          id: string
          phone: string
          role: string
          year: number
        }[]
      }
      list_members_directory: {
        Args: never
        Returns: {
          avatar_url: string
          course: string
          full_name: string
          id: string
          year: number
        }[]
      }
      notify_all_members: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      notify_users_with_permission: {
        Args: {
          _body: string
          _link: string
          _permission: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "member"
        | "president"
        | "vice_president"
        | "treasurer"
        | "event_manager"
        | "comm_officer_y1"
        | "comm_officer_y2"
        | "comm_officer_y3"
        | "comm_officer_y4"
        | "secretary_general"
        | "assistant_secretary"
        | "alumni_manager"
        | "mentorship_coordinator"
        | "welfare_coordinator"
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
      app_role: [
        "admin",
        "member",
        "president",
        "vice_president",
        "treasurer",
        "event_manager",
        "comm_officer_y1",
        "comm_officer_y2",
        "comm_officer_y3",
        "comm_officer_y4",
        "secretary_general",
        "assistant_secretary",
        "alumni_manager",
        "mentorship_coordinator",
        "welfare_coordinator",
      ],
    },
  },
} as const
