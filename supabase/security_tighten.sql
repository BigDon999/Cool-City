-- SECURITY TIGHTENING SCRIPT FOR COOL CITY (v3 - Optimized & Hardened)
-- Run this in your Supabase SQL Editor to resolve performance warnings and tighten security.

-- 1. PROFILES TABLE (CRITICAL)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    location_pref BOOLEAN DEFAULT true,
    notif_pref BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- AGGRESSIVE CLEANUP OF OLD POLICIES (Matches all known variants)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- REBUILD HARDENED & OPTIMIZED POLICIES
-- NOTE: Using (SELECT auth.uid()) improves performance by preventing re-evaluation on every row
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT  
TO authenticated 
USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING ((SELECT auth.uid()) = id);

-- 2. STORAGE SECURITY (Avatars)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for Avatars (Optimized)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 3. API USAGE QUOTAS
ALTER TABLE IF EXISTS public.api_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Self view usage" ON public.api_usage;
CREATE POLICY "Self view usage" 
ON public.api_usage FOR SELECT 
TO authenticated 
USING ((SELECT auth.uid()) = user_id);

-- 4. ROUTE CACHE
ALTER TABLE IF EXISTS public.route_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read routes" ON public.route_cache;
CREATE POLICY "Auth read routes" 
ON public.route_cache FOR SELECT 
TO authenticated 
USING (true);
