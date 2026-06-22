// TypeScript interfaces for the World Cup 2026 Prediction Web Application Database Schema
// These types map exactly to the Supabase PostgreSQL database tables.

/**
 * Clean model types for use in frontend components
 */

export interface User {
  id: string; // UUID (matching Supabase Auth user ID)
  username: string;
  email: string;
  total_points: number;
  created_at: string; // ISO timestamptz string
}

export interface Match {
  id: number; // Unique match ID
  home_team: string;
  away_team: string;
  kickoff_time: string; // ISO timestamptz string
  actual_home_score: number | null; // Nullable until match starts/finishes
  actual_away_score: number | null; // Nullable until match starts/finishes
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  created_at: string; // ISO timestamptz string
}

export interface Prediction {
  id: string; // UUID primary key
  user_id: string; // UUID referencing User
  match_id: number; // Reference to Match
  predicted_home_score: number;
  predicted_away_score: number;
  points_awarded: number | null; // Nullable until match ends and points are calculated
  created_at: string; // ISO timestamptz string
}

/**
 * Database types helper (Supabase CLI compatible format)
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: {
          id: string;
          username: string;
          email: string;
          total_points?: number; // Optional on insert, default is 0
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          total_points?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      matches: {
        Row: Match;
        Insert: {
          id: number;
          home_team: string;
          away_team: string;
          kickoff_time: string;
          actual_home_score?: number | null;
          actual_away_score?: number | null;
          status?: 'SCHEDULED' | 'LIVE' | 'FINISHED'; // Defaults to 'SCHEDULED'
          created_at?: string;
        };
        Update: {
          id?: number;
          home_team?: string;
          away_team?: string;
          kickoff_time?: string;
          actual_home_score?: number | null;
          actual_away_score?: number | null;
          status?: 'SCHEDULED' | 'LIVE' | 'FINISHED';
          created_at?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: Prediction;
        Insert: {
          id?: string; // Optional, defaults to gen_random_uuid()
          user_id: string;
          match_id: number;
          predicted_home_score: number;
          predicted_away_score: number;
          points_awarded?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          match_id?: number;
          predicted_home_score?: number;
          predicted_away_score?: number;
          points_awarded?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenient helper types for components
export type DbRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type DbInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type DbUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export type MatchWithPrediction = Match & {
  user_prediction: Prediction | null;
};
