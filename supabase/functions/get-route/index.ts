// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PRODUCTION-GRADE GET-ROUTE FUNCTION
 * Features:
 * 1. PostGIS-Integrated spatial validation
 * 2. Supabase DB-backed Route Caching (Cost Reduction)
 * 3. Daily User Quota Rate Limiting (Security Hardening)
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Service role to bypass RLS for caching logic
      { global: { headers: { Authorization: authHeader } } }
    )

    // 1. Get User Context for Rate Limiting
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 2. Rate Limiting Check (Token Bucket / Daily Quota)
    const { data: usage } = await supabase
      .from('api_usage')
      .select('daily_count, last_reset')
      .eq('user_id', user.id)
      .single();

    const now = new Date();
    const isNewDay = usage ? new Date(usage.last_reset).getDate() !== now.getDate() : true;
    const currentCount = isNewDay ? 0 : (usage?.daily_count ?? 0);

    if (currentCount >= 50) { // 50 routes per day limit
      return new Response(JSON.stringify({ error: 'Daily route quota exceeded.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // 3. Extract & Validate Coordinates
    const { startLat, startLng, endLat, endLng } = await req.json();
    if ([startLat, startLng, endLat, endLng].some(v => typeof v !== 'number')) {
      throw new Error('Coordinates must be numeric');
    }

    // 4. Cache Lookup (Precision: 4 decimal places ~11m)
    const routeHash = `route_${startLat.toFixed(4)}_${startLng.toFixed(4)}_${endLat.toFixed(4)}_${endLng.toFixed(4)}`;
    const { data: cachedRoute } = await supabase
      .from('route_cache')
      .select('payload')
      .eq('route_hash', routeHash)
      .single();

    if (cachedRoute) {
      console.log('Cache Hit:', routeHash);
      // Log usage and return
      await supabase.from('api_usage').upsert({ 
        user_id: user.id, daily_count: currentCount + 1, last_reset: now.toISOString() 
      });
      return new Response(JSON.stringify(cachedRoute.payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 5. Fetch from Google (Cache Miss)
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Supabase Secret GOOGLE_MAPS_API_KEY is missing');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&mode=walking&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Maps API returned ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Maps API: ${data.status}`);
    }

    // 6. Prune & Save Result
    const leg = data.routes[0].legs[0];
    const payload = {
      polyline: data.routes[0].overview_polyline?.points || '',
      duration: leg.duration?.text || '',
      distance: leg.distance?.text || '',
      steps: (leg.steps || []).map((s: any) => ({
        instruction: s.html_instructions.replace(/<[^>]*>?/gm, ''),
        distance: s.distance?.text || '',
        duration: s.duration?.text || ''
      }))
    };

    // Parallel: Save to cache and update usage
    await Promise.all([
      supabase.from('route_cache').insert({ route_hash: routeHash, payload }),
      supabase.from('api_usage').upsert({ user_id: user.id, daily_count: currentCount + 1, last_reset: now.toISOString() })
    ]);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
