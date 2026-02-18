import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../utils/supabase';

const WeatherContext = createContext(null);

export const WeatherProvider = ({ children }) => {
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [heatIndex, setHeatIndex] = useState(0);
  const [risk, setRisk] = useState("SAFE");
  const [locationName, setLocationName] = useState("Unknown Location");
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [advice, setAdvice] = useState([]);
  const [city, setCity] = useState("");
  const [location, setLocation] = useState(null);
  const [isVulnerable, setIsVulnerable] = useState(false);
  const [forecastHeat, setForecastHeat] = useState([]);
  const [trendInsight, setTrendInsight] = useState("");
  
  // Heatwave State
  const [isHeatwave, setIsHeatwave] = useState(false);
  const [heatwaveLevel, setHeatwaveLevel] = useState(null);
  const [heatwaveDays, setHeatwaveDays] = useState(0);
  
  // Data State
  const [dailyTemps, setDailyTemps] = useState([]);
  
  // Predictive Risk State
  const [predictiveRisk, setPredictiveRisk] = useState([]);
  const [riskMomentum, setRiskMomentum] = useState(0);

  // City Risk State
  const [cityRiskPercent, setCityRiskPercent] = useState(0);
  const [vulnerableAtRisk, setVulnerableAtRisk] = useState(0);
  const [activeCenters, setActiveCenters] = useState(0);
  const [centersData, setCentersData] = useState([]);
  const [cityRiskLevel, setCityRiskLevel] = useState("Low");

  // System Impact State
  const [hospitalLoad, setHospitalLoad] = useState(0);
  const [emergencyIncrease, setEmergencyIncrease] = useState(0);
  const [coolingDemand, setCoolingDemand] = useState(0);
  const [systemStress, setSystemStress] = useState("Stable");

  // Policy Simulation State
  const [policyCenters, setPolicyCenters] = useState(0);

  // --- NEW PRODUCTION STATES ---
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [error, setError] = useState(null);

  const calculateHeatIndex = (T, R) => {
    try {
      return Math.round(
        -8.784695 +
          1.61139411 * T +
          2.338549 * R -
          0.14611605 * T * R -
          0.012308094 * T * T -
          0.01642482777 * R * R +
          0.002211732 * T * T * R +
          0.00072546 * T * R * R -
          0.000003582 * T * T * R * R
      );
    } catch (e) {
      console.error("Heat Index Calc Error:", e);
      return T;
    }
  };

  const getRiskLevel = (hi) => {
    if (hi < 27) return "SAFE";
    if (hi < 30) return "MODERATE";
    if (hi < 35) return "CAUTION";
    if (hi < 41) return "DANGER";
    return "EXTREME";
  };
  
  const generateAdvice = (level) => {
    switch (level) {
      case "SAFE":
        return [
          { title: "Enjoy Outdoors", text: "Conditions are safe for outdoor activities.", icon: "wb-sunny" },
          { title: "Stay Active", text: "Great weather for exercise or walking.", icon: "directions-run" },
          { title: "Open Windows", text: "Good time to ventilate your home naturally.", icon: "window" }
        ];
      case "MODERATE":
      case "CAUTION":
        return [
          { title: "Drink More Water", text: "Heat is rising. Hydrate before you feel thirsty.", icon: "water-drop" },
          { title: "Seek Shade", text: "Take frequent breaks in shaded areas when outdoors.", icon: "park" },
          { title: "Dress Light", text: "Wear light-colored, loose-fitting clothes to reflect heat.", icon: "checkroom" }
        ];
      case "DANGER":
      case "EXTREME":
        return [
          { title: "Stay Indoors", text: "Avoid outdoor activities immediately. Stay in air-conditioning.", icon: "home" },
          { title: "Check Vulnerable", text: "Check on elderly neighbors, children, and pets.", icon: "people" },
          { title: "Find Cooling", text: "If you lack AC, go to a public library or cooling center.", icon: "ac-unit" }
        ];
      default:
        return [];
    }
  };

  const fetchWeatherData = async (lat, lon) => {
    if (lat === undefined || lon === undefined) return;
    try {
      const weatherApiUrl = process.env.EXPO_PUBLIC_WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast';
      const response = await fetch(
        `${weatherApiUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max&timezone=auto`
      );
      const data = await response.json();

      if (!data || !data.current) throw new Error("Weather API returned incompatible data.");

      const temp = data.current.temperature_2m;
      const hum = data.current.relative_humidity_2m;
      
      const hi = calculateHeatIndex(temp, hum);
      const riskLevel = getRiskLevel(hi);

      setTemperature(temp);
      setHumidity(hum);
      setHeatIndex(hi);
      
      const currentHour = new Date().getHours();
      if (data.hourly && data.hourly.temperature_2m) {
          const nextThreeHeat = [];
          for (let i = 1; i <= 3; i++) {
              const idx = currentHour + i;
              if (idx < data.hourly.temperature_2m.length) {
                  const fTemp = data.hourly.temperature_2m[idx];
                  const fHum = data.hourly.relative_humidity_2m[idx];
                  const fHi = calculateHeatIndex(fTemp, fHum);
                  nextThreeHeat.push(fHi);
              }
          }
          setForecastHeat(nextThreeHeat);
          
          if (nextThreeHeat.length > 0) {
             const avgFuture = nextThreeHeat.reduce((a, b) => a + b, 0) / nextThreeHeat.length;
             if (avgFuture > hi + 1) setTrendInsight("Heat Rising 📈");
             else if (avgFuture < hi - 1) setTrendInsight("Heat Decreasing 📉");
             else setTrendInsight("Heat Stable ⚖️");
          }
      }
      
      if (data.daily && data.daily.temperature_2m_max) {
          setDailyTemps(data.daily.temperature_2m_max);
      }
      
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("useWeather: fetchWeatherData Error:", err);
      setError("Weather update failed.");
    }
  };

  useEffect(() => {
    const rLevel = getRiskLevel(heatIndex);
    setRisk(rLevel);
    setAdvice(generateAdvice(rLevel));

    // Calculate City-Wide Risk Metrics
    const baseRisk = Math.min(100, Math.max(5, (heatIndex / 50) * 100));
    setCityRiskPercent(Math.round(baseRisk));
    setCityRiskLevel(rLevel);
    
    // Active centers logic
    const centersCount = rLevel === "SAFE" ? 2 : (rLevel === "MODERATE" ? 8 : (rLevel === "CAUTION" ? 15 : 24));
    setActiveCenters(centersCount + policyCenters);

    // Derived System Impacts
    const hLoad = Math.min(100, Math.round(baseRisk * 0.8));
    const eIncrease = Math.min(100, Math.round(baseRisk * 0.5 + (isVulnerable ? 15 : 0)));
    const cDemand = Math.min(100, Math.round((temperature / 45) * 100));

    setHospitalLoad(hLoad);
    setEmergencyIncrease(eIncrease);
    setCoolingDemand(cDemand);

    // Determine System Stress Level
    const avgStress = (hLoad + eIncrease + cDemand) / 3;
    if (avgStress < 30) setSystemStress("Stable");
    else if (avgStress < 60) setSystemStress("Elevated");
    else if (avgStress < 85) setSystemStress("Critical");
    else setSystemStress("Overloaded");

  }, [heatIndex, temperature, isVulnerable, policyCenters]);

  const updateLocation = async (lat, lon) => {
      if (lat === undefined || lon === undefined) return null;
      setLoading(true);
      setError(null);
      try {
        const newLoc = { coords: { latitude: lat, longitude: lon } };
        setLocation(newLoc);
        await fetchWeatherData(lat, lon);
        
        // Generate Mock Centers
        const centers = [];
        const types = ['cooling', 'hydration', 'park'];
        for (let i = 0; i < 12; i++) {
            centers.push({
                id: `center-${i}-${lat}-${lon}`,
                title: `${types[i % 3].toUpperCase()} Depot ${i+1}`,
                coordinate: { latitude: lat + (Math.random() - 0.5) * 0.05, longitude: lon + (Math.random() - 0.5) * 0.05 },
                type: types[i % 3],
            });
        }
        setCentersData(centers);
        return { latitude: lat, longitude: lon };
      } catch (error) {
          console.error("useWeather: updateLocation Error:", error);
          setError("Location sync failed.");
          return null;
      } finally {
          setLoading(false);
      }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status;
    } catch (e) {
      console.error("useWeather: Permission Request Error:", e);
      return 'denied';
    }
  };

  const refresh = useCallback(async () => {
    if (isRefreshing) return null;
    setIsRefreshing(true);
    setLoading(true);
    setError(null);
    
    try {
        const { status } = await Location.getForegroundPermissionsAsync();
        setPermissionStatus(status);
        if (status !== 'granted') {
            return null;
        }

        const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000
        });

        if (!position || !position.coords) {
            throw new Error("GPS Signal timeout.");
        }

        const { latitude, longitude } = position.coords;
        await updateLocation(latitude, longitude);
        
        try {
            // Reverse Geocode with a fast fail expectation
            const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocode && geocode.length > 0) {
                const name = geocode[0].city || geocode[0].subregion || geocode[0].region || "Known Location";
                setLocationName(name);
                try {
                   await SecureStore.setItemAsync('lastLocation', JSON.stringify({ lat: latitude, lon: longitude, city: name }));
                } catch (ssErr) { console.warn("SecureStore write failed (likely limit):", ssErr.message); }
            }
        } catch (e) { 
            console.log("useWeather: Geocode skipped (Timeout or Service Unavailable)");
            // Keep existing locationName or use a generic fallback
        }

        return { latitude, longitude };
    } catch (err) {
        console.error("useWeather: refresh Error:", err);
        setError("Could not retrieve live location.");
        return null;
    } finally {
        setIsRefreshing(false);
        setLoading(false);
    }
  }, [isRefreshing]);

  // Sync permission status on mount WITHOUT auto-refreshing position
  useEffect(() => {
    let mounted = true;
    const checkPermission = async () => {
        try {
            // Check status without triggering a request or a refresh
            const { status } = await Location.getForegroundPermissionsAsync();
            if (mounted) {
                setPermissionStatus(status);
            }
        } catch (e) { 
            console.error("useWeather: Permission sync error", e); 
        }
    };
    checkPermission();
    return () => { mounted = false; };
  }, []);

  const contextValue = {
    location, temperature, humidity, heatIndex, risk, locationName,
    lastUpdated, loading, isRefreshing, error, permissionStatus, advice,
    tips: advice, // Backward compatibility for AdviceScreen
    requestLocationPermission, refresh, isVulnerable, setIsVulnerable,
    forecastHeat, trendInsight, isHeatwave, heatwaveLevel, heatwaveDays,
    predictiveRisk, riskMomentum, cityRiskPercent, vulnerableAtRisk,
    activeCenters, cityRiskLevel, hospitalLoad, emergencyIncrease,
    coolingDemand, systemStress, policyCenters, setPolicyCenters,
    dailyTemps, centersData, updateLocation,
  };

  return <WeatherContext.Provider value={contextValue}>{children}</WeatherContext.Provider>;
};

export const useWeather = () => {
    const context = useContext(WeatherContext);
    if (!context) throw new Error('useWeather must be used within a WeatherProvider');
    return context;
};
