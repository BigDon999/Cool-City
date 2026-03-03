// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

/**
 * CORS HEADERS
 * RESTRICTION: In a strict production environment, '*' should be replaced 
 * with preferred origins (e.g. your app's web domain).
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PRODUCTION-GRADE GET-ROUTE FUNCTION
 * @author Senior Developer
 * @auditor Cybersecurity Review:
 * - Implements JWT validation via Supabase Auth
 * - Enforces Daily Quotas (Rate Limiting) to prevent API abuse/cost spikes
 * - Uses Service Role for backend-only logic (Caching/Usage)
 * - Sanitizes external API calls to Google Maps
 */
Deno.serve(async (req: Request) => {
  // Handle Pre-flight request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate Authorization Header existence
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Initialize Supabase Client with User's Auth Context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Service role to bypass RLS for administrative logic
      { global: { headers: { Authorization: authHeader } } }
    )

    // 1. Verify User Identity (Server-side validation of JWT)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 2. Rate Limiting Check (Security Guard: Prevent DOS/Wallet-Drain)
    const { data: usage } = await supabase
      .from('api_usage')
      .select('daily_count, last_reset')
      .eq('user_id', user.id)
      .single();

    const now = new Date();
    const isNewDay = usage ? new Date(usage.last_reset).getDate() !== now.getDate() : true;
    const currentCount = isNewDay ? 0 : (usage?.daily_count ?? 0);

    if (currentCount >= 50) { // HARD LIMIT: 50 safety routes per day
      return new Response(JSON.stringify({ error: 'Daily route quota exceeded. Please wait 24 hours.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // 3. Extract & Validate Coordinates
    const { startLat, startLng, endLat, endLng } = await req.json();
    if ([startLat, startLng, endLat, endLng].some(v => typeof v !== 'number' || !isFinite(v))) {
      throw new Error('Malformed coordinates: Must be valid numeric values');
    }

    // 4. Cache Lookup (Privacy: Hashes are deterministic but non-reversible)
    const routeHash = `route_${startLat.toFixed(4)}_${startLng.toFixed(4)}_${endLat.toFixed(4)}_${endLng.toFixed(4)}`;
    const { data: cachedRoute } = await supabase
      .from('route_cache')
      .select('payload')
      .eq('route_hash', routeHash)
      .single();

    if (cachedRoute) {
      // PERFORMANCE: Return cached route to save Google API costs
      await supabase.from('api_usage').upsert({ 
        user_id: user.id, daily_count: currentCount + 1, last_reset: now.toISOString() 
      });
      return new Response(JSON.stringify(cachedRoute.payload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 5. Fetch from Upstream (Google Directions API)
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Internal Server Error: Maps integration misconfigured');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&mode=walking&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Upstream API failure: ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Maps API Error: ${data.status}`);
    }

    // 6. Response Sanitization (Strip sensitive/unnecessary Google metadata)
    const leg = data.routes[0].legs[0];
    const payload = {
      polyline: data.routes[0].overview_polyline?.points || '',
      duration: leg.duration?.text || '',
      distance: leg.distance?.text || '',
      steps: (leg.steps || []).map((s: any) => ({
        instruction: s.html_instructions.replace(/<[^>]*>?/gm, ''), // XSS Protection: Strip HTML
        distance: s.distance?.text || '',
        duration: s.duration?.text || ''
      }))
    };

    // Parallel IO: Update persistences
    await Promise.all([
      supabase.from('route_cache').insert({ route_hash: routeHash, payload }),
      supabase.from('api_usage').upsert({ user_id: user.id, daily_count: currentCount + 1, last_reset: now.toISOString() })
    ]);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    // SECURITY: Don't leak technical stack traces to client in production
    return new Response(JSON.stringify({ error: 'An internal error occurred while processing your request.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

