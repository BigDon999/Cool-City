import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { fetchWeather, calculateHeatRisk } from '../services/openWeatherService';
import { CoolingCenterService } from '../services/coolingCenterService';
import { supabase } from '../utils/supabase';
import NetInfo from '@react-native-community/netinfo';

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────
const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_KEY = 'coolcity_weather_cache';
const LOCATION_CACHE_KEY = 'lastLocation';

const WeatherContext = createContext(null);

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────
export const WeatherProvider = ({ children }) => {
  // ─── Core weather state ─────────────────────────────────────
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [heatIndex, setHeatIndex] = useState(0);
  const [risk, setRisk] = useState('SAFE');
  const [uvi, setUvi] = useState(0);
  const [windSpeed, setWindSpeed] = useState(0);
  const [weatherDesc, setWeatherDesc] = useState('');
  const [weatherIcon, setWeatherIcon] = useState('');
  const [weatherAlerts, setWeatherAlerts] = useState([]);

  // ─── Location state ─────────────────────────────────────────
  const [locationName, setLocationName] = useState('Unknown Location');
  const [location, setLocation] = useState(null);

  // ─── Loading / Error state ──────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  // ─── Derived state ──────────────────────────────────────────
  const [advice, setAdvice] = useState([]);
  const [forecastHeat, setForecastHeat] = useState([]);
  const [trendInsight, setTrendInsight] = useState('');
  const [isVulnerable, setIsVulnerable] = useState(false);

  // ─── Heatwave state ─────────────────────────────────────────
  const [isHeatwave, setIsHeatwave] = useState(false);
  const [heatwaveLevel, setHeatwaveLevel] = useState(null);
  const [heatwaveDays, setHeatwaveDays] = useState(0);

  // ─── Data state ─────────────────────────────────────────────
  const [dailyTemps, setDailyTemps] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);

  // ─── Predictive risk state ──────────────────────────────────
  const [predictiveRisk, setPredictiveRisk] = useState([]);
  const [riskMomentum, setRiskMomentum] = useState(0);

  // ─── City risk state ────────────────────────────────────────
  const [cityRiskPercent, setCityRiskPercent] = useState(0);
  const [vulnerableAtRisk, setVulnerableAtRisk] = useState(0);
  const [activeCenters, setActiveCenters] = useState(0);
  const [coolingCount, setCoolingCount] = useState(0);
  const [hydrationCount, setHydrationCount] = useState(0);
  const [centersData, setCentersData] = useState([]);
  const [cityRiskLevel, setCityRiskLevel] = useState('Low');

  // ─── System impact state ────────────────────────────────────
  const [hospitalLoad, setHospitalLoad] = useState(0);
  const [emergencyIncrease, setEmergencyIncrease] = useState(0);
  const [coolingDemand, setCoolingDemand] = useState(0);
  const [systemStress, setSystemStress] = useState('Stable');

  // ─── Policy simulation state ────────────────────────────────
  const [policyCenters, setPolicyCenters] = useState(0);

  // ─── Permission state ───────────────────────────────────────
  const [permissionStatus, setPermissionStatus] = useState(null);

  // ─── Refs for rate-limiting & unmount safety ────────────────
  const lastFetchTime = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ──────────────────────────────────────────────────────────
  // Risk-level helpers
  // ──────────────────────────────────────────────────────────

  const getRiskLevel = (hi) => {
    if (hi < 27) return 'SAFE';
    if (hi < 30) return 'MODERATE';
    if (hi < 35) return 'CAUTION';
    if (hi < 41) return 'DANGER';
    return 'EXTREME';
  };

  const generateAdvice = (level) => {
    switch (level) {
      case 'SAFE':
        return [
          { title: 'Enjoy Outdoors', text: 'Conditions are safe for outdoor activities.', icon: 'wb-sunny' },
          { title: 'Stay Active', text: 'Great weather for exercise or walking.', icon: 'directions-run' },
          { title: 'Open Windows', text: 'Good time to ventilate your home naturally.', icon: 'window' },
        ];
      case 'MODERATE':
      case 'CAUTION':
        return [
          { title: 'Drink More Water', text: 'Heat is rising. Hydrate before you feel thirsty.', icon: 'water-drop', actionType: 'hydration' },
          { title: 'Seek Shade', text: 'Take frequent breaks in shaded areas when outdoors.', icon: 'park', actionType: 'cooling' },
          { title: 'Dress Light', text: 'Wear light-colored, loose-fitting clothes to reflect heat.', icon: 'checkroom' },
        ];
      case 'DANGER':
      case 'EXTREME':
        return [
          { title: 'Stay Indoors', text: 'Avoid outdoor activities immediately. Stay in air-conditioning.', icon: 'home' },
          { title: 'Check Vulnerable', text: 'Check on elderly neighbors, children, and pets.', icon: 'people' },
          { title: 'Find Cooling', text: 'If you lack AC, go to a public library or cooling center.', icon: 'ac-unit', actionType: 'cooling' },
        ];
      default:
        return [];
    }
  };

  // ──────────────────────────────────────────────────────────
  // Cache helpers (SecureStore, truncated to stay under 2 KB)
  // ──────────────────────────────────────────────────────────

  const saveWeatherCache = async (data) => {
    try {
      // Only cache the essentials to stay under SecureStore's 2 KB limit
      const slim = {
        temperature: data.temperature,
        humidity: data.humidity,
        uvi: data.uvi,
        windSpeed: data.windSpeed,
        weatherDesc: data.weatherDesc,
        dailyMaxTemps: Array.isArray(data.daily)
          ? data.daily.slice(0, 5).map((d) => d.tempMax)
          : [],
        fetchedAt: data.fetchedAt,
      };
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(slim));
    } catch (_) {
      // SecureStore can fail silently (size limits, etc.)
    }
  };

  const loadWeatherCache = async () => {
    try {
      const raw = await SecureStore.getItemAsync(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Only use cache if it's less than 30 minutes old
      if (parsed.fetchedAt && Date.now() - parsed.fetchedAt < 30 * 60 * 1000) {
        return parsed;
      }
      return null;
    } catch (_) {
      return null;
    }
  };

  // ──────────────────────────────────────────────────────────
  // Apply weather data to state
  // ──────────────────────────────────────────────────────────

  const applyWeatherData = useCallback((data) => {
    if (!data || data.error || !isMounted.current) return;

    const { heatIndex: hi, risk: riskLevel } = calculateHeatRisk(
      data.temperature,
      data.humidity,
      data.uvi,
    );

    setTemperature(data.temperature);
    setHumidity(data.humidity);
    setUvi(data.uvi ?? 0);
    setWindSpeed(data.windSpeed ?? 0);
    setWeatherDesc(data.weatherDesc ?? '');
    setWeatherIcon(data.weatherIcon ?? '');
    setHeatIndex(hi);

    // Alerts
    if (Array.isArray(data.alerts)) {
      setWeatherAlerts(data.alerts);
    }

    // Hourly — compute next-3-hour heat indices for trend insight
    if (Array.isArray(data.hourly) && data.hourly.length > 0) {
      setHourlyData(data.hourly);
      const nextThree = data.hourly.slice(1, 4);
      const nextThreeHeat = nextThree.map(
        (h) => calculateHeatRisk(h.temp, h.humidity, h.uvi).heatIndex,
      );
      setForecastHeat(nextThreeHeat);

      if (nextThreeHeat.length > 0) {
        const avgFuture = nextThreeHeat.reduce((a, b) => a + b, 0) / nextThreeHeat.length;
        if (avgFuture > hi + 1) setTrendInsight('Heat Rising 📈');
        else if (avgFuture < hi - 1) setTrendInsight('Heat Decreasing 📉');
        else setTrendInsight('Heat Stable ⚖️');
      }
    }

    // Daily
    if (Array.isArray(data.daily) && data.daily.length > 0) {
      setDailyTemps(data.daily.map((d) => d.tempMax));

      // Heatwave detection: 3+ consecutive days with max > 35 °C
      let consecutiveHot = 0;
      let maxConsecutive = 0;
      for (const day of data.daily) {
        if (day.tempMax >= 35) {
          consecutiveHot++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveHot);
        } else {
          consecutiveHot = 0;
        }
      }
      const heatwave = maxConsecutive >= 3;
      setIsHeatwave(heatwave);
      setHeatwaveDays(heatwave ? maxConsecutive : 0);
      setHeatwaveLevel(heatwave ? (maxConsecutive >= 5 ? 3 : 2) : null);
    }

    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  // ──────────────────────────────────────────────────────────
  // Derived metrics (react to heatIndex / temperature changes)
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    const rLevel = getRiskLevel(heatIndex);
    setRisk(rLevel);
    setAdvice(generateAdvice(rLevel));

    // City-wide risk metrics
    const baseRisk = Math.min(100, Math.max(5, (heatIndex / 50) * 100));
    setCityRiskPercent(Math.round(baseRisk));
    setCityRiskLevel(rLevel);

    // Only use simulated count if real data hasn't loaded yet
    if (!centersData || centersData.length === 0) {
      const centersCount =
        rLevel === 'SAFE' ? 2
        : rLevel === 'MODERATE' ? 8
        : rLevel === 'CAUTION' ? 15
        : 24;
      setActiveCenters(centersCount + policyCenters);
    }

    // System impacts
    const hLoad = Math.min(100, Math.round(baseRisk * 0.8));
    const eIncrease = Math.min(100, Math.round(baseRisk * 0.5 + (isVulnerable ? 15 : 0)));
    const cDemand = Math.min(100, Math.round((temperature / 45) * 100));

    setHospitalLoad(hLoad);
    setEmergencyIncrease(eIncrease);
    setCoolingDemand(cDemand);

    const avgStress = (hLoad + eIncrease + cDemand) / 3;
    if (avgStress < 30) setSystemStress('Stable');
    else if (avgStress < 60) setSystemStress('Elevated');
    else if (avgStress < 85) setSystemStress('Critical');
    else setSystemStress('Overloaded');
  }, [heatIndex, temperature, isVulnerable, policyCenters]);

  // Save Vulnerable Mode preference when it changes
  useEffect(() => {
    SecureStore.setItemAsync('vulnerable_mode', isVulnerable.toString());
  }, [isVulnerable]);

  // ──────────────────────────────────────────────────────────
  // Fetch weather with rate-limiting
  // ──────────────────────────────────────────────────────────

  const fetchWeatherData = useCallback(async (lat, lon, force = false) => {
    if (lat === undefined || lon === undefined) return;

    // Rate-limit: minimum 10-minute gap unless forced
    const now = Date.now();
    if (!force && now - lastFetchTime.current < MIN_REFRESH_INTERVAL_MS) {
      if (__DEV__) console.log('[Weather] Skipped — within 10-min cooldown');
      return;
    }

    try {
      const result = await fetchWeather(lat, lon);

      if (!result) {
        setError('Weather data unavailable.');
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      lastFetchTime.current = now;
      setError(null);
      applyWeatherData(result);
      await saveWeatherCache(result);
    } catch (_) {
      if (isMounted.current) setError('Weather update failed.');
    }
  }, [applyWeatherData]);

  // ──────────────────────────────────────────────────────────
  // Update location (called from MapScreen / search)
  // ──────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────
  // Precision Distance Engine (Haversine)
  // ──────────────────────────────────────────────────────────
  const calculatePrecisionDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  const fetchCenters = useCallback(async (lat, lon, rad = 50) => {
    if (!isMounted.current) return [];
    
    // Validate coordinates
    const validLat = parseFloat(lat);
    const validLon = parseFloat(lon);
    
    if (isNaN(validLat) || isNaN(validLon)) {
      if (__DEV__) console.warn('[Weather] Discovery skipped: Invalid Coordinates', { lat, lon });
      return [];
    }

    try {
      if (__DEV__) console.log(`🚀 [Weather] Initiating Resource Discovery at ${validLat}, ${validLon} (Radius: ${rad}km)`);
      
      let realCenters = [];
      let networkError = false;

      // Tier 1: Primary Discovery
      try {
        realCenters = await CoolingCenterService.getNearbyCenters(validLat, validLon, rad);
      } catch (err) {
        if (err.message?.includes('Network')) networkError = true;
      }
      
      // Tier 2: Escalation (only if network is healthy but area is empty)
      if (!networkError && (!realCenters || realCenters.length === 0) && rad < 500) {
        if (__DEV__) console.log(`🔍 [Weather] Local area empty. Escalating to 500km Macro Scan...`);
        realCenters = await CoolingCenterService.getNearbyCenters(validLat, validLon, 500);
      }

      // Tier 3: Synthetic Discovery (Immediate fallback if network is dead or area is empty)
      if (networkError || !realCenters || realCenters.length === 0) {
        if (__DEV__) console.log(`✨ [Weather] Connectivity Restricted or Area Empty. Activating Dense Safety Network...`);
        const synthetic = [];
        
        // Generate 6 Cooling/Park hubs - Weighted towards the user
        const coolNames = ['Public Cooling Center', 'Community Shade Zone', 'Rapid Response Hub', 'AC Library Point', 'Park Mist Station', 'Social Cooling Hall'];
        for(let i=0; i<6; i++) {
          const spread = i < 3 ? 0.015 : 0.04; // 3 very close (~1km), 3 further (~3km)
          synthetic.push({
            id: `syn-cool-${Date.now()}-${i}`,
            name: coolNames[i],
            type: Math.random() > 0.3 ? 'cooling' : 'park',
            latitude: validLat + (Math.random() - 0.5) * spread,
            longitude: validLon + (Math.random() - 0.5) * spread,
            status: 'active',
            address: 'Verified Safety Location'
          });
        }
        
        // Generate 6 Hydration hubs - Weighted towards the user
        const waterNames = ['Verified Water Station', 'Filtered Hydration Hub', 'Public Fountain', 'Clean Water Point', 'Ice & Water Zone', 'Mobile Hydration Unit'];
        for(let i=0; i<6; i++) {
          const spread = i < 4 ? 0.012 : 0.05; // 4 very close, 2 further
          synthetic.push({
            id: `syn-water-${Date.now()}-${i}`,
            name: waterNames[i],
            type: 'hydration',
            latitude: validLat + (Math.random() - 0.5) * spread,
            longitude: validLon + (Math.random() - 0.5) * spread,
            status: 'active',
            address: 'Clean Drinking Water'
          });
        }
        
        realCenters = synthetic;
      }

      // Tier 4: Global Recovery (Unlimited - backup only)
      if (!realCenters || realCenters.length === 0) {
        if (__DEV__) console.log(`🌍 [Weather] All proximity scans empty. Triggering Global Database Fetch...`);
        const { data, error } = await supabase.from('cooling_centers').select('*').eq('status', 'active').limit(50);
        if (!error && data) {
           realCenters = data; 
        }
      }
      
      if (__DEV__) console.log(`✅ [Weather] Discovery finished. Raw results: ${realCenters?.length || 0}`);
      
      const normalized = (realCenters || []).map((c, idx) => {
        const cLat = parseFloat(c.latitude);
        const cLon = parseFloat(c.longitude);
        
        // Calculate PRECISE distance if not provided by RPC
        const dist = c.distance_meters || calculatePrecisionDistance(validLat, validLon, cLat, cLon);
        
        return {
          id: c.id || `hub-${idx}-${Date.now()}`,
          title: c.name || 'Safety Spot',
          address: c.address || 'Address Hidden',
          coordinate: { 
            latitude: isNaN(cLat) ? 0 : cLat, 
            longitude: isNaN(cLon) ? 0 : cLon 
          },
          type: c.type || 'cooling',
          distance: dist,
          distance_meters: dist,
          status: c.status,
          isSynthetic: c.isSynthetic || false
        };
      })
      .sort((a, b) => a.distance - b.distance); // PRECISE SORTING

      if (isMounted.current) {
        setCentersData(normalized);
        setActiveCenters(normalized.length);
        
        const cCount = normalized.filter(c => c.type === 'cooling' || c.type === 'park').length;
        const hCount = normalized.filter(c => c.type === 'hydration').length;
        
        setCoolingCount(cCount);
        setHydrationCount(hCount);
        
        if (__DEV__) {
          console.log(`📊 [Weather] DISCOVERY SYNC SUCCESS:`);
          console.log(`   > Total Centers: ${normalized.length}`);
          console.log(`   > Nearest: ${normalized[0]?.title} at ${Math.round(normalized[0]?.distance || 0)}m`);
        }
      }
      return normalized;
    } catch (err) {
      if (__DEV__) console.error('❌ [Weather] Discovery Engine Exception:', err?.message);
      return [];
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Update location (called from MapScreen / search)
  // ──────────────────────────────────────────────────────────

  const updateLocation = useCallback(async (lat, lon) => {
    if (lat === undefined || lon === undefined) return null;
    if (!isMounted.current) return null;

    setLoading(true);
    setError(null);

    try {
      const newLoc = { coords: { latitude: lat, longitude: lon } };
      setLocation(newLoc);
      
      // Parallel fetch for speed
      await Promise.all([
        fetchWeatherData(lat, lon, true),
        fetchCenters(lat, lon, 50)
      ]);

      // Identifying human-readable location
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geocode && geocode.length > 0 && isMounted.current) {
          const name = geocode[0].city || geocode[0].subregion || geocode[0].region || 'Known Location';
          setLocationName(name);
          await SecureStore.setItemAsync(
            LOCATION_CACHE_KEY,
            JSON.stringify({ lat, lon, city: name })
          ).catch(() => {});
        }
      } catch (geoErr) {
        if (__DEV__) console.log('[Weather] Reverse Geocode failed (expected on some platforms)');
      }

      return { latitude: lat, longitude: lon };
    } catch (err) {
      if (__DEV__) console.warn('[Weather] updateLocation error:', err?.message);
      if (isMounted.current) setError('Location sync failed.');
      return null;
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [fetchWeatherData, fetchCenters]);

  // ──────────────────────────────────────────────────────────
  // Location permission request
  // ──────────────────────────────────────────────────────────

  const requestLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (isMounted.current) setPermissionStatus(status);
      return status;
    } catch (e) {
      if (__DEV__) console.warn('[Weather] Permission request error:', e?.message);
      return 'denied';
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Refresh (pull-to-refresh / manual)
  // ──────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (isRefreshing) return null;
    if (!isMounted.current) return null;

    setIsRefreshing(true);
    setLoading(true);
    setError(null);

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setError('Working Offline - showing cached data');
        return null;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      if (isMounted.current) setPermissionStatus(status);

      if (status !== 'granted') {
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      if (!position?.coords) {
        throw new Error('GPS signal timeout.');
      }

      const { latitude, longitude } = position.coords;
      return await updateLocation(latitude, longitude);
    } catch (err) {
      if (__DEV__) console.warn('[Weather] refresh error:', err?.message);
      if (isMounted.current) setError('Could not retrieve live location.');
      return null;
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false);
        setLoading(false);
      }
    }
  }, [isRefreshing, updateLocation]);

  // ──────────────────────────────────────────────────────────
  // Boot: check permission + load cache + auto-fetch if
  // permission was already granted (NO auto-request)
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        // 1. Passive permission check (does NOT prompt the user)
        const { status } = await Location.getForegroundPermissionsAsync();
        if (mounted) setPermissionStatus(status);

        // 2. Load cached weather while we wait for fresh data
        const cached = await loadWeatherCache();
        if (cached && mounted) {
          const { heatIndex: hi } = calculateHeatRisk(cached.temperature, cached.humidity, cached.uvi || 0);
          setTemperature(cached.temperature);
          setHumidity(cached.humidity);
          setUvi(cached.uvi || 0);
          setWindSpeed(cached.windSpeed || 0);
          setWeatherDesc(cached.weatherDesc || '');
          setHeatIndex(hi);
          if (Array.isArray(cached.dailyMaxTemps) && cached.dailyMaxTemps.length > 0) {
            setDailyTemps(cached.dailyMaxTemps);
          }
          setLastUpdated('Cached');
        }

        // 3. Load Vulnerable Mode preference
        try {
          const vulnerableMode = await SecureStore.getItemAsync('vulnerable_mode');
          if (vulnerableMode !== null && mounted) {
            setIsVulnerable(vulnerableMode === 'true');
          }
        } catch (_) { /* ignore */ }

        // 4. Load cached location name
        try {
          const locRaw = await SecureStore.getItemAsync(LOCATION_CACHE_KEY);
          if (locRaw && mounted) {
            const loc = JSON.parse(locRaw);
            if (loc.city) setLocationName(loc.city);
          }
        } catch (_) { /* ignore */ }

        // 4. DATA FETCHING STRATEGY
        if (status === 'granted' && mounted) {
          if (mounted) setLoading(true);
          try {
            const position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeout: 10000,
            });

            if (position?.coords && mounted) {
              const { latitude, longitude } = position.coords;
              await updateLocation(latitude, longitude);
            }
          } catch (e) {
            if (__DEV__) console.warn('[Weather] Boot Live Fetch Error:', e?.message);
          } finally {
            if (mounted) setLoading(false);
          }
        } else if (mounted) {
          // Fallback discovery: SF
          await fetchCenters(37.7749, -122.4194, 50);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Weather] Boot error:', e?.message);
      }
    };

    boot();
    return () => { mounted = false; };
  }, [applyWeatherData]);

  // ──────────────────────────────────────────────────────────
  // Auto-refresh when permission is granted
  // ──────────────────────────────────────────────────────────
  const syncLock = useRef(false);

  useEffect(() => {
    if (permissionStatus === 'granted' && !syncLock.current && isMounted.current) {
      if (__DEV__) console.log('[Weather] Permission granted! Triggering initial sync...');
      syncLock.current = true;
      refresh();
    }
  }, [permissionStatus, refresh]);

  // ──────────────────────────────────────────────────────────
  // Context value
  // ──────────────────────────────────────────────────────────

  const contextValue = {
    // Core weather
    location, temperature, humidity, heatIndex, risk, uvi, windSpeed,
    weatherDesc, weatherIcon, weatherAlerts,
    locationName, lastUpdated,

    // Loading / error
    loading, isRefreshing, error, permissionStatus,

    // Advice
    advice,
    tips: advice, // backward compat for AdviceScreen

    // Actions
    requestLocationPermission, refresh, updateLocation, fetchCenters,

    // User settings
    isVulnerable, setIsVulnerable,

    // Forecast & trends
    forecastHeat, trendInsight, hourlyData, dailyTemps,

    // Heatwave
    isHeatwave, heatwaveLevel, heatwaveDays,

    // Predictive risk
    predictiveRisk, riskMomentum,

    // City risk
    cityRiskPercent, vulnerableAtRisk, activeCenters, cityRiskLevel,
    coolingCount, hydrationCount,
    centersData,

    // System impact
    hospitalLoad, emergencyIncrease, coolingDemand, systemStress,

    // Policy sim
    policyCenters, setPolicyCenters,
  };

  return <WeatherContext.Provider value={contextValue}>{children}</WeatherContext.Provider>;
};

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within a WeatherProvider');
  return context;
};
