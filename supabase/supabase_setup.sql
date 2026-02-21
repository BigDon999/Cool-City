-- 1. CLEAN TEARDOWN (Unlocks the extension for moving)
DROP FUNCTION IF EXISTS public.get_nearby_cooling_centers(double precision, double precision, double precision) CASCADE;
DROP FUNCTION IF EXISTS public.clean_route_cache() CASCADE;
DROP TABLE IF EXISTS public.cooling_centers CASCADE;
DROP TABLE IF EXISTS public.route_cache CASCADE;
DROP TABLE IF EXISTS public.api_usage CASCADE;

-- 2. SCHEMA ISOLATION (Clears spatial_ref_sys RLS error)
DROP EXTENSION IF EXISTS postgis CASCADE;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION postgis WITH SCHEMA extensions;

-- 3. GLOBAL DISCOVERY
ALTER ROLE authenticated SET search_path TO public, extensions;
ALTER ROLE service_role SET search_path TO public, extensions;
ALTER ROLE anon SET search_path TO public, extensions;
ALTER ROLE postgres SET search_path TO public, extensions;
SET search_path TO public, extensions;

-- 4. REBUILD CORE TABLES
CREATE TABLE public.cooling_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    type TEXT CHECK (type IN ('cooling', 'hydration', 'park')) DEFAULT 'cooling',
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    capacity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX cooling_centers_location_idx ON public.cooling_centers USING GIST (location);
ALTER TABLE public.cooling_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View active centers" ON public.cooling_centers FOR SELECT USING (status = 'active');
GRANT SELECT ON public.cooling_centers TO anon;
GRANT SELECT ON public.cooling_centers TO authenticated;

-- 5. REBUILD CACHE
CREATE TABLE public.route_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_hash TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read routes" ON public.route_cache FOR SELECT TO authenticated USING (true);

-- 6. REBUILD QUOTAS
CREATE TABLE public.api_usage (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    daily_count INTEGER DEFAULT 0,
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self view usage" ON public.api_usage FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 7. SECURE FUNCTIONS (Fixed: Search Path Mutable)
CREATE OR REPLACE FUNCTION public.get_nearby_cooling_centers(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    dist_limit_meters DOUBLE PRECISION DEFAULT 20000.0
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    address TEXT,
    type TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT,
    capacity INTEGER,
    distance_meters DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.address,
        c.type,
        COALESCE(c.latitude, ST_Y(c.location::geometry)) as latitude,
        COALESCE(c.longitude, ST_X(c.location::geometry)) as longitude,
        c.status,
        c.capacity,
        ST_Distance(c.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography) as distance_meters
    FROM public.cooling_centers c
    WHERE c.status = 'active'
      AND ST_DWithin(
          c.location, 
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography, 
          dist_limit_meters
      )
    ORDER BY ST_Distance(c.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography) ASC;
END;
$$;

-- Ensure public access to the retrieval function
GRANT EXECUTE ON FUNCTION public.get_nearby_cooling_centers(double precision, double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_cooling_centers(double precision, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.clean_route_cache() 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.route_cache WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- 8. RESTORE TEST DATA (Diversified Global Locations)
INSERT INTO public.cooling_centers (name, address, type, location, latitude, longitude, status)
VALUES 
-- New York
('Central Cooling Station', '123 Main St, New York, NY', 'cooling', ST_SetSRID(ST_MakePoint(-74.0060, 40.7128), 4326)::geography, 40.7128, -74.0060, 'active'),
('Riverside Water Fountain', '456 River Rd, New York, NY', 'hydration', ST_SetSRID(ST_MakePoint(-73.9352, 40.7306), 4326)::geography, 40.7306, -73.9352, 'active'),
('Prospect Shade Park', '789 High St, New York, NY', 'park', ST_SetSRID(ST_MakePoint(-73.9500, 40.8000), 4326)::geography, 40.8000, -73.9500, 'active'),
-- San Francisco
('SF Civic Center Cooling', 'Polk St, San Francisco, CA', 'cooling', ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography, 37.7749, -122.4194, 'active'),
('Dolores Park Hydration', 'Dolores St, San Francisco, CA', 'hydration', ST_SetSRID(ST_MakePoint(-122.4276, 37.7596), 4326)::geography, 37.7596, -122.4276, 'active'),
-- London
('Thames Side Hydration', 'Southbank, London, UK', 'hydration', ST_SetSRID(ST_MakePoint(-0.1181, 51.5033), 4326)::geography, 51.5033, -0.1181, 'active'),
('Hyde Park Shade Hub', 'Hyde Park, London, UK', 'park', ST_SetSRID(ST_MakePoint(-0.1657, 51.5073), 4326)::geography, 51.5073, -0.1657, 'active'),
-- Los Angeles
('Santa Monica Cooler', 'Ocean Ave, Santa Monica, CA', 'cooling', ST_SetSRID(ST_MakePoint(-118.4912, 34.0195), 4326)::geography, 34.0195, -118.4912, 'active'),
('Griffith Park Hydration', 'Griffith Obs, Los Angeles, CA', 'hydration', ST_SetSRID(ST_MakePoint(-118.3004, 34.1184), 4326)::geography, 34.1184, -118.3004, 'active'),
-- Tokyo
('Shinjuku Cooling Zone', 'Shinjuku City, Tokyo, JP', 'cooling', ST_SetSRID(ST_MakePoint(139.7032, 35.6938), 4326)::geography, 35.6938, 139.7032, 'active'),
('Ueno Park Water', 'Taito City, Tokyo, JP', 'hydration', ST_SetSRID(ST_MakePoint(139.7741, 35.7141), 4326)::geography, 35.7141, 139.7741, 'active'),
-- Sydney
('Opera House Hydration', 'Bennelong Point, Sydney, AU', 'hydration', ST_SetSRID(ST_MakePoint(151.2153, -33.8568), 4326)::geography, -33.8568, 151.2153, 'active'),
('Botanic Garden Shade', 'Mrs Macquaries Rd, Sydney, AU', 'park', ST_SetSRID(ST_MakePoint(151.2175, -33.8642), 4326)::geography, -33.8642, 151.2175, 'active'),
-- Paris
('Tuileries Water Fountain', 'Pl. de la Concorde, Paris, FR', 'hydration', ST_SetSRID(ST_MakePoint(2.3266, 48.8656), 4326)::geography, 48.8656, 2.3266, 'active'),
('Eiffel Cooling Hub', 'Champ de Mars, Paris, FR', 'cooling', ST_SetSRID(ST_MakePoint(2.2945, 48.8584), 4326)::geography, 48.8584, 2.2945, 'active');


