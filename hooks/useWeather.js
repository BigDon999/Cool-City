import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../utils/supabase';

const WeatherContext = createContext(null);

export const WeatherProvider = ({ children }) => {
  const [temperature, setTemperature] = useState(0);
  // ... (Full state/logic here) ...

  const [humidity, setHumidity] = useState(0);
  const [heatIndex, setHeatIndex] = useState(0);
  const [risk, setRisk] = useState("SAFE");
  const [locationName, setLocationName] = useState("Locating...");
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState("");
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

  const calculateHeatIndex = (T, R) => {
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
  };

  const getRiskLevel = (hi) => {
    if (hi < 27) return "SAFE";
    if (hi < 32) return "CAUTION";
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

  const tips = getTips(risk);

  const fetchWeatherData = async (lat, lon) => {
    try {
      const weatherApiUrl = process.env.EXPO_PUBLIC_WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast';
      const response = await fetch(
        `${weatherApiUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max&timezone=auto`
      );
      const data = await response.json();

      const temp = data.current.temperature_2m;
      const hum = data.current.relative_humidity_2m;
      
      const hi = calculateHeatIndex(temp, hum);
      const riskLevel = getRiskLevel(hi);

      setTemperature(temp);
      setHumidity(hum);
      setHeatIndex(hi);
      
      // Hourly Forecast Data
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
      
      // Daily Forecast Data (Store for Effect)
      if (data.daily && data.daily.temperature_2m_max) {
          setDailyTemps(data.daily.temperature_2m_max);
      }
      
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.log("Weather fetch error:", err);
    }
  };

  // --- RISK & IMPACT ENGINE (Reactive) ---
  useEffect(() => {
    if (heatIndex === null) return;

    // 1. Basic Risk Advice
    const rLevel = getRiskLevel(heatIndex);
    setRisk(rLevel);
    setAdvice(generateAdvice(rLevel));

    let hwLevel = null;
    let hwMultiplier = 1;
    let momentum = 0;

    // 2. Heatwave Detection & Predictive
    if (dailyTemps.length > 0) {
        let consecutive = 0;
        for (let t of dailyTemps) {
            if (t >= 35) consecutive++; else if (consecutive > 0) break;
        }
        
        if (consecutive >= 3) {
            setIsHeatwave(true);
            setHeatwaveDays(consecutive);
            if (consecutive === 3) { hwLevel = "Moderate"; hwMultiplier = 1.1; }
            else if (consecutive === 4) { hwLevel = "Severe"; hwMultiplier = 1.25; }
            else { hwLevel = "Extreme"; hwMultiplier = 1.4; }
            setHeatwaveLevel(hwLevel);
        } else {
            setIsHeatwave(false);
            setHeatwaveLevel(null);
            setHeatwaveDays(0);
        }

        // 3. Predictive Risk (Momentum)
        let results = [];
        dailyTemps.slice(0, 5).forEach((temp, index) => {
            let baseRisk = 0;
            if (temp < 27) baseRisk = 1;
            else if (temp < 32) baseRisk = 2;
            else if (temp < 41) baseRisk = 3;
            else baseRisk = 4;
            
            if (temp >= 32) momentum += 0.5;
            else momentum = Math.max(0, momentum - 0.3);
            
            let vulnerableModifier = isVulnerable ? 1.2 : 1;
            let predictiveScore = (baseRisk + momentum) * vulnerableModifier;
            results.push({ day: index, score: predictiveScore.toFixed(1) });
        });
        setPredictiveRisk(results);
        setRiskMomentum(momentum);
    }

    // 4. City Risk Status
    let cPercent = 15;
    let cLevel = "Low";
    if (heatIndex < 27) { cPercent = 15; cLevel = "Low"; }
    else if (heatIndex < 32) { cPercent = 35; cLevel = "Moderate"; }
    else if (heatIndex < 41) { cPercent = 65; cLevel = "High"; }
    else { cPercent = 85; cLevel = "Critical"; }
    
    setCityRiskPercent(cPercent);
    setCityRiskLevel(cLevel);
    
    const totalPop = 500000;
    const vulnRatio = 0.18;
    const vuln = Math.round(totalPop * vulnRatio * (cPercent / 100));
    setVulnerableAtRisk(vuln);
    
    // Base active centers based on demand
    const baseCenters = Math.max(5, Math.round(cPercent / 10));
    const totalCenters = baseCenters + policyCenters;
    setActiveCenters(totalCenters);

    // 5. System Impact Calculation
    let baseLoad = cPercent * 0.6;
    let momentumFactor = 1 + (momentum * 0.1);
    
    // Policy Mitigation (2% per center, max 40%)
    const mitigation = Math.min(0.4, policyCenters * 0.02);
    const mitigationFactor = 1 - mitigation;

    let hospital = Math.min(100, baseLoad * hwMultiplier * momentumFactor * mitigationFactor);
    let emergency = Math.min(200, Math.round(hospital * 1.5));
    // Grid demand increases slightly with more centers running
    let cooling = Math.min(100, Math.round(cPercent * hwMultiplier) + (policyCenters * 0.5));
    
    setHospitalLoad(Math.round(hospital));
    setEmergencyIncrease(emergency);
    setCoolingDemand(Math.round(cooling));
    
    if (hospital < 50) setSystemStress("Stable");
    else if (hospital < 70) setSystemStress("Elevated");
    else if (hospital < 85) setSystemStress("High");
    else setSystemStress("Critical");

  }, [heatIndex, dailyTemps, isVulnerable, policyCenters]);

  const updateLocation = async (lat, lon) => {
      console.log("useWeather: updateLocation triggered with", lat, lon);
      setLoading(true);
      try {
        // Mock location object structure
        const newLoc = { coords: { latitude: lat, longitude: lon } };
        setLocation(newLoc);
        
        // Reverse Geocode
        try {
          let reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (reverseGeocode.length > 0) {
              const city = reverseGeocode[0].city || reverseGeocode[0].region;
              console.log("useWeather: locationName resolved to:", city);
              setLocationName(city);
              setCity(city);
          } else {
              setLocationName(`Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`);
          }
        } catch (e) {
          console.log("Reverse Geocode Error:", e);
          setLocationName("New Location");
        }

        await fetchWeatherData(lat, lon);
        
        // Update Centers for new location
        if (typeof generateCenters === 'function') {
             setCentersData(generateCenters(lat, lon));
        } else {
             // Fallback if generateCenters isn't defined in scope (it was defined inside updateLocation in previous code?)
             // It seems it was defined locally. I need to keep the local definition or move it out.
             // Re-defining it here to be safe and consistent.
             const centers = [];
             const types = ['cooling', 'hydration', 'park'];
             const names = {
                cooling: ["Community Center", "Cooling Oasis", "City Library", "Public Shelter", "Social Club"],
                hydration: ["Public Fountain", "Water Station", "Hydration Hub", "Refill Point", "Cool Sprinkler"],
                park: ["City Park", "Green Garden", "Botanical Zone", "Shaded Square", "Metro Plaza"]
            };
            
            for (let i = 0; i < 12; i++) {
                const type = types[i % 3];
                centers.push({
                    id: `center-${i}-${type}`,
                    title: names[type][Math.floor(Math.random() * names[type].length)] + ` ${i + 1}`,
                    description: type === 'hydration' ? "Free chilled water" : (type === 'cooling' ? "Open 9AM - 9PM" : "Shaded green area"),
                    coordinate: {
                        latitude: lat + (Math.random() - 0.5) * 0.08,
                        longitude: lon + (Math.random() - 0.5) * 0.08,
                    },
                    type: type,
                    status: i % 4 === 0 ? "Full" : "Active"
                });
            }
            setCentersData(centers);
        }
      } catch (error) {
          console.log("updateLocation Error:", error);
      } finally {
          setLoading(false);
      }
  };

  const refresh = useCallback(async () => {
    console.log("useWeather: refresh triggered");
    setLoading(true);
    try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log("useWeather: permission status:", status);
        if (status !== 'granted') {
        //   alert("Permission to access location was denied");
          // Don't alert, just log and return. Alerting loops are annoying.
          console.log("Permission denied");
          setLoading(false);
          return;
        }
        
        let location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 5000
        });
        
        if (!location || !location.coords) {
            throw new Error("Could not retrieve location");
        }

        setLocation(location);
        
        try {
            let reverseGeocode = await Location.reverseGeocodeAsync(location.coords);
            if (reverseGeocode.length > 0) {
            const city = reverseGeocode[0].city || reverseGeocode[0].region;
            setLocationName(city);
            setCity(city);
            
            await SecureStore.setItemAsync('lastLocation', JSON.stringify({
                lat: location.coords.latitude,
                lon: location.coords.longitude,
                city: city
            }));
            }
        } catch (e) {
            console.log("Geocode error:", e);
        }

        await fetchWeatherData(location.coords.latitude, location.coords.longitude);
        
        // Generate Mock Centers
        const centers = [];
        const types = ['cooling', 'hydration', 'park'];
        const names = {
            cooling: ["Community Center", "Cooling Oasis", "City Library", "Public Shelter", "Social Club"],
            hydration: ["Public Fountain", "Water Station", "Hydration Hub", "Refill Point", "Cool Sprinkler"],
            park: ["City Park", "Green Garden", "Botanical Zone", "Shaded Square", "Metro Plaza"]
        };
        
        for (let i = 0; i < 12; i++) {
            const type = types[i % 3];
            centers.push({
                id: `live-center-${i}-${type}`,
                title: names[type][Math.floor(Math.random() * names[type].length)] + ` ${i + 1}`,
                description: type === 'hydration' ? "Free chilled water" : (type === 'cooling' ? "Open 9AM - 9PM" : "Shaded green area"),
                coordinate: {
                    latitude: location.coords.latitude + (Math.random() - 0.5) * 0.08,
                    longitude: location.coords.longitude + (Math.random() - 0.5) * 0.08,
                },
                type: type,
                status: i % 4 === 0 ? "Full" : "Active"
            });
        }
        setCentersData(centers);
    } catch (error) {
        console.log("Refresh Error:", error);
    } finally {
        setLoading(false);
    }
  }, []);

  // Safe Supabase Fetching
  const fetchSupabaseData = async () => {
    try {
      // 1. Safe Heat Reports Fetch
      const { data: reports, error: reportsError } = await supabase
        .from('heat_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (reportsError) {
        console.error('Supabase Error (heat_reports):', reportsError.message);
      } else if (!reports || reports.length === 0) {
        console.log('Supabase Info: No heat reports found. Using defaults.');
      } else {
        // Only use data if it exists
        // console.log('Heat Reports loaded:', reports.length);
      }

      // 2. Safe Risk Predictions Fetch
      const { data: predictions, error: predError } = await supabase
        .from('risk_predictions')
        .select('*')
        .limit(1);

      if (predError) {
        console.error('Supabase Error (risk_predictions):', predError.message);
      } else if (!predictions || predictions.length === 0) {
        console.log('Supabase Info: No risk predictions found. Using defaults.');
      } else {
        // Safe access
        if (predictions[0]) {
           // setPredictiveRisk(predictions[0].data || []); // Example usage
        }
      }
    } catch (err) {
      console.error('Global Async Error (Supabase):', err);
    }
  };

  // Initial Fetch on Mount
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
        try {
            await refresh();
            if (mounted) await fetchSupabaseData();
        } catch (e) {
            console.error("Initialization Error:", e);
        }
    };
    
    init();

    return () => { mounted = false; };
  }, [refresh]);

  /* OLD return { ... } replaced by Context Value */
  const contextValue = {
    location,
    temperature,
    humidity,
    heatIndex,
    risk,
    locationName,
    lastUpdated,
    loading,
    tips,
    advice,
    refresh,
    isVulnerable,
    setIsVulnerable,
    forecastHeat,
    trendInsight,
    isHeatwave,
    heatwaveLevel,
    heatwaveDays,
    predictiveRisk,
    riskMomentum,
    // City Risk
    cityRiskPercent,
    vulnerableAtRisk,
    activeCenters,
    cityRiskLevel,
    // System Impact
    hospitalLoad,
    emergencyIncrease,
    coolingDemand,
    systemStress,
    // Policy
    policyCenters,
    setPolicyCenters,
    // Data
    dailyTemps,
    centersData,
    updateLocation,
  };

  return (
    <WeatherContext.Provider value={contextValue}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => {
    const context = useContext(WeatherContext);
    if (!context) {
        throw new Error('useWeather must be used within a WeatherProvider');
    }
    return context;
};

// Helper for tips (local func or inside component if preferred, but simpler here)
// Actually I missed defining getTips properly above, wait.
// In the original file, generateAdvice return array of objects.
// Let's redefine 'tips' as 'advice' alias or just usage.
// In HomeScreen: const { tips } = useWeather().
// But in state I have 'advice'.
// Original code had tips derived from getTips(risk).
// I should include getTips function.

const getTips = (risk) => {
    switch (risk) {
      case "SAFE":
        return [
          { title: "Enjoy Outdoors", text: "Conditions are safe for outdoor activities.", icon: "wb-sunny" },
          { title: "Stay Active", text: "Great weather for exercise or walking.", icon: "directions-run" },
          { title: "Open Windows", text: "Good time to ventilate your home naturally.", icon: "window" }
        ];
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
