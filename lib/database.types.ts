// Types for the public schema. Kept in sync with supabase/migrations/*.sql by hand
// (CLI type-gen needs Docker, which isn't available in this environment).

export type GoalStatus = "on_track" | "at_risk" | "behind" | "hit";
export type UploadStatus = "uploaded" | "processing" | "parsed" | "error";
export type PenaltyKind = "placement" | "missed_goal" | "coach_share";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          avatar_url: string | null;
          is_coach: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email?: string | null;
          avatar_url?: string | null;
          is_coach?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          measure: string | null;
          target_date: string | null;
          coach_id: string | null;
          locked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          measure?: string | null;
          target_date?: string | null;
          coach_id?: string | null;
          locked?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
        Relationships: [];
      };
      goal_progress: {
        Row: {
          id: string;
          goal_id: string;
          progress: number;
          status: GoalStatus;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          progress: number;
          status: GoalStatus;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goal_progress"]["Insert"]>;
        Relationships: [];
      };
      whoop_days: {
        Row: {
          id: string;
          user_id: string;
          day: string;
          score: number | null;
          recovery: number | null;
          strain: number | null;
          resting_hr: number | null;
          hrv: number | null;
          missed: boolean;
          upload_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day: string;
          score?: number | null;
          recovery?: number | null;
          strain?: number | null;
          resting_hr?: number | null;
          hrv?: number | null;
          missed?: boolean;
          upload_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whoop_days"]["Insert"]>;
        Relationships: [];
      };
      uploads: {
        Row: {
          id: string;
          user_id: string;
          file_path: string;
          file_name: string;
          status: UploadStatus;
          rows_ingested: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_path: string;
          file_name: string;
          status?: UploadStatus;
          rows_ingested?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["uploads"]["Insert"]>;
        Relationships: [];
      };
      coaching_notes: {
        Row: {
          id: string;
          goal_id: string;
          author_id: string;
          body: string;
          session_month: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          author_id: string;
          body: string;
          session_month?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coaching_notes"]["Insert"]>;
        Relationships: [];
      };
      penalties: {
        Row: {
          id: string;
          user_id: string;
          kind: PenaltyKind;
          amount_m: number;
          reason: string | null;
          period: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: PenaltyKind;
          amount_m: number;
          reason?: string | null;
          period?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["penalties"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
