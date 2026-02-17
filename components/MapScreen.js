import React, { useRef, useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, TextInput, Alert, Keyboard, Platform } from 'react-native';
import MapView, { Marker, Callout, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWeather } from '@/hooks/useWeather';
import { theme } from '@/constants/theme';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Use global weather hook
  const { location, locationName, risk, heatIndex, temperature, tips, updateLocation, refresh, centersData } = useWeather();
  
  // Map state
  const [markers, setMarkers] = useState([]);
  const [filter, setFilter] = useState('all'); // all, cooling, hydration
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    
    try {
        const geocoded = await Location.geocodeAsync(searchQuery);
        if (geocoded.length > 0) {
            const { latitude, longitude } = geocoded[0];
            updateLocation(latitude, longitude);
        } else {
            Alert.alert("Location not found", "Please try a different search term.");
        }
    } catch (e) {
        Alert.alert("Search Error", "Could not find location.");
    }
  };

  const handleVoiceSearch = () => {
    Alert.alert("Voice Search", "Voice input is coming soon!");
  };

  // Bottom Sheet
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['25%', '50%'], []);
  const mapRef = useRef(null);
  
  // Sync region and use global centers data
  useEffect(() => {
    // Force a location refresh if we don't have one yet
    if (!location) {
        refresh();
    }

    if (location && location.coords) {
        const newRegion = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
        };
        
        // Animate to user location if map is ready
        if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1500);
        }
    }
    if (centersData && centersData.length > 0) {
        setMarkers(centersData);
    }
  }, [location, centersData]);

  // Derived filtered markers
  const filteredMarkers = useMemo(() => {
      if (!Array.isArray(markers)) return [];
      if (filter === 'all') return markers;
      return markers.filter(m => m.type === filter || (filter === 'cooling' && m.type === 'park')); 
  }, [markers, filter]);

  // Dynamic Colors based on risk
  const getRiskColor = () => {
    switch (risk) {
      case "SAFE": return theme.riskLow;
      case "CAUTION": return theme.riskMedium;
      case "DANGER": return theme.riskHigh;
      case "EXTREME": return theme.riskExtreme;
      default: return theme.riskLow;
    }
  };

  // Professional Distance calculation (Haversine formula for km/m)
  const getDistanceFormatted = (coord1, coord2) => {
    if (!coord1 || !coord2) return "";
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    
    if (d < 1) {
        return `${Math.round(d * 1000)}m`;
    }
    return `${d.toFixed(1)}km`;
  };

  const getDistanceValue = (coord1, coord2) => {
    if (!coord1 || !coord2) return Infinity;
    const dLat = (coord2.latitude - coord1.latitude);
    const dLon = (coord2.longitude - coord1.longitude);
    return Math.sqrt(dLat * dLat + dLon * dLon);
  };

  // Logic for the Bottom Sheet cards
  const nearestCooling = useMemo(() => {
      if (!location?.coords || markers.length === 0) return null;
      const cooling = markers.filter(m => m.type === 'cooling' || m.type === 'park');
      if (cooling.length === 0) return null;
      
      const sorted = [...cooling].sort((a, b) => {
          const distA = getDistanceValue(location.coords, a.coordinate);
          const distB = getDistanceValue(location.coords, b.coordinate);
          return distA - distB;
      });
      
      const nearest = sorted[0];
      return {
          ...nearest,
          displayDistance: getDistanceFormatted(location.coords, nearest.coordinate)
      };
  }, [markers, location]);

  const nearestHydration = useMemo(() => {
    if (!location?.coords || markers.length === 0) return null;
    const water = markers.filter(m => m.type === 'hydration');
    if (water.length === 0) return null;
    
    const sorted = [...water].sort((a, b) => {
        const distA = getDistanceValue(location.coords, a.coordinate);
        const distB = getDistanceValue(location.coords, b.coordinate);
        return distA - distB;
    });

    const nearest = sorted[0];
    return {
        ...nearest,
        displayDistance: getDistanceFormatted(location.coords, nearest.coordinate)
    };
  }, [markers, location]);

  const hydrationCount = useMemo(() => {
      return markers.filter(m => m.type === 'hydration').length;
  }, [markers]);

  const handleZoom = (type) => {
    if (!mapRef.current) return;
    mapRef.current.getCamera().then(camera => {
      const zoomLevel = type === 'in' ? (camera.zoom || 15) + 1 : (camera.zoom || 15) - 1;
      mapRef.current.animateCamera({
        zoom: zoomLevel
      }, { duration: 400 });
    });
  };

  const goToLocation = (coord) => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion({
      ...coord,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    }, 1000);
  };
  const riskColor = getRiskColor();
  const textColor = isDark ? theme.textLight : theme.textDark;
  const bgColor = isDark ? theme.backgroundDark : theme.backgroundLight;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Map Layer */}
        {!location || !location.coords ? (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
             <MaterialIcons name="location-off" size={48} color={theme.primary} style={{ opacity: 0.2, marginBottom: 12 }} />
             <Text style={{ color: textColor, opacity: 0.5, fontSize: 13 }}>Initializing Map Context...</Text>
          </View>
        ) : Platform.OS === 'web' ? (
          <View style={StyleSheet.absoluteFillObject}>
             <iframe
               key={`${location.coords.latitude}-${location.coords.longitude}`}
               width="100%"
               height="100%"
               frameBorder="0"
               src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.coords.longitude - 0.015}%2C${location.coords.latitude - 0.015}%2C${location.coords.longitude + 0.015}%2C${location.coords.latitude + 0.015}&layer=mapnik&marker=${location.coords.latitude}%2C${location.coords.longitude}`}
               style={{ 
                  border: 0,
                  filter: isDark ? 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none'
               }}
             />
        ) : ( 
          <MapView
              key="native-map-view"
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{ 
                  latitude: location.coords.latitude, 
                  longitude: location.coords.longitude, 
                  latitudeDelta: 0.04, 
                  longitudeDelta: 0.04 
              }}
              showsUserLocation={true}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
              showsCompass={false}
              showsMyLocationButton={false}
              toolbarEnabled={false}
              // liteMode={Platform.OS === 'android'} // Removed for full interactivity
          >
              {/* Simulated Heat Risk Zones */}
              {location && location.coords && showHeatMap && (
                  <>
                      <Circle 
                          center={{ latitude: location.coords.latitude + 0.008, longitude: location.coords.longitude + 0.008 }}
                          radius={1200}
                          fillColor="rgba(231, 76, 60, 0.2)" // Red zone
                          strokeColor="transparent"
                      />
                      <Circle 
                          center={{ latitude: location.coords.latitude - 0.01, longitude: location.coords.longitude - 0.005 }}
                          radius={900}
                          fillColor="rgba(243, 156, 18, 0.2)" // Orange zone
                          strokeColor="transparent"
                      />
                  </>
              )}

              {filteredMarkers.map((marker) => (
                  <Marker
                      key={marker.id}
                      coordinate={marker.coordinate}
                      title={marker.title}
                      description={marker.description}
                  >
                      <View style={[styles.markerContainer, { backgroundColor: marker.type === 'hydration' ? '#3b82f6' : (marker.type === 'cooling' ? theme.primary : '#27ae60') }]}>
                          <MaterialIcons 
                              name={marker.type === 'hydration' ? "water-drop" : (marker.type === 'cooling' ? "ac-unit" : "park")} 
                              size={20} 
                              color="#fff" 
                          />
                      </View>
                  </Marker>
              ))}
          </MapView>
        )}

        {/* Top UI Elements */}
        <View style={[styles.topUI, { top: insets.top + 10 }]}>
          {/* Search Bar */}
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(46, 204, 112, 0.1)' }]}>
            <TouchableOpacity onPress={handleSearch}>
              <MaterialIcons name="search" size={24} color={theme.primary} />
            </TouchableOpacity>
            <TextInput 
              placeholder="Search shelter..." 
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
              style={[styles.searchInput, { color: textColor }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <View style={styles.divider} />
            <TouchableOpacity onPress={handleVoiceSearch}>
                <MaterialIcons name="mic" size={24} color={theme.primary} />
            </TouchableOpacity>
          </BlurView>

          {/* Quick Filters */}
          <View style={styles.filtersContainer}>
             <TouchableOpacity 
                style={[
                    styles.filterChip, 
                    filter === 'cooling' ? { backgroundColor: theme.primary, borderColor: theme.primary } : 
                    [styles.inactiveFilter, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]
                ]}
                onPress={() => setFilter(filter === 'cooling' ? 'all' : 'cooling')}
             >
                <MaterialIcons name="ac-unit" size={16} color={filter === 'cooling' ? "#fff" : theme.primary} />
                <Text style={[styles.filterText, { color: filter === 'cooling' ? '#fff' : textColor }]}>Cool Spots</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                style={[
                    styles.filterChip, 
                    showHeatMap ? { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.riskMedium } : 
                    [styles.inactiveFilter, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]
                ]}
                onPress={() => setShowHeatMap(!showHeatMap)}
             >
                <MaterialIcons name="wb-sunny" size={16} color={theme.riskMedium} />
                <Text style={[styles.filterText, { color: textColor }]}>Heat Risk</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                style={[
                    styles.filterChip, 
                    filter === 'hydration' ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' } : 
                    [styles.inactiveFilter, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]
                ]}
                onPress={() => setFilter(filter === 'hydration' ? 'all' : 'hydration')}
             >
                <MaterialIcons name="water-drop" size={16} color={filter === 'hydration' ? "#fff" : '#3b82f6'} />
                <Text style={[styles.filterText, { color: filter === 'hydration' ? '#fff' : textColor }]}>Hydration</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Floating Action Buttons */}
          <View style={[styles.fabContainer, { bottom: '26%' }]}> 
             <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.fabBlur}>
                <View style={{ gap: 1 }}>
                    <TouchableOpacity 
                        style={[styles.zoomButton, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)' }]}
                        onPress={() => handleZoom('in')}
                    >
                        <MaterialIcons name="add" size={24} color={theme.primary} />
                    </TouchableOpacity>
                    <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }} />
                    <TouchableOpacity 
                        style={[styles.zoomButton, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)' }]}
                        onPress={() => handleZoom('out')}
                    >
                        <MaterialIcons name="remove" size={24} color={theme.primary} />
                    </TouchableOpacity>
                </View>
             </BlurView>

             <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.fabBlur}>
                <TouchableOpacity 
                   style={[styles.fabButton, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)' }]}
                   onPress={refresh}
                >
                   <MaterialIcons name="my-location" size={24} color={theme.primary} />
                </TouchableOpacity>
             </BlurView>
          </View>

          {/* Map Legend */}
          <View style={[styles.legendContainer, { bottom: '26%' }]}>
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={[styles.legendBlur, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(46, 204, 112, 0.1)' }]}>
                <Text style={[styles.legendTitle, { color: theme.primary }]}>HEAT RISK STATUS</Text>
                <View style={{ gap: 6 }}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: riskColor }]} />
                        <Text style={[styles.legendText, { color: textColor, fontWeight: '700' }]}>{risk} ZONE</Text>
                    </View>
                    <View style={{ height: 1.5, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginVertical: 4 }} />
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: theme.riskExtreme }]} />
                        <Text style={[styles.legendText, { color: textColor, fontSize: 10, opacity: 0.8 }]}>Extreme Hazard</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: theme.riskHigh }]} />
                        <Text style={[styles.legendText, { color: textColor, fontSize: 10, opacity: 0.8 }]}>Danger Zone</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: theme.riskMedium }]} />
                        <Text style={[styles.legendText, { color: textColor, fontSize: 10, opacity: 0.8 }]}>Moderate Caution</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: theme.riskLow }]} />
                        <Text style={[styles.legendText, { color: textColor, fontSize: 10, opacity: 0.8 }]}>Cool Zone</Text>
                    </View>
                </View>
            </BlurView>
          </View>

        {/* Bottom Sheet */}
        <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            backgroundStyle={{ backgroundColor: isDark ? theme.backgroundDark : '#ffffff' }}
            handleIndicatorStyle={{ backgroundColor: theme.primary + '40' }}
            enablePanDownToClose={false}
        >
            <BottomSheetView style={styles.bottomSheetContent}>
                <View style={styles.pullIndicator} />
                <View style={styles.sheetHeader}>
                    <View>
                        <Text style={[styles.sheetTitle, { color: textColor }]}>{locationName || "Detecting Location..."}</Text>
                        <View style={styles.sheetMeta}>
                            <MaterialIcons name="thermostat" size={16} color={theme.primary} />
                            <Text style={[styles.sheetTemp, { color: textColor }]}>Currently {Math.round(temperature)}°C</Text>
                            <Text style={[styles.sheetsubTemp, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>• Feels like {heatIndex}°F</Text>
                        </View>
                    </View>
                    <View style={[styles.riskBadge, { backgroundColor: riskColor + '15', borderColor: riskColor + '30' }]}>
                        <Text style={[styles.riskBadgeText, { color: riskColor }]}>{risk} RISK</Text>
                    </View>
                </View>

                <View style={styles.sheetCards}>
                    <TouchableOpacity 
                        style={[styles.sheetCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}
                        onPress={() => nearestCooling && goToLocation(nearestCooling.coordinate)}
                    >
                        <MaterialIcons name="park" size={24} color={theme.primary} style={{ marginBottom: 4 }} />
                        <Text style={[styles.sheetCardLabel, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>NEAREST COOLING</Text>
                        <Text style={[styles.sheetCardValue, { color: textColor }]} numberOfLines={1}>{nearestCooling?.title || "Searching..."}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                            <MaterialIcons name="navigation" size={12} color={theme.primary} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>{nearestCooling?.displayDistance || "--"}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.sheetCard, { backgroundColor: '#3498db15', borderColor: '#3498db30' }]}
                        onPress={() => nearestHydration && goToLocation(nearestHydration.coordinate)}
                    >
                        <MaterialIcons name="water-drop" size={24} color="#3498db" style={{ marginBottom: 4 }} />
                        <Text style={[styles.sheetCardLabel, { color: isDark ? theme.subtextLight : theme.subtextDark }]}>HYDRATION</Text>
                        <Text style={[styles.sheetCardValue, { color: textColor }]} numberOfLines={1}>Nearest: {nearestHydration?.title || "--"}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                            <MaterialIcons name="water" size={12} color="#3498db" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#3498db' }}>{nearestHydration?.displayDistance || "--"}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </BottomSheetView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  markerContainer: {
      padding: 8,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      elevation: 5,
  },
  topUI: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    elevation: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  divider: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(46, 204, 112, 0.2)',
    marginRight: 12,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    elevation: 2,
  },
  inactiveFilter: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderColor: '#e2e8f0',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    gap: 12,
    zIndex: 10,
  },
  fabBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 112, 0.1)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    elevation: 4,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  zoomButton: {
    width: 48,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPrimary: {
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    elevation: 6,
  },
  legendContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  legendBlur: {
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 112, 0.1)',
    width: 180,
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    elevation: 4,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pullIndicator: {
    width: 48,
    height: 4,
    backgroundColor: theme.primary + '33',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sheetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sheetTemp: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetsubTemp: {
    fontSize: 13,
    opacity: 0.6,
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sheetCards: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sheetCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    opacity: 0.6,
    marginBottom: 4,
  },
  sheetCardValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
