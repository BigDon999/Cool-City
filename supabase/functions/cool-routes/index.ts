// @ts-nocheck
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    // @ts-ignore
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API Key missing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const origin = body.origin || (body.startLat && body.startLng ? `${body.startLat},${body.startLng}` : null);
    const destination = body.destination || (body.endLat && body.endLng ? `${body.endLat},${body.endLng}` : null);

    if (!origin || !destination) {
      throw new Error('Missing coordinates');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=walking&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Maps API returned ${response.status}`);
    }
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Maps Error: ${data.status}`);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    const result = {
      polyline: route.overview_polyline?.points || '',
      duration: leg.duration?.text || '',
      distance: leg.distance?.text || '',
      steps: (leg.steps || []).map((s) => ({
        instruction: (s.html_instructions || '').replace(/<[^>]*>?/gm, ''),
        distance: s.distance?.text || '',
        duration: s.duration?.text || ''
      }))
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
