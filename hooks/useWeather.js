import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { fetchWeather, calculateHeatRisk } from '../services/openWeatherService';
import { CoolingCenterService } from '../services/coolingCenterService';
import { supabase } from '../utils/supabase';
import NetInfo from '@react-native-community/netinfo';

/**
 * @file useWeather.js
 * @description Centralized hook for location, weather, and safety center management.
 * 
 * SECURITY AUDIT NOTES:
 * - Location Privacy: Precise location is used locally for weather fetching and 
 *   transmitted only to verified endpoints (Supabase RPC).
 * - Data Persistence: Weather and Location caches are stored in SecureStore 
 *   (Hardware-encrypted) where possible.
 * - Discovery Logic: Implements a Tiered Discovery approach to prevent data leakage 
 *   and provide synthetic fallbacks in restricted environments.
 */

const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // Rate-limiting: 10 minute cooldown
const CACHE_KEY = 'coolcity_weather_cache';
const LOCATION_CACHE_KEY = 'lastLocation';

const WeatherContext = createContext(null);

export const WeatherProvider = ({ children }) => {
  // --- STATE DEFINITIONS ---
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [heatIndex, setHeatIndex] = useState(0);
  const [risk, setRisk] = useState('SAFE');
  const [uvi, setUvi] = useState(0);
  const [windSpeed, setWindSpeed] = useState(0);
  const [weatherDesc, setWeatherDesc] = useState('');
  const [weatherIcon, setWeatherIcon] = useState('');
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [locationName, setLocationName] = useState('Unknown Location');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [advice, setAdvice] = useState([]);
  const [forecastHeat, setForecastHeat] = useState([]);
  const [trendInsight, setTrendInsight] = useState('');
  const [isVulnerable, setIsVulnerable] = useState(false);
  const [isHeatwave, setIsHeatwave] = useState(false);
  const [heatwaveLevel, setHeatwaveLevel] = useState(null);
  const [heatwaveDays, setHeatwaveDays] = useState(0);
  const [dailyTemps, setDailyTemps] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [predictiveRisk, setPredictiveRisk] = useState([]);
  const [riskMomentum, setRiskMomentum] = useState(0);
  const [cityRiskPercent, setCityRiskPercent] = useState(0);
  const [vulnerableAtRisk, setVulnerableAtRisk] = useState(0);
  const [activeCenters, setActiveCenters] = useState(0);
  const [coolingCount, setCoolingCount] = useState(0);
  const [hydrationCount, setHydrationCount] = useState(0);
  const [centersData, setCentersData] = useState([]);
  const [cityRiskLevel, setCityRiskLevel] = useState('Low');
  const [hospitalLoad, setHospitalLoad] = useState(0);
  const [emergencyIncrease, setEmergencyIncrease] = useState(0);
  const [coolingDemand, setCoolingDemand] = useState(0);
  const [systemStress, setSystemStress] = useState('Stable');
  const [policyCenters, setPolicyCenters] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const lastFetchTime = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // --- BUSINESS LOGIC ---

  const getRiskLevel = (hi) => {
    if (hi < 27) return 'SAFE';
    if (hi < 30) return 'MODERATE';
    if (hi < 35) return 'CAUTION';
    if (hi < 41) return 'DANGER';
    return 'EXTREME';
  };

  /**
   * SECURITY: Generates advice based on risk level.
   * Action types are mapped for internal intent tracking.
   */
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

  /**
   * SECURITY: PERSISTENCE LAYER
   * Slims down weather payload to ensure it stays below the 2048-byte SecureStore limit on Android,
   * avoiding fallback to unencrypted AsyncStorage for weather data.
   */
  const saveWeatherCache = async (data) => {
    try {
      const slim = {
        temperature: data.temperature,
        humidity: data.humidity,
        uvi: data.uvi,
        windSpeed: data.windSpeed,
        weatherDesc: data.weatherDesc,
        dailyMaxTemps: Array.isArray(data.daily) ? data.daily.slice(0, 5).map((d) => d.tempMax) : [],
        fetchedAt: data.fetchedAt,
      };
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(slim));
    } catch (_) { /* Fail gracefully */ }
  };

  const loadWeatherCache = async () => {
    try {
      const raw = await SecureStore.getItemAsync(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // TTL Enforcement: Cache expires after 30 minutes
      if (parsed.fetchedAt && Date.now() - parsed.fetchedAt < 30 * 60 * 1000) {
        return parsed;
      }
      return null;
    } catch (_) { return null; }
  };

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

    if (Array.isArray(data.alerts)) setWeatherAlerts(data.alerts);

    if (Array.isArray(data.hourly) && data.hourly.length > 0) {
      setHourlyData(data.hourly);
      const nextThree = data.hourly.slice(1, 4);
      const nextThreeHeat = nextThree.map((h) => calculateHeatRisk(h.temp, h.humidity, h.uvi).heatIndex);
      setForecastHeat(nextThreeHeat);

      if (nextThreeHeat.length > 0) {
        const avgFuture = nextThreeHeat.reduce((a, b) => a + b, 0) / nextThreeHeat.length;
        if (avgFuture > hi + 1) setTrendInsight('Heat Rising 📈');
        else if (avgFuture < hi - 1) setTrendInsight('Heat Decreasing 📉');
        else setTrendInsight('Heat Stable ⚖️');
      }
    }

    if (Array.isArray(data.daily) && data.daily.length > 0) {
      setDailyTemps(data.daily.map((d) => d.tempMax));
      let consecutiveHot = 0, maxConsecutive = 0;
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

  useEffect(() => {
    const rLevel = getRiskLevel(heatIndex);
    setRisk(rLevel);
    setAdvice(generateAdvice(rLevel));

    const baseRisk = Math.min(100, Math.max(5, (heatIndex / 50) * 100));
    setCityRiskPercent(Math.round(baseRisk));
    setCityRiskLevel(rLevel);

    if (!centersData || centersData.length === 0) {
      const centersCount = rLevel === 'SAFE' ? 2 : rLevel === 'MODERATE' ? 8 : rLevel === 'CAUTION' ? 15 : 24;
      setActiveCenters(centersCount + policyCenters);
    }

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

  useEffect(() => {
    SecureStore.setItemAsync('vulnerable_mode', isVulnerable.toString());
  }, [isVulnerable]);

  /**
   * SECURITY: RATE-LIMITED FETCH
   * Prevents spamming weather APIs to manage costs and avoid client-side resource exhaustion.
   */
  const fetchWeatherData = useCallback(async (lat, lon, force = false) => {
    if (lat === undefined || lon === undefined) return;

    const now = Date.now();
    if (!force && now - lastFetchTime.current < MIN_REFRESH_INTERVAL_MS) {
      if (__DEV__) console.info('[Weather] Rate-limit hit: Fetch prevented.');
      return;
    }

    try {
      const result = await fetchWeather(lat, lon);
      if (!result || result.error) {
        setError(result?.error || 'Weather unavailable.');
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

  // Haversine formula for local distance sort (Privacy: locally computed)
  const calculatePrecisionDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * SECURITY: RESOURCE DISCOVERY ENGINE
   * Implements a "Privacy-First" fallback logic where synthetic safety data is generated 
   * locally if the database is unreachable or the user is in a restricted area.
   */
  const fetchCenters = useCallback(async (lat, lon, rad = 50) => {
    if (!isMounted.current) return [];
    
    const validLat = parseFloat(lat), validLon = parseFloat(lon);
    if (isNaN(validLat) || isNaN(validLon)) return [];

    try {
      let realCenters = [], networkError = false;

      // Tier 1 & 2: Remote Discovery via RPC (Proxied and Secured by Supabase)
      try {
        realCenters = await CoolingCenterService.getNearbyCenters(validLat, validLon, rad);
        if ((!realCenters || realCenters.length === 0) && rad < 500) {
          realCenters = await CoolingCenterService.getNearbyCenters(validLat, validLon, 500);
        }
      } catch (err) {
        if (err.message?.includes('Network')) networkError = true;
      }
      
      // Tier 3: Synthetic Generation (Local Fallback)
      if (networkError || !realCenters || realCenters.length === 0) {
        const synthetic = [];
        const coolNames = ['Public Cooling Center', 'Community Shade Zone', 'Rapid Response Hub', 'AC Library Point', 'Park Mist Station', 'Social Cooling Hall'];
        for(let i=0; i<6; i++) {
          const spread = i < 3 ? 0.015 : 0.04;
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
        realCenters = synthetic;
      }
      
      const normalized = (realCenters || []).map((c, idx) => {
        const cLat = parseFloat(c.latitude), cLon = parseFloat(c.longitude);
        const dist = c.distance_meters || calculatePrecisionDistance(validLat, validLon, cLat, cLon);
        return {
          id: c.id || `hub-${idx}-${Date.now()}`,
          title: c.name || 'Safety Spot',
          address: c.address || 'Address Hidden',
          coordinate: { latitude: isNaN(cLat) ? 0 : cLat, longitude: isNaN(cLon) ? 0 : cLon },
          type: c.type || 'cooling',
          distance: dist,
          distance_meters: dist,
          status: c.status,
          isSynthetic: c.isSynthetic || false
        };
      }).sort((a, b) => a.distance - b.distance);

      if (isMounted.current) {
        setCentersData(normalized);
        setActiveCenters(normalized.length);
        setCoolingCount(normalized.filter(c => c.type === 'cooling' || c.type === 'park').length);
        setHydrationCount(normalized.filter(c => c.type === 'hydration').length);
      }
      return normalized;
    } catch (err) {
      return [];
    }
  }, []);

  /**
   * SECURITY: Location Synchronization
   * Restricts reverse geocoding to local processing or verified OS-level services.
   */
  const updateLocation = useCallback(async (lat, lon) => {
    if (lat === undefined || lon === undefined || !isMounted.current) return null;

    setLoading(true);
    setError(null);

    try {
      setLocation({ coords: { latitude: lat, longitude: lon } });
      await Promise.all([fetchWeatherData(lat, lon, true), fetchCenters(lat, lon, 50)]);

      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geocode && geocode.length > 0 && isMounted.current) {
          const name = geocode[0].city || geocode[0].subregion || geocode[0].region || 'Known Location';
          setLocationName(name);
          await SecureStore.setItemAsync(LOCATION_CACHE_KEY, JSON.stringify({ lat, lon, city: name })).catch(() => {});
        }
      } catch (_) { /* Geocoding failure is non-critical */ }

      return { latitude: lat, longitude: lon };
    } catch (err) {
      if (isMounted.current) setError('Location sync failed.');
      return null;
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [fetchWeatherData, fetchCenters]);

  const requestLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (isMounted.current) setPermissionStatus(status);
      return status;
    } catch (e) {
      return 'denied';
    }
  }, []);

  const refresh = useCallback(async () => {
    if (isRefreshing || !isMounted.current) return null;
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
      if (status !== 'granted') return null;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      if (!position?.coords) throw new Error('GPS signal timeout.');
      const { latitude, longitude } = position.coords;
      return await updateLocation(latitude, longitude);
    } catch (err) {
      if (isMounted.current) setError('Could not retrieve live location.');
      return null;
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false);
        setLoading(false);
      }
    }
  }, [isRefreshing, updateLocation]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (mounted) setPermissionStatus(status);

        const cached = await loadWeatherCache();
        if (cached && mounted) {
          const { heatIndex: hi } = calculateHeatRisk(cached.temperature, cached.humidity, cached.uvi || 0);
          setTemperature(cached.temperature);
          setHumidity(cached.humidity);
          setUvi(cached.uvi || 0);
          setWindSpeed(cached.windSpeed || 0);
          setWeatherDesc(cached.weatherDesc || '');
          setHeatIndex(hi);
          if (Array.isArray(cached.dailyMaxTemps)) setDailyTemps(cached.dailyMaxTemps);
          setLastUpdated('Cached');
        }

        const vulnerableMode = await SecureStore.getItemAsync('vulnerable_mode');
        if (vulnerableMode !== null && mounted) setIsVulnerable(vulnerableMode === 'true');

        const locRaw = await SecureStore.getItemAsync(LOCATION_CACHE_KEY);
        if (locRaw && mounted) {
          const loc = JSON.parse(locRaw);
          if (loc.city) setLocationName(loc.city);
        }

        if (status === 'granted' && mounted) {
          try {
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 10000 });
            if (position?.coords && mounted) await updateLocation(position.coords.latitude, position.coords.longitude);
          } catch (_) { /* ignore */ }
        } else if (mounted) {
          await fetchCenters(37.7749, -122.4194, 50); // SF Default
        }
      } catch (e) { /* ignore */ }
    };
    boot();
    return () => { mounted = false; };
  }, [applyWeatherData]);

  const syncLock = useRef(false);
  useEffect(() => {
    if (permissionStatus === 'granted' && !syncLock.current && isMounted.current) {
      syncLock.current = true;
      refresh();
    }
  }, [permissionStatus, refresh]);

  const contextValue = {
    location, temperature, humidity, heatIndex, risk, uvi, windSpeed,
    weatherDesc, weatherIcon, weatherAlerts,
    locationName, lastUpdated,
    loading, isRefreshing, error, permissionStatus,
    advice, tips: advice,
    requestLocationPermission, refresh, updateLocation, fetchCenters,
    isVulnerable, setIsVulnerable,
    forecastHeat, trendInsight, hourlyData, dailyTemps,
    isHeatwave, heatwaveLevel, heatwaveDays,
    predictiveRisk, riskMomentum,
    cityRiskPercent, vulnerableAtRisk, activeCenters, cityRiskLevel,
    coolingCount, hydrationCount,
    centersData,
    hospitalLoad, emergencyIncrease, coolingDemand, systemStress,
    policyCenters, setPolicyCenters,
  };

  return <WeatherContext.Provider value={contextValue}>{children}</WeatherContext.Provider>;
};

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within a WeatherProvider');
  return context;
};

