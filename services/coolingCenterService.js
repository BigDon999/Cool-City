import { supabase } from '../utils/supabase';

/**
 * COOLING CENTER SERVICE
 * 
 * Interacts with the Supabase backend to find active cooling centers
 * and generate "cool routes" via Supabase Edge Functions.
 */
export const CoolingCenterService = {
  /**
   * Fetches the nearest active cooling centers using the RPC function.
   * 
   * @param {number} latitude 
   * @param {number} longitude 
   * @param {number} radiusKm 
   */
  getNearbyCenters: async (latitude, longitude, radiusKm = 20) => {
    try {
      const { data, error } = await supabase.rpc('get_nearby_cooling_centers', {
        user_lat: latitude,
        user_lon: longitude,
        dist_limit_meters: radiusKm * 1000,
      });

      if (error) {
        // If it's a network/timeout error, don't spam a loud error
        if (error.message?.includes('fetch') || error.message?.includes('Network')) {
          if (__DEV__) console.log('[CoolingCenterService] Network unreachable, favoring synthetic fallbacks.');
          return [];
        }
        throw error;
      };
      return data || [];
    } catch (err) {
      if (__DEV__) {
        // Only log serious errors, not common connectivity flutters
        if (!err.message?.includes('Network request failed')) {
           console.error('[CoolingCenterService] Error fetching centers:', err.message);
        }
      }
      return [];
    }
  },

  /**
   * Generates a route to a specific center via the Supabase Edge Function proxy.
   * If the cloud function fails (e.g. no API key or quota exceeded),
   * this will now fallback to a "Direct Line" polyline so the UI never breaks.
   * 
   * @param {object} origin { latitude, longitude }
   * @param {object} destination { latitude, longitude }
   */
  getCoolRoute: async (origin, destination) => {
    try {
      // Primary Attempt: Use the production-grade function
      const { data, error } = await supabase.functions.invoke('get-route', {
        body: {
          startLat: origin.latitude,
          startLng: origin.longitude,
          endLat: destination.latitude,
          endLng: destination.longitude,
        },
      });

      if (!error && data) return data;

      // Secondary Attempt: Try the simplified function name
      const { data: data2, error: error2 } = await supabase.functions.invoke('cool-routes', {
        body: {
          startLat: origin.latitude,
          startLng: origin.longitude,
          endLat: destination.latitude,
          endLng: destination.longitude,
        },
      });

      if (!error2 && data2) return data2;
      
      throw new Error(error?.message || error2?.message || 'Routing Service Unavailable');
    } catch (err) {
      if (__DEV__) {
        console.warn('[CoolingCenterService] Routing failure details:', {
          message: err.message,
          cause: err.cause,
          stack: err.stack
        });
        console.warn('[CoolingCenterService] Using Direct Fallback line for Map.');
      }
      
      // CRITICAL FALLBACK: Generate a simple 2-point polyline (Direct Line)
      // This ensures the Map always shows a connection even without a Maps API key.
      const polyline = require('@mapbox/polyline');
      const directPoly = polyline.encode([
        [origin.latitude, origin.longitude],
        [destination.latitude, destination.longitude]
      ]);

      return {
        polyline: directPoly,
        duration: 'Direct Distance',
        distance: 'Local Fallback',
        steps: [{ instruction: 'Follow direct path to safety.', distance: '', duration: '' }],
        isFallback: true
      };
    }
  },

  /**
   * Registers a new safety center (Crowdsourcing).
   * 
   * @param {object} centerData { name, type, latitude, longitude }
   */
  createCenter: async ({ name, type, latitude, longitude }) => {
    try {
      const { data, error } = await supabase.from('cooling_centers').insert([
        {
          name,
          type,
          latitude, // Also stored in flat cols for easy extraction
          longitude,
          status: 'active',
          location: `POINT(${longitude} ${latitude})` // Standard WKT for PostGIS geography
        }
      ]).select();

      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error('[CoolingCenterService] Error creating center:', err.message);
      return null;
    }
  }
};
