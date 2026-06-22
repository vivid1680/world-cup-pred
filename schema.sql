-- SQL Migration Script for World Cup 2026 Prediction Web Application
-- This script contains the table definitions, triggers, and Row Level Security (RLS) policies.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---------------------------------------------------------
-- 1. Tables Creation
---------------------------------------------------------

-- Create Users table (syncs with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id INTEGER PRIMARY KEY, -- Using integer ID (e.g., standard FIFA match IDs)
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    kickoff_time TIMESTAMPTZ NOT NULL,
    actual_home_score INTEGER, -- Named actual_home_score as requested
    actual_away_score INTEGER, -- Named actual_away_score as requested
    status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED')) DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Predictions table
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    predicted_home_score INTEGER NOT NULL CHECK (predicted_home_score >= 0),
    predicted_away_score INTEGER NOT NULL CHECK (predicted_away_score >= 0),
    points_awarded INTEGER, -- Nullable until the match finishes and points are calculated
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A user can only submit one prediction per match
    UNIQUE (user_id, match_id)
);

---------------------------------------------------------
-- 2. Automatically Sync Supabase Auth to Public Users
---------------------------------------------------------

-- Trigger function to copy newly signed-up users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username, email, total_points)
    VALUES (
        new.id,
        COALESCE(
            new.raw_user_meta_data->>'username', 
            'user_' || SUBSTR(new.id::TEXT, 1, 8)
        ),
        new.email,
        0
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute handle_new_user() when auth.users row is inserted
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

---------------------------------------------------------
-- 3. Row Level Security (RLS) Configuration
---------------------------------------------------------

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- 3a. Users Table Policies
-- Everyone can read user points and profiles
DROP POLICY IF EXISTS "Allow public read access to users" ON public.users;
CREATE POLICY "Allow public read access to users" 
    ON public.users FOR SELECT 
    USING (true);

-- Users can update their own user profiles (e.g., username change)
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
CREATE POLICY "Allow users to update their own profile" 
    ON public.users FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3b. Matches Table Policies
-- Everyone can read matches
DROP POLICY IF EXISTS "Allow public read access to matches" ON public.matches;
CREATE POLICY "Allow public read access to matches" 
    ON public.matches FOR SELECT 
    USING (true);

-- Matches should only be managed by admins (e.g., no public/authenticated write policy is created)
-- Only service_role can modify matches by default

-- 3c. Predictions Table Policies
-- Users can read their own predictions
DROP POLICY IF EXISTS "Allow users to read their own predictions" ON public.predictions;
CREATE POLICY "Allow users to read their own predictions" 
    ON public.predictions FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own predictions
DROP POLICY IF EXISTS "Allow users to insert their own predictions" ON public.predictions;
CREATE POLICY "Allow users to insert their own predictions" 
    ON public.predictions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own predictions
DROP POLICY IF EXISTS "Allow users to update their own predictions" ON public.predictions;
CREATE POLICY "Allow users to update their own predictions" 
    ON public.predictions FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own predictions
DROP POLICY IF EXISTS "Allow users to delete their own predictions" ON public.predictions;
CREATE POLICY "Allow users to delete their own predictions" 
    ON public.predictions FOR DELETE 
    USING (auth.uid() = user_id);

---------------------------------------------------------
-- 4. Useful Indexes for Performance
---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON public.predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff_time ON public.matches(kickoff_time);
CREATE INDEX IF NOT EXISTS idx_users_total_points ON public.users(total_points DESC);

---------------------------------------------------------
-- 5. Settle Match RPC (Remote Procedure Call) Function
---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_match_rpc(
    p_match_id INT,
    p_actual_home_score INT,
    p_actual_away_score INT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the match score and status in public.matches
    UPDATE public.matches
    SET 
        actual_home_score = p_actual_home_score,
        actual_away_score = p_actual_away_score,
        status = 'FINISHED'
    WHERE id = p_match_id;

    -- 2. Update points for all predictions of this match
    -- 3 points for exact score match, 1 point for outcome, 0 points otherwise
    UPDATE public.predictions
    SET points_awarded = CASE
        WHEN predicted_home_score = p_actual_home_score AND predicted_away_score = p_actual_away_score THEN 3
        WHEN SIGN(predicted_home_score - predicted_away_score) = SIGN(p_actual_home_score - p_actual_away_score) THEN 1
        ELSE 0
    END
    WHERE match_id = p_match_id;

    -- 3. Recalculate total_points in public.users for every user affected
    UPDATE public.users u
    SET total_points = COALESCE((
        SELECT SUM(points_awarded)
        FROM public.predictions p
        WHERE p.user_id = u.id
    ), 0)
    WHERE u.id IN (
        SELECT user_id 
        FROM public.predictions
        WHERE match_id = p_match_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
