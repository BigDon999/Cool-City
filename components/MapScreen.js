import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, TextInput, Alert, Keyboard, Platform, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../hooks/use-color-scheme';
import { useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWeather } from '../hooks/useWeather';
import { theme, darkMapStyle } from '../constants/theme';
import { CoolingCenterService } from '../services/coolingCenterService';
import polyline from '@mapbox/polyline';

// SAFE NATIVE IMPORT - Prevent fatal crash if module is missing
let SpeechRecognition = null;
try {
  const lib = require('expo-speech-recognition');
  SpeechRecognition = lib.SpeechRecognition;
} catch (e) {
  console.log('[MapScreen] SpeechRecognition module not found in this build');
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const FALLBACK_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mapRef = useRef(null);
  const bottomSheetRef = useRef(null);
  
  const { 
    location, 
    locationName, 
    risk, 
    heatIndex, 
    temperature, 
    uvi,
    updateLocation, 
    refresh, 
    fetchCenters,
    centersData,
    activeCenters,
    coolingCount,
    hydrationCount,
    permissionStatus,
    requestLocationPermission,
    loading: weatherLoading 
  } = useWeather();
  
  const [mapReady, setMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [filter, setFilter] = useState('all'); 
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isMounted = useRef(true);

  const { autoRoute, filter: initialFilter } = useLocalSearchParams();
  const [triggerAuto, setTriggerAuto] = useState(autoRoute === 'true');

  const handleAutoRoute = useCallback(async () => {
    if (!location?.coords || !mapReady) return;
    
    // Use the pre-calculated centers from useWeather (already sorted by proximity)
    const availableCenters = initialFilter && initialFilter !== 'all'
      ? centersData.filter(m => m.type === initialFilter || (initialFilter === 'cooling' && m.type === 'park'))
      : centersData;

    if (availableCenters && availableCenters.length > 0) {
      const nearest = availableCenters[0];
      if (__DEV__) console.log(`🚀 [MapScreen] Auto-Routing to nearest ${initialFilter || 'safety hub'}: ${nearest.title}`);
      
      // Select it (this triggers the routing)
      handleSelectCenter(nearest);
    } else {
      if (__DEV__) console.warn("No centers available in current geo-context for auto-route.");
      Alert.alert("No Spots Found", "We couldn't find any resources in your immediate area yet.");
    }
    
    setTriggerAuto(false);
  }, [location, mapReady, centersData, initialFilter, handleSelectCenter]);

  useEffect(() => {
    if (triggerAuto && mapReady && location?.coords) {
      handleAutoRoute();
    }
  }, [triggerAuto, mapReady, location, handleAutoRoute]);

  useEffect(() => {
    isMounted.current = true;
    
    // Check if module is available
    if (!SpeechRecognition) return;

    // expo-speech-recognition Listeners
    const resultSub = SpeechRecognition.addEventListener("result", (event) => {
      if (event.results && event.results.length > 0) {
        const text = event.results[0].transcript;
        setSearchQuery(text);
        // Requirement: Stop listening automatically after result is captured
        SpeechRecognition.stop(); 
      }
    });

    const startSub = SpeechRecognition.addEventListener("start", () => setIsListening(true));
    const endSub = SpeechRecognition.addEventListener("end", () => setIsListening(false));
    const errorSub = SpeechRecognition.addEventListener("error", (event) => {
      console.warn('Speech Recognition Error:', event.error);
      setIsListening(false);
    });

    return () => { 
      isMounted.current = false;
      resultSub.remove();
      startSub.remove();
      endSub.remove();
      errorSub.remove();
      SpeechRecognition.stop();
    };
  }, []);

  // Auto-search after voice input is finalized
  useEffect(() => {
    if (!isListening && searchQuery.length > 2 && searchQuery !== '') {
       // Only auto-trigger if the keyboard isn't already up (likely from voice)
       const timer = setTimeout(() => {
         handleSearch();
       }, 500);
       return () => clearTimeout(timer);
    }
  }, [isListening, searchQuery]);

  const toggleVoiceSearch = async () => {
    try {
      // Safety check for native module availability
      if (!SpeechRecognition) {
        Alert.alert(
          "Feature Unavailable",
          "Voice search requires a native development build. It is not supported in the standard Expo Go app."
        );
        return;
      }

      if (isListening) {
        SpeechRecognition.stop();
        return;
      }

      // 1. Properly request permissions for both mic and speech interface
      const { granted } = await SpeechRecognition.requestPermissionsAsync();
      
      if (!granted) {
        Alert.alert(
          "Permission Denied", 
          "CoolCity needs microphone and speech recognition access to search by voice. Please enable them in your device settings."
        );
        return;
      }

      // 2. Start recognition with required configuration
      setSearchQuery('');
      SpeechRecognition.start({ 
        lang: 'en-US', 
        interimResults: false, // Wait for final result before updating state
        continuous: false      // Stop after one result
      });

      // 3. Trigger feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsListening(true);

    } catch (e) {
      console.error('Voice search initialization failed:', e);
      Alert.alert(
        "Voice Search Error",
        `Failed to start voice search: ${e.message}`
      );
      setIsListening(false);
    }
  };

  const handleSelectCenter = async (marker) => {
    if (isRouting) return;
    setSelectedCenter(marker);
    goToLocation(marker.coordinate);
    
    // If we have user location, generate a route
    if (location?.coords) {
      setIsRouting(true);
      try {
        const route = await CoolingCenterService.getCoolRoute(
          { latitude: location.coords.latitude, longitude: location.coords.longitude },
          { latitude: marker.coordinate.latitude, longitude: marker.coordinate.longitude }
        );

        if (route && route.polyline) {
          const points = polyline.decode(route.polyline);
          const coords = points.map(p => ({ latitude: p[0], longitude: p[1] }));
          setRouteCoordinates(coords);
          setSelectedCenter({ ...marker, routeInfo: route });
          
          // Focus map on route
          if (mapRef.current) {
            mapRef.current.fitToCoordinates([
                { latitude: location.coords.latitude, longitude: location.coords.longitude },
                ...coords
            ], {
              edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
              animated: true
            });
          }
        }
      } catch (err) {
        console.error("Routing Error:", err);
      } finally {
        setIsRouting(false);
      }
    }
    
    // Open bottom sheet to show details
    bottomSheetRef.current?.snapToIndex(1);
  };

  // Filtered markers based on selection
  const filteredMarkers = useMemo(() => {
      if (!Array.isArray(centersData)) {
        if (__DEV__) console.warn("[MapScreen] centersData is not an array:", centersData);
        return [];
      }
      
      const res = filter === 'all' 
        ? centersData 
        : centersData.filter(m => m.type === filter || (filter === 'cooling' && m.type === 'park')); 
      
      if (__DEV__) {
        console.log(`📍 [MapScreen] Marker Diagnostic:`);
        console.log(`   > Total in State: ${centersData.length}`);
        console.log(`   > Active Filter: ${filter}`);
        console.log(`   > Passing Filter: ${res.length}`);
        if (res.length > 0) {
          console.log(`   > Sample Coord:`, res[0].coordinate);
          console.log(`   > Coord Types: lat=${typeof res[0].coordinate.latitude}, lon=${typeof res[0].coordinate.longitude}`);
        }
      }
      return res;
  }, [centersData, filter]);


  // Auto-center when location is first found
  useEffect(() => {
    if (location?.coords && mapReady && !isLocating) {
      safeAnimate(location.coords.latitude, location.coords.longitude);
    }
  }, [location, mapReady]);

  const onMapReady = useCallback(() => {
    console.log("MapScreen: onMapReady triggered");
    if (isMounted.current) setMapReady(true);
  }, []);

  const safeAnimate = useCallback((lat, lon) => {
    if (mapRef.current && mapReady && lat !== undefined && lon !== undefined) {
        try {
            mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lon,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
            }, 1000);
        } catch (e) {
            console.warn("MapScreen: Animation Crash Prevented", e);
        }
    }
  }, [mapReady]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || isLocating) return;
    Keyboard.dismiss();
    if (isMounted.current) setIsLocating(true);
    
    try {
        const geocoded = await Location.geocodeAsync(searchQuery);
        if (geocoded && geocoded.length > 0) {
            const { latitude, longitude } = geocoded[0];
            const result = await updateLocation(latitude, longitude);
            if (result && isMounted.current) {
                safeAnimate(result.latitude, result.longitude);
            }
        } else {
            Alert.alert("Location not found", "Please check your search term.");
        }
    } catch (e) {
        console.error("MapScreen: Search Error:", e);
        Alert.alert("Search Error", "Network connectivity issue.");
    } finally {
        if (isMounted.current) setIsLocating(false);
    }
  };

  const handleReportHub = async () => {
    if (!location?.coords) {
      Alert.alert("Location Unknown", "We need your GPS position to report a new safety hub.");
      return;
    }

    Alert.alert(
      "Report Safety Hub",
      "Which resource is available at your current location?",
      [
        { text: "Cooling Hub", onPress: () => submitNewHub('cooling') },
        { text: "Hydration Point", onPress: () => submitNewHub('hydration') },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const submitNewHub = async (type) => {
    setIsLocating(true);
    try {
      const { latitude, longitude } = location.coords;
      const res = await CoolingCenterService.createCenter({
        name: `User Reported ${type === 'cooling' ? 'Hub' : 'Point'}`,
        type,
        latitude,
        longitude
      });

      if (res) {
        Alert.alert("Success", "Your location has been added to the safety network.");
        await fetchCenters(latitude, longitude, 50); // Refresh immediately
      }
    } catch (e) {
      Alert.alert("Reporting Failed", "Could not reach the safety server.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleLocateMe = async () => {
    if (isLocating) return;
    if (isMounted.current) setIsLocating(true);
    
    try {
        if (permissionStatus !== 'granted') {
            const status = await requestLocationPermission();
            if (status !== 'granted') {
                Alert.alert("Permission Required", "Please enable location in settings.");
                return;
            }
        }
        
        const coords = await refresh();
        if (coords && coords.latitude && coords.longitude && isMounted.current) {
            safeAnimate(coords.latitude, coords.longitude);
        } else if (isMounted.current) {
            Alert.alert("Signal Weak", "Could not pinpoint location. Try moving outdoors.");
        }
    } catch (err) {
        console.error("MapScreen: LocateMe Error:", err);
    } finally {
        if (isMounted.current) setIsLocating(false);
    }
  };

  const handleZoom = (type) => {
    if (!mapRef.current || !mapReady) return;
    try {
        mapRef.current.getCamera().then(camera => {
          if (!isMounted.current) return;
          const zoomLevel = type === 'in' ? (camera.zoom || 15) + 1 : (camera.zoom || 15) - 1;
          mapRef.current.animateCamera({ zoom: zoomLevel }, { duration: 400 });
        }).catch(e => console.warn("Camera Error", e));
    } catch (e) { console.error("Zoom Error", e); }
  };

  const goToLocation = (coord) => {
    if (!mapRef.current || !mapReady || !coord) return;
    try {
        mapRef.current.animateToRegion({
          ...coord,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        }, 1000);
    } catch (e) { console.error("Marker GoTo Error", e); }
  };

  const riskStyles = useMemo(() => {
    switch (risk) {
      case "SAFE": return { bg: '#f0fdf4', border: '#dcfce7', text: '#166534' };
      case "MODERATE":
      case "CAUTION": return { bg: '#fff7ed', border: '#ffedd5', text: '#f97316' };
      case "DANGER": return { bg: '#fef2f2', border: '#fee2e2', text: '#991b1b' };
      case "EXTREME": return { bg: '#faf5ff', border: '#f3e8ff', text: '#6b21a8' };
      default: return { bg: '#f0fdf4', border: '#dcfce7', text: '#166534' };
    }
  }, [risk]);

  const riskColor = useMemo(() => {
    switch (risk) {
      case "SAFE": return theme.riskLow;
      case "MODERATE":
      case "CAUTION": return theme.riskMedium;
      case "DANGER": return theme.riskHigh;
      case "EXTREME": return theme.riskExtreme;
      default: return theme.riskLow;
    }
  }, [risk]);


  const textColor = isDark ? theme.textLight : theme.textDark;
  const subtextColor = isDark ? theme.subtextLight : theme.subtextDark;
  const bgColor = isDark ? theme.backgroundDark : theme.backgroundLight;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  // -- Dynamic Near-Point Analytics --
  const nearestCooling = useMemo(() => 
    centersData.find(m => m.type === 'cooling' || m.type === 'park'), 
  [centersData]);

  const nearestHydration = useMemo(() => 
    centersData.find(m => m.type === 'hydration'), 
  [centersData]);

  const formatDist = useCallback((meters) => {
    if (!meters && meters !== 0) return "--";
    const kms = meters / 1000;
    return kms < 1 ? `${Math.round(meters)}m` : `${kms.toFixed(1)}km`;
  }, []);

  const formatTime = useCallback((meters) => {
    if (!meters && meters !== 0) return "--";
    const mins = Math.round(meters / 80); // ~5km/h walking
    return mins < 1 ? "<1 min" : `${mins} mins`;
  }, []);

  const initialRegion = useMemo(() => {
    if (location?.coords) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04
      };
    }
    return FALLBACK_REGION;
  }, [location]);

  const openExternalMaps = (lat, lon, label) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lon}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    Linking.openURL(url);
  };

  // -- Route Specific Calculations --
  const routeCalculations = useMemo(() => {
    if (!selectedCenter?.routeInfo) return null;
    
    const distanceStr = selectedCenter.routeInfo.distance || '0m';
    const durationStr = selectedCenter.routeInfo.duration || '0m';
    
    const distValue = parseFloat(distanceStr.replace(/[^\d.]/g, '')) || 0;
    const isKm = distanceStr.toLowerCase().includes('km');
    const distMeters = isKm ? distValue * 1000 : distValue;

    const durValue = parseFloat(durationStr.replace(/[^\d.]/g, '')) || 0;
    const mins = durationStr.toLowerCase().includes('min') ? durValue : (distMeters / 80);

    // Dynamic metrics
    const hydrationNeeded = Math.max(0.1, mins * 0.03).toFixed(1); 
    const shadeCoverage = Math.max(40, 95 - (heatIndex * 0.4) - (distMeters / 1000)).toFixed(0);
    
    // Safety score logic
    let baseSafety = 98;
    if (risk === 'EXTREME') baseSafety -= 12;
    else if (risk === 'DANGER') baseSafety -= 7;
    else if (risk === 'CAUTION') baseSafety -= 3;
    const dynamicSafety = Math.min(100, Math.round(baseSafety + (distMeters < 300 ? 2 : 0)));

    return {
      hydration: `${hydrationNeeded}L`,
      shade: `${shadeCoverage}%`,
      safety: `${dynamicSafety}%`,
      thermalRelief: `-${(heatIndex * 0.06 + 0.5).toFixed(1)}°C`,
      exposureRisk: mins > 12 ? 'Moderate' : 'Low'
    };
  }, [selectedCenter, risk, heatIndex]);

  const snapPoints = useMemo(() => ['20%', '45%', '90%'], []);

  if (weatherLoading && !location) {
      return (
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: bgColor }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={{ marginTop: 12, color: textColor, opacity: 0.6 }}>Initializing Geo-Context...</Text>
          </View>
      );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {Platform.OS === 'web' ? (
           <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
              {process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                <iframe
                  title="Google Map Preview"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://www.google.com/maps/embed/v1/view?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&center=${initialRegion.latitude},${initialRegion.longitude}&zoom=14&maptype=roadmap${isDark ? '&style=element:geometry|color:0x212121&style=element:labels.icon|visibility:off&style=element:labels.text.fill|color:0x757575&style=element:labels.text.stroke|color:0x212121&style=feature:administrative|element:geometry|color:0x757575&style=feature:administrative.country|element:labels.text.fill|color:0x9e9e9e&style=feature:administrative.land_parcel|visibility:off&style=feature:administrative.locality|element:labels.text.fill|color:0xbdbdbd&style=feature:poi|element:geometry|color:0xeeeeee&style=feature:poi|element:labels.text.fill|color:0x757575&style=feature:poi.park|element:geometry|color:0x181818&style=feature:poi.park|element:labels.text.fill|color:0x616161&style=feature:road|element:geometry.fill|color:0x2c2c2c&style=feature:road|element:labels.text.fill|color:0x8a8a8a&style=feature:road.arterial|element:geometry|color:0x373737&style=feature:road.highway|element:geometry|color:0x3c3c3c&style=feature:road.highway.controlled_access|element:geometry|color:0x4e4e4e&style=feature:road.local|element:labels.text.fill|color:0x616161&style=feature:transit|element:labels.text.fill|color:0x757575&style=feature:water|element:geometry|color:0x000000&style=feature:water|element:labels.text.fill|color:0x3d3d3d' : ''}`}
                />
              ) : (
                <iframe
                  title="Map Fallback"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: isDark ? 'invert(90%) hue-rotate(180deg)' : 'none' }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${initialRegion.longitude - 0.01}%2C${initialRegion.latitude - 0.01}%2C${initialRegion.longitude + 0.01}%2C${initialRegion.latitude + 0.01}&layer=mapnik&marker=${initialRegion.latitude}%2C${initialRegion.longitude}`}
                />
              )}
              {/* Web Data Overlay Hint */}
              <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, alignItems: 'center' }}>
                <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={{ padding: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: textColor, textAlign: 'center' }}>
                    Web Preview Mode: Detailed markers and routing are best viewed in the Native App.
                  </Text>
                </BlurView>
              </View>
           </View>
        ) : ( 
          <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              onMapReady={onMapReady}
              showsUserLocation={permissionStatus === 'granted' && mapReady}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
              customMapStyle={isDark ? darkMapStyle : []}
              showsCompass={false}
              showsMyLocationButton={false}
              toolbarEnabled={false}
          >
              {location?.coords && showHeatMap && (
                  <>
                      {/* 
                         ENVIRONMENTAL HEAT INTENSITY LAYER 
                         Calculated based on actual Thermal Accumulation (Heat Index + Temp delta)
                      */}
                      {(() => {
                        // 1. Calculate Intensity Multipliers
                        const heatWeight = Math.max(1, heatIndex / 28);
                        const tempWeight = Math.max(1, temperature / 30);
                        const baseRadius = 600 * heatWeight; // Scales with humidity/HI
                        
                        // 2. Select Colors based on Risk level
                        let primaryColor, secondaryColor, perimeterColor;
                        switch(risk) {
                          case 'EXTREME': 
                            primaryColor = 'rgba(142, 68, 173, 0.35)'; // Purple (Extreme)
                            secondaryColor = 'rgba(142, 68, 173, 0.15)'; 
                            perimeterColor = 'rgba(231, 76, 60, 0.1)';
                            break;
                          case 'DANGER':
                            primaryColor = 'rgba(231, 76, 60, 0.3)';   // Red (Danger)
                            secondaryColor = 'rgba(231, 76, 60, 0.15)';
                            perimeterColor = 'rgba(231, 76, 60, 0.08)';
                            break;
                          case 'CAUTION':
                          case 'MODERATE':
                            primaryColor = 'rgba(243, 156, 18, 0.25)'; // Orange (Moderate)
                            secondaryColor = 'rgba(243, 156, 18, 0.12)';
                            perimeterColor = 'rgba(243, 156, 18, 0.06)';
                            break;
                          default:
                            primaryColor = 'rgba(46, 204, 112, 0.2)';  // Green (Safe)
                            secondaryColor = 'rgba(46, 204, 112, 0.1)';
                            perimeterColor = 'transparent';
                        }

                        return (
                          <>
                            {/* Layer 1: Core Saturation (1x Radius) */}
                            <Circle 
                                center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
                                radius={baseRadius} 
                                fillColor={primaryColor} 
                                strokeColor="transparent"
                            />
                            {/* Layer 2: Atmospheric Bloom (2x Radius) */}
                            <Circle 
                                center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
                                radius={baseRadius * 2.2} 
                                fillColor={secondaryColor} 
                                strokeColor="transparent"
                            />
                            {/* Layer 3: Perimeter Risk (Applied only in high stress) */}
                            {perimeterColor !== 'transparent' && (
                              <Circle 
                                center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
                                radius={baseRadius * 4.5} 
                                fillColor={perimeterColor} 
                                strokeColor="transparent"
                              />
                            )}
                            
                            {/* UV APERTURE: Visualize piercing sun risk if UVI is high */}
                            {uvi > 6 && (
                              <Circle 
                                center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
                                radius={250} 
                                fillColor="rgba(255, 255, 255, 0.15)"
                                strokeColor="rgba(255, 255, 255, 0.3)"
                                strokeWidth={2}
                              />
                            )}
                          </>
                        );
                      })()}
                  </>
              )}

              {filteredMarkers.map((marker) => (
                  <Marker
                      key={marker.id}
                      coordinate={marker.coordinate}
                      title={marker.title}
                      onPress={() => handleSelectCenter(marker)}
                  >
                      <View style={[styles.markerContainer, { backgroundColor: marker.type === 'hydration' ? '#3b82f6' : (marker.type === 'cooling' ? theme.primary : '#27ae60') }]}>
                          <MaterialIcons 
                              name={marker.type === 'hydration' ? "water-drop" : (marker.type === 'cooling' ? "ac-unit" : "park")} 
                              size={20} color="#fff" 
                          />
                      </View>
                  </Marker>
              ))}

              {routeCoordinates.length > 0 && (
                  <>
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeWidth={8}
                        strokeColor="rgba(59, 130, 246, 0.2)"
                    />
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeWidth={4}
                        strokeColor="#3b82f6"
                    />
                    <Marker 
                        coordinate={routeCoordinates[routeCoordinates.length - 1]}
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={[styles.markerContainer, { backgroundColor: '#ef4444', borderColor: '#fff' }]}>
                             <MaterialIcons name="flag" size={20} color="#fff" />
                        </View>
                    </Marker>
                  </>
              )}
          </MapView>
        )}


        {/* Top UI Layer */}
        <View style={[styles.topUI, { top: insets.top + 10 }]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(46, 204, 112, 0.1)' }]}>
            <TouchableOpacity onPress={handleSearch} disabled={isLocating}><MaterialIcons name="search" size={24} color={theme.primary} /></TouchableOpacity>
            <TextInput 
              placeholder={isListening ? "Listening..." : "Search city/address..."} 
              placeholderTextColor={isListening ? theme.primary : (isDark ? '#94a3b8' : '#64748b')}
              style={[styles.searchInput, { color: textColor }]}
              value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search"
            />
          </BlurView>

          <View style={styles.filtersContainer}>
             <TouchableOpacity 
                style={[styles.filterChip, filter === 'cooling' ? { backgroundColor: theme.primary, borderColor: theme.primary } : [styles.inactiveFilter, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]]} 
                onPress={() => setFilter(filter === 'cooling' ? 'all' : 'cooling')}
             >
                <MaterialIcons name="ac-unit" size={16} color={filter === 'cooling' ? "#fff" : theme.primary} />
                <Text style={[styles.filterText, { color: filter === 'cooling' ? '#fff' : textColor }]}>Cool Spots</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                style={[styles.filterChip, showHeatMap ? { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.riskMedium } : [styles.inactiveFilter, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]]} 
                onPress={() => setShowHeatMap(!showHeatMap)}
             >
                <MaterialIcons name="wb-sunny" size={16} color={theme.riskMedium} />
                <Text style={[styles.filterText, { color: textColor }]}>Heat Risk</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                style={[styles.filterChip, filter === 'hydration' ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' } : [styles.inactiveFilter, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]]} 
                onPress={() => setFilter(filter === 'hydration' ? 'all' : 'hydration')}
             >
                <MaterialIcons name="water-drop" size={16} color={filter === 'hydration' ? "#fff" : '#3b82f6'} />
                <Text style={[styles.filterText, { color: filter === 'hydration' ? '#fff' : textColor }]}>Hydration</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Control FABs */}
        <View style={[styles.fabContainer, { bottom: '40%' }]}> 
           <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.fabBlur, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(46, 204, 112, 0.1)' }]}>
              <View style={{ gap: 1 }}>
                  <TouchableOpacity style={[styles.zoomButton]} onPress={() => handleZoom('in')}><MaterialIcons name="add" size={24} color={theme.primary} /></TouchableOpacity>
                  <View style={{ height: 1.5, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                  <TouchableOpacity style={[styles.zoomButton]} onPress={() => handleZoom('out')}><MaterialIcons name="remove" size={24} color={theme.primary} /></TouchableOpacity>
              </View>
           </BlurView>




           <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.fabBlur, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(46, 204, 112, 0.1)' }]}>
              <TouchableOpacity style={styles.fabButton} onPress={handleLocateMe} disabled={isLocating}>
                 {isLocating ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={24} color={theme.primary} />}
              </TouchableOpacity>
           </BlurView>
        </View>

        <BottomSheet
            ref={bottomSheetRef} 
            index={0} 
            snapPoints={snapPoints}
            backgroundStyle={{ backgroundColor: isDark ? theme.backgroundDark : '#ffffff' }}
            handleIndicatorStyle={{ backgroundColor: theme.primary + '40' }}
        >
            <BottomSheetView style={styles.bottomSheetContent}>
                <View style={styles.pullIndicator} />
                
                {selectedCenter ? (
                  <View style={{ flex: 1 }}>
                    <View style={styles.sheetHeader}>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={[styles.sheetTitle, { color: textColor }]}>{selectedCenter.title}</Text>
                            <View style={styles.sheetMeta}>
                                <MaterialIcons name="location-on" size={18} color={theme.primary} />
                                <Text style={[styles.sheetTemp, { color: textColor }]}>{selectedCenter.address || 'Cooling Facility'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => { setSelectedCenter(null); setRouteCoordinates([]); }} style={styles.closeBtn}>
                           <MaterialIcons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {selectedCenter.routeInfo ? (
                      <View style={styles.routeContainer}>
                        <View style={[styles.routeInfoCard, { 
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', 
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
                        }]}>
                           <View style={styles.routeStats}>
                              <View style={styles.statBox}>
                                 <Text style={styles.statLabel}>DURATION</Text>
                                 <Text style={[styles.statValue, { color: textColor }]}>{selectedCenter.routeInfo.duration}</Text>
                              </View>
                              <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
                              <View style={styles.statBox}>
                                 <Text style={styles.statLabel}>DISTANCE</Text>
                                 <Text style={[styles.statValue, { color: textColor }]}>{selectedCenter.routeInfo.distance}</Text>
                              </View>
                              <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} />
                               <View style={styles.statBox}>
                                  <Text style={styles.statLabel}>SAFETY</Text>
                                  <View style={styles.protectionRow}>
                                     <MaterialIcons name="verified" size={14} color={theme.primary} style={{ marginRight: 4 }} />
                                     <Text style={[styles.statValue, { color: theme.primary }]}>{routeCalculations?.safety || '98%'}</Text>
                                  </View>
                               </View>
                            </View>

                            {/* New Calculations Logic Row */}
                            <View style={[styles.calcGrid, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderTopWidth: 1, paddingTop: 12, marginTop: 12 }]}>
                               <View style={styles.calcItem}>
                                  <MaterialIcons name="water-drop" size={14} color="#3b82f6" />
                                  <Text style={[styles.calcLabel, { color: subtextColor }]}>HYDRATION: </Text>
                                  <Text style={[styles.calcValue, { color: textColor }]}>{routeCalculations?.hydration}</Text>
                               </View>
                               <View style={styles.calcItem}>
                                  <MaterialIcons name="wb-cloudy" size={14} color="#64748b" />
                                  <Text style={[styles.calcLabel, { color: subtextColor }]}>SHADE: </Text>
                                  <Text style={[styles.calcValue, { color: textColor }]}>{routeCalculations?.shade}</Text>
                               </View>
                            </View>

                            <View style={[styles.routeBenefits, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                               <MaterialIcons name="insights" size={14} color={theme.primary} />
                               <Text style={[styles.benefitText, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>
                                 THERMAL IMPACT: Expect ~{routeCalculations?.thermalRelief} relief upon arrival.
                               </Text>
                            </View>
                         </View>

                        <Text style={[styles.sectionHeader, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>VOICE GUIDANCE PREVIEW</Text>
                        
                        <BottomSheetScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 4, paddingBottom: 20 }}>
                           {selectedCenter.routeInfo.steps?.map((step, idx) => (
                              <View key={idx} style={[styles.stepRow, { borderLeftColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
                                 <View style={[styles.stepDot, { backgroundColor: idx === 0 ? theme.primary : (isDark ? '#334155' : '#cbd5e1') }]} />
                                 <View style={{ flex: 1, paddingBottom: 12 }}>
                                    <Text style={[styles.stepText, { color: textColor }]}>{step.instruction}</Text>
                                    <Text style={[styles.stepDistance, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>{step.distance}</Text>
                                 </View>
                              </View>
                           ))}
                        </BottomSheetScrollView>

                        <TouchableOpacity 
                           style={styles.navButton} 
                           onPress={() => openExternalMaps(selectedCenter.coordinate.latitude, selectedCenter.coordinate.longitude, selectedCenter.title)}
                        >
                           <MaterialIcons name="near-me" size={22} color="#fff" />
                           <Text style={styles.navButtonText}>Start Navigation</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.routeInfoCard, { height: 100, justifyContent: 'center', alignItems: 'center' }]}>
                         <ActivityIndicator size="small" color={theme.primary} />
                         <Text style={{ marginTop: 8, color: textColor, opacity: 0.6 }}>Calculating safest route...</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    <View style={styles.sheetHeader}>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={[styles.sheetTitle, { color: textColor }]}>{locationName || "Lower Manhattan"}</Text>
                            <View style={styles.sheetMeta}>
                                <MaterialIcons name="device-thermostat" size={18} color={theme.primary} />
                                <Text style={[styles.sheetTemp, { color: textColor }]}>Currently {Math.round(temperature)}°F</Text>
                                <Text style={[styles.sheetsubTemp, { color: isDark ? theme.subtextLight : theme.subtextDark }]}> • Feels like {heatIndex}°F</Text>
                            </View>
                        </View>
                        <View style={[styles.riskBadge, { backgroundColor: riskStyles.bg, borderColor: riskStyles.border }]}>
                            <Text style={[styles.riskBadgeText, { color: riskStyles.text }]}>{risk || "MODERATE"} RISK</Text>
                        </View>
                    </View>

                    {/* Quick Action Cards */}
                     <View style={styles.sheetCardsRow}>
                        <TouchableOpacity 
                          style={[styles.infoCard, { 
                              backgroundColor: isDark ? 'rgba(46, 204, 112, 0.08)' : 'rgba(46, 204, 112, 0.05)', 
                              borderColor: isDark ? 'rgba(46, 204, 112, 0.15)' : 'rgba(46, 204, 112, 0.1)' 
                          }]}
                          onPress={() => {
                            const center = centersData.find(m => m.type === 'cooling' || m.type === 'park');
                            if (center) handleSelectCenter(center);
                            else Alert.alert("Not Found", "No local cooling centers found.");
                          }}
                        >
                            <View style={styles.cardHeader}>
                               <MaterialIcons name="park" size={32} color={theme.primary} />
                               <Text style={[styles.countTextLabel, { color: theme.primary }]}>{coolingCount} Active</Text>
                            </View>
                            <View style={{ marginTop: 'auto' }}>
                              <Text style={[styles.cardLabel, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>
                                {nearestCooling ? `${coolingCount} SPOTS NEARBY` : 'NEAREST HUB'}
                              </Text>
                              <Text style={[styles.cardMainText, { color: isDark ? theme.textLight : '#064e3b' }]}>
                                {nearestCooling?.title || "Searching..."}
                              </Text>
                              <Text style={[styles.cardSubText, { color: isDark ? theme.textLight + '99' : '#064e3b99', fontSize: 11, marginTop: 2 }]}>
                                {nearestCooling ? `${formatDist(nearestCooling.distance_meters || nearestCooling.distance)} • ${formatTime(nearestCooling.distance_meters || nearestCooling.distance)}` : 'Scanning...'}
                              </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.infoCard, { 
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)', 
                              borderColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)' 
                          }]}
                          onPress={() => {
                            const center = centersData.find(m => m.type === 'hydration');
                            if (center) handleSelectCenter(center);
                            else Alert.alert("Not Found", "No hydration points found.");
                          }}
                        >
                            <View style={styles.cardHeader}>
                               <MaterialIcons name="water-drop" size={32} color="#3b82f6" />
                               <Text style={[styles.countTextLabel, { color: '#3b82f6' }]}>{hydrationCount} Points</Text>
                            </View>
                            <View style={{ marginTop: 'auto' }}>
                              <Text style={[styles.cardLabel, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>
                                {nearestHydration ? `${hydrationCount} POINTS NEARBY` : 'HYDRATION'}
                              </Text>
                              <Text style={[styles.cardMainText, { color: isDark ? theme.textLight : '#1e3a8a' }]}>
                                {nearestHydration?.title || "Fountain Spots"}
                              </Text>
                              <Text style={[styles.cardSubText, { color: isDark ? theme.textLight + '99' : '#1e3a8a99', fontSize: 11, marginTop: 2 }]}>
                                {nearestHydration ? `${formatDist(nearestHydration.distance_meters || nearestHydration.distance)} • ${formatTime(nearestHydration.distance_meters || nearestHydration.distance)}` : 'Locating...'}
                              </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                  </>
                )}

            </BottomSheetView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  markerContainer: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 5 },
  topUI: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, zIndex: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, elevation: 8, marginBottom: 16 },
  searchInput: { flex: 1, marginHorizontal: 12, fontSize: 16, fontWeight: '500', paddingVertical: 0 },
  divider: { width: 1.5, height: 18, backgroundColor: 'rgba(46, 204, 112, 0.2)', marginRight: 12 },
  filtersContainer: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, elevation: 2 },
  inactiveFilter: { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0' },
  filterText: { fontSize: 12, fontWeight: '600' },
  fabContainer: { position: 'absolute', right: 16, gap: 12, zIndex: 10 },
  fabBlur: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(46, 204, 112, 0.1)', elevation: 4 },
  fabButton: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  zoomButton: { width: 48, height: 44, justifyContent: 'center', alignItems: 'center' },
  pullIndicator: { width: 48, height: 4, backgroundColor: theme.primary + '33', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  bottomSheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sheetTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sheetTemp: { fontSize: 15, fontWeight: '600' },
  sheetsubTemp: { fontSize: 13, opacity: 0.6 },
  riskBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  riskBadgeText: { 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  sheetCardsRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 20,
    width: '100%' 
  },
  infoCard: { 
    flex: 1, 
    padding: 24, 
    borderRadius: 24, 
    borderWidth: 1.5,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  countTextLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4
  },
  cardLabel: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#94a3b8', 
    marginTop: 14, 
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  cardMainText: { 
    fontSize: 17, 
    fontWeight: '800',
    lineHeight: 22
  },
  cardSubText: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.7,
    marginTop: 2
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  routeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routeContainer: {
    marginTop: 4,
    gap: 16,
  },
  routeInfoCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 16,
    textTransform: 'uppercase',
    opacity: 0.8
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeBenefits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  benefitText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
    fontWeight: '600',
  },
  navButton: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 8 }
    })
  },
  navButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderLeftWidth: 2,
    marginLeft: 6,
    paddingLeft: 20
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: -5,
    top: 6,
  },
  stepText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2
  },
  stepDistance: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyStateOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  emptyBlur: {
    padding: 24,
    borderRadius: 24,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.8
  },
  calcGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  calcItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calcLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  calcValue: {
    fontSize: 12,
    fontWeight: '800',
  },
});
