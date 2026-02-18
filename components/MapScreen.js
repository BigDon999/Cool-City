import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, TextInput, Alert, Keyboard, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWeather } from '@/hooks/useWeather';
import { theme } from '@/constants/theme';

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
    updateLocation, 
    refresh, 
    centersData,
    permissionStatus,
    requestLocationPermission,
    loading: weatherLoading 
  } = useWeather();
  
  const [mapReady, setMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Update local markers when global data changes
  useEffect(() => {
    if (centersData && Array.isArray(centersData)) {
        if (isMounted.current) setMarkers(centersData);
    }
  }, [centersData]);

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

  const filteredMarkers = useMemo(() => {
      if (!Array.isArray(markers)) return [];
      if (filter === 'all') return markers;
      return markers.filter(m => m.type === filter || (filter === 'cooling' && m.type === 'park')); 
  }, [markers, filter]);

  const textColor = isDark ? theme.textLight : theme.textDark;
  const bgColor = isDark ? theme.backgroundDark : theme.backgroundLight;

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

  const snapPoints = useMemo(() => ['25%', '50%'], []);

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
           <View style={StyleSheet.absoluteFillObject}>
              <iframe
                title="Map Layer"
                key={`${initialRegion.latitude}-${initialRegion.longitude}`}
                width="100%" height="100%" frameBorder="0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${initialRegion.longitude - 0.015}%2C${initialRegion.latitude - 0.015}%2C${initialRegion.longitude + 0.015}%2C${initialRegion.latitude + 0.015}&layer=mapnik&marker=${initialRegion.latitude}%2C${initialRegion.longitude}`}
                style={{ border: 0, filter: isDark ? 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none' }}
              />
           </View>
        ) : ( 
          <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={initialRegion}
              onMapReady={onMapReady}
              showsUserLocation={permissionStatus === 'granted' && mapReady}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
              showsCompass={false}
              showsMyLocationButton={false}
              toolbarEnabled={false}
          >
              {location?.coords && showHeatMap && (
                  <>
                      <Circle 
                          center={{ latitude: location.coords.latitude + 0.008, longitude: location.coords.longitude + 0.008 }}
                          radius={1200} fillColor="rgba(231, 76, 60, 0.2)" strokeColor="transparent"
                      />
                      <Circle 
                          center={{ latitude: location.coords.latitude - 0.01, longitude: location.coords.longitude - 0.005 }}
                          radius={900} fillColor="rgba(243, 156, 18, 0.2)" strokeColor="transparent"
                      />
                  </>
              )}

              {filteredMarkers.map((marker) => (
                  <Marker
                      key={marker.id}
                      coordinate={marker.coordinate}
                      title={marker.title}
                  >
                      <View style={[styles.markerContainer, { backgroundColor: marker.type === 'hydration' ? '#3b82f6' : (marker.type === 'cooling' ? theme.primary : '#27ae60') }]}>
                          <MaterialIcons 
                              name={marker.type === 'hydration' ? "water-drop" : (marker.type === 'cooling' ? "ac-unit" : "park")} 
                              size={20} color="#fff" 
                          />
                      </View>
                  </Marker>
              ))}
          </MapView>
        )}

        {/* Top UI Layer */}
        <View style={[styles.topUI, { top: insets.top + 10 }]}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(46, 204, 112, 0.1)' }]}>
            <TouchableOpacity onPress={handleSearch} disabled={isLocating}><MaterialIcons name="search" size={24} color={theme.primary} /></TouchableOpacity>
            <TextInput 
              placeholder="Search city/address..." placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
              style={[styles.searchInput, { color: textColor }]}
              value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search"
            />
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => Alert.alert("Voice", "Voice input disabled")}><MaterialIcons name="mic" size={24} color={theme.primary} /></TouchableOpacity>
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

                {/* Bottom Sheet Cards (Thematic Dark/Light Adjustments) */}
                <View style={styles.sheetCardsRow}>
                    <View style={[styles.infoCard, { 
                        backgroundColor: isDark ? 'rgba(46, 204, 112, 0.1)' : '#f0fdf4', 
                        borderColor: isDark ? 'rgba(46, 204, 112, 0.2)' : '#dcfce7' 
                    }]}>
                        <MaterialIcons name="park" size={32} color={theme.primary} />
                        <View style={{ marginTop: 'auto' }}>
                          <Text style={[styles.cardLabel, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>NEAREST COOLING</Text>
                          <Text style={[styles.cardMainText, { color: isDark ? theme.textLight : '#064e3b' }]}>
                            {markers.find(m => m.type === 'cooling' || m.type === 'park')?.title || "Hudson Park"} (4 min)
                          </Text>
                        </View>
                    </View>

                    <View style={[styles.infoCard, { 
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', 
                        borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe' 
                    }]}>
                        <MaterialIcons name="water-drop" size={32} color="#3b82f6" />
                        <View style={{ marginTop: 'auto' }}>
                          <Text style={[styles.cardLabel, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>HYDRATION</Text>
                          <Text style={[styles.cardMainText, { color: isDark ? theme.textLight : '#1e3a8a' }]}>3 Fountains nearby</Text>
                        </View>
                    </View>
                </View>
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
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 110,
  },
  cardLabel: { 
    fontSize: 9, 
    fontWeight: '800', 
    color: '#94a3b8', 
    marginTop: 12, 
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  cardMainText: { 
    fontSize: 16, 
    fontWeight: '700',
    lineHeight: 20
  },
  cardSubText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8
  }
});
