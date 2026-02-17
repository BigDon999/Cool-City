import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, Platform, RefreshControl, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWeather } from '@/hooks/useWeather';
import { SafeAreaView } from 'react-native-safe-area-context';
import ExtremeHeatModal from '@/components/ExtremeHeatModal';

export default function HomeScreenDisplay() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { 
    temperature, humidity, heatIndex, risk, locationName, 
    loading, advice, tips, refresh, 
    forecastHeat, isHeatwave, heatwaveLevel, heatwaveDays,
    predictiveRisk, predictiveRiskData, // Assuming predictiveRisk is array of objects { day, score } or temps
    // City Risk & System Impact
    cityRiskPercent, activeCenters, cityRiskLevel,
    hospitalLoad, emergencyIncrease, coolingDemand, systemStress,
    policyCenters, setPolicyCenters,
    dailyTemps // Need actual forecast data for 5-day list
  } = useWeather();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => setTimeout(() => setRefreshing(false), 500));
  }, [refresh]);

  useEffect(() => {
     if (risk === "EXTREME") setShowAlert(true);
  }, [risk]);

  // Colors from design
  const colors = {
      primary: "#2ecc70",
      danger: "#ef4444", 
      caution: "#f39c12",
      extreme: "#8e44ad",
      bgLight: "#f8fafc",
      bgDark: "#0f172a",
      cardDark: "#1e293b",
      textDark: "#0f172a",
      textLight: "#f8fafc",
      slate400: "#94a3b8",
      slate500: "#64748b",
  };
  
  const bgColor = isDark ? colors.bgDark : colors.bgLight;
  const textColor = isDark ? colors.textLight : colors.textDark;
  const cardBg = isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff';
  
  // Helper to get day name
  const getDayName = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
  };
  
  // Placeholder for forecast if not available
  const forecastList = dailyTemps && dailyTemps.length > 0 ? dailyTemps.slice(0, 5) : [30, 32, 29, 28, 27];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header Heatwave Banner */}
      {isHeatwave && (
          <View style={[styles.banner, heatwaveLevel === 'Extreme' && { backgroundColor: colors.extreme }]}>
              <View style={styles.bannerContent}>
                  <MaterialIcons name="warning" size={16} color="#fff" />
                  <Text style={styles.bannerText}>Active Heatwave: {heatwaveLevel} Level</Text>
              </View>
              <Text style={styles.bannerSubtext}>{heatwaveDays} Days Active</Text>
          </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header Location */}
        <View style={styles.header}>
            <View>
                <View style={styles.locationRow}>
                    <MaterialIcons name="location-on" size={16} color={colors.slate400} />
                    <Text style={[styles.locationText, { color: textColor }]}>
                        {locationName || "Locating City..."}
                    </Text>
                </View>
                <Text style={styles.protocolText}>Active Heat Mitigation Protocol {isHeatwave ? "LEVEL 3" : "NORMAL"}</Text>
            </View>
            <View style={styles.headerRight}>
                <TouchableOpacity onPress={() => Alert.alert("Alerts", "You have 3 active local heat warnings.")} style={[styles.iconButton, { marginRight: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' }]}>
                    <MaterialIcons name="notifications-none" size={20} color={colors.primary} />
                    <View style={styles.notificationBadge} />
                </TouchableOpacity>
                <TouchableOpacity onPress={refresh} style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' }]}>
                    <MaterialIcons name="sync" size={20} color={colors.slate400} />
                </TouchableOpacity>
            </View>
        </View>

        {/* Main Stat: Heat Index */}
        <View style={styles.mainStat}>
            <View style={styles.tempRow}>
                <Text style={[styles.tempValue, { color: textColor }]}>{heatIndex}</Text>
                <Text style={styles.tempUnit}>HI</Text>
            </View>
            <View style={styles.riskBadgeContainer}>
                <View style={[styles.riskBadge, { 
                    backgroundColor: risk === "SAFE" ? colors.primary : 
                                   (risk === "CAUTION" ? colors.caution : 
                                   (risk === "EXTREME" ? colors.extreme : colors.danger)) 
                }]}>
                    <Text style={styles.riskBadgeText}>{risk}</Text>
                </View>
                <Text style={styles.riskLabel}>Atmospheric Condition Index</Text>
            </View>
        </View>

        {/* Weather Grid */}
        <View style={styles.grid}>
            <View style={[styles.weatherCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}>
                <Text style={styles.cardLabel}>Temperature</Text>
                <View style={styles.cardRow}>
                    <Text style={[styles.cardValue, { color: textColor }]}>{Math.round(temperature)}°</Text>
                    <MaterialIcons name="device-thermostat" size={24} color={colors.caution} />
                </View>
            </View>
            <View style={[styles.weatherCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}>
                <Text style={styles.cardLabel}>Humidity</Text>
                <View style={styles.cardRow}>
                    <Text style={[styles.cardValue, { color: textColor }]}>{Math.round(humidity)}%</Text>
                    <MaterialIcons name="water-drop" size={24} color="#3b82f6" />
                </View>
            </View>
        </View>

        {/* City-Wide Intelligence */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>City-Wide Intelligence</Text>
            <View style={styles.intelligenceGrid}>
                <View style={[styles.intelligenceCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}>
                    <Text style={[styles.intelligenceValue, { color: textColor }]}>{cityRiskPercent}%</Text>
                    <Text style={styles.intelligenceLabel}>Danger Zone</Text>
                </View>
                <View style={[styles.intelligenceCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}>
                    <Text style={[styles.intelligenceValue, { color: textColor }]}>128k</Text>
                    <Text style={styles.intelligenceLabel}>Vulnerable Pop.</Text>
                </View>
                <View style={[styles.intelligenceCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}>
                    <Text style={[styles.intelligenceValue, { color: colors.primary }]}>{activeCenters}</Text>
                    <Text style={styles.intelligenceLabel}>Active Centers</Text>
                </View>
                <View style={[styles.intelligenceCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}>
                    <Text style={[styles.intelligenceValue, { color: colors.danger }]}>{cityRiskLevel}</Text>
                    <Text style={styles.intelligenceLabel}>Risk Tier</Text>
                </View>
            </View>
        </View>

        {/* 5-Day Forecast */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>5-Day Predictive Risk</Text>
                <Text style={styles.confidenceText}>Confidence: 94%</Text>
            </View>
            
            <View style={styles.forecastList}>
                {forecastList.map((temp, i) => {
                    const barWidth = Math.min(100, Math.max(20, (temp / 45) * 100)) + '%';
                    const barColor = temp > 35 ? colors.danger : (temp > 30 ? colors.caution : colors.primary);
                    
                    return (
                        <View key={i} style={styles.forecastRow}>
                            <Text style={styles.dayLabel}>{getDayName(i)}</Text>
                            <View style={[styles.barTrack, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                                <View style={[styles.barFill, { width: barWidth, backgroundColor: barColor }]} />
                            </View>
                            <Text style={[styles.forecastTemp, { color: barColor }]}>{Math.round(temp)}°</Text>
                        </View>
                    );
                })}
            </View>
        </View>

        {/* System Impact Analysis (Dark Card) */}
        <View style={[styles.darkCard, { backgroundColor: colors.cardDark }]}>
            <View style={styles.darkCardHeader}>
                <Text style={styles.darkCardTitle}>System Impact Analysis</Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{systemStress}</Text>
                </View>
            </View>
            
            <View style={styles.impactGrid}>
                <View>
                    <Text style={styles.impactLabel}>Hospital Load</Text>
                    <View style={styles.impactRow}>
                         <Text style={styles.impactValue}>{hospitalLoad}%</Text>
                         <MaterialIcons name="local-hospital" size={16} color={colors.danger} />
                    </View>
                    <Text style={styles.impactSubtext}>High Admission</Text>
                </View>
                <View>
                    <Text style={styles.impactLabel}>Cooling Demand</Text>
                    <View style={styles.impactRow}>
                         <Text style={styles.impactValue}>{coolingDemand}%</Text>
                         <MaterialIcons name="bolt" size={16} color={colors.caution} />
                    </View>
                    <Text style={styles.impactSubtext}>Grid Peak Expected</Text>
                </View>
                <View style={{ marginTop: 16 }}>
                    <Text style={styles.impactLabel}>Active Centers</Text>
                    <View style={styles.impactRow}>
                         <Text style={[styles.impactValue, { color: colors.primary }]}>{activeCenters}</Text>
                         <MaterialIcons name="apartment" size={16} color={colors.primary} />
                    </View>
                </View>
                 <View style={{ marginTop: 16 }}>
                    <Text style={styles.impactLabel}>Emergency Calls</Text>
                    <View style={styles.impactRow}>
                         <Text style={[styles.impactValue, { color: colors.danger }]}>+{emergencyIncrease}%</Text>
                         <MaterialIcons name="phone-in-talk" size={16} color={colors.danger} />
                    </View>
                </View>
            </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity 
            style={styles.locatorButton}
            onPress={() => alert("Navigating to Map...")} 
        >
            <MaterialIcons name="ac-unit" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.locatorButtonText}>Locate Active Cooling Center</Text>
        </TouchableOpacity>
        
        {/* Policy Simulator Toggle */}
        <TouchableOpacity 
            style={[styles.simulatorButton, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
            onPress={() => setShowSimulator(!showSimulator)}
        >
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                <View style={[styles.simIcon, { backgroundColor: 'rgba(46, 204, 112, 0.1)' }]}>
                     <MaterialIcons name="tune" size={20} color={colors.primary} />
                </View>
                <View>
                    <Text style={[styles.simTitle, { color: textColor }]}>Policy Simulator</Text>
                    <Text style={styles.simSubtitle}>Adjust cooling center capacity</Text>
                </View>
            </View>
            <MaterialIcons name={showSimulator ? "expand-less" : "expand-more"} size={24} color={colors.slate400} />
        </TouchableOpacity>
        
        {/* Policy Controls (Collapsible) */}
        {showSimulator && (
            <View style={[styles.simulatorControls, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                <View style={styles.controlHeader}>
                    <Text style={[styles.controlLabel, {color: textColor}]}>Additional Centers: {policyCenters}</Text>
                    <Text style={[styles.controlValue, {color: colors.primary}]}>-{Math.min(40, policyCenters * 2)}% Load</Text>
                </View>
                
                <View style={styles.stepperContainer}>
                    <TouchableOpacity 
                        style={[styles.stepperBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} 
                        onPress={() => setPolicyCenters(Math.max(0, policyCenters - 1))}
                    >
                        <MaterialIcons name="remove" size={24} color={textColor} />
                    </TouchableOpacity>
                    
                    <View style={styles.stepperDisplay}>
                        <Text style={[styles.stepperValue, {color: textColor}]}>{policyCenters}</Text>
                    </View>
                    
                    <TouchableOpacity 
                        style={[styles.stepperBtn, { backgroundColor: colors.primary }]} 
                        onPress={() => setPolicyCenters(policyCenters + 1)}
                    >
                         <MaterialIcons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.simInsight}>Adding centers reduces hospital load by 2% each.</Text>
            </View>
        )}

      </ScrollView>
      
      <ExtremeHeatModal 
        visible={showAlert} 
        onClose={() => setShowAlert(false)} 
        heatIndex={heatIndex} 
        advice={advice} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  banner: {
      backgroundColor: '#ef4444',
      paddingHorizontal: 20,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  bannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
  },
  bannerText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
  },
  bannerSubtext: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 10,
      fontWeight: '600',
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 24,
      marginTop: 16,
      marginBottom: 24,
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  notificationBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
      borderWidth: 1.5,
      borderColor: '#fff',
  },
  locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
  },
  locationText: {
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
  },
  protocolText: {
      fontSize: 10,
      color: '#94a3b8',
      marginTop: 4,
      fontWeight: '500',
  },
  iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      elevation: 2,
  },
  mainStat: {
      alignItems: 'center',
      marginBottom: 32,
  },
  tempRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
  },
  tempValue: {
      fontSize: 96,
      fontWeight: 'bold',
      letterSpacing: -4,
      lineHeight: 96,
  },
  tempUnit: {
      fontSize: 24,
      fontWeight: '300',
      color: '#94a3b8',
      marginLeft: 4,
      marginBottom: 12,
  },
  riskBadgeContainer: {
      alignItems: 'center',
      marginTop: -8,
  },
  riskBadge: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderRadius: 99,
      marginBottom: 8,
  },
  riskBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 2,
  },
  riskLabel: {
      fontSize: 10,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: 2,
      fontWeight: '600',
  },
  grid: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 24,
  },
  weatherCard: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
  },
  cardLabel: {
      fontSize: 10,
      color: '#94a3b8',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
  },
  cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  cardValue: {
      fontSize: 24,
      fontWeight: 'bold',
  },
  intelligenceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
  },
  intelligenceCard: {
      width: '48%', // Approx half with gap
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      // alignItems: 'center', // Or left aligned? Design shows left aligned.
  },
  intelligenceValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
  },
  intelligenceLabel: {
      fontSize: 10,
      color: '#94a3b8',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
  },
  section: {
      paddingHorizontal: 24,
      marginBottom: 24,
  },
  sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
  },
  sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: 1,
  },
  confidenceText: {
      fontSize: 9,
      color: '#94a3b8',
      fontWeight: '600',
      textTransform: 'uppercase',
  },
  forecastList: {
      gap: 12,
  },
  forecastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  dayLabel: {
      width: 32,
      fontSize: 10,
      fontWeight: 'bold',
      color: '#94a3b8',
      textTransform: 'uppercase',
  },
  barTrack: {
      flex: 1,
      height: 8, // h-2 -> 0.5rem is small, let's say 8px or 12px. h-3 is 0.75rem.
      borderRadius: 99,
      overflow: 'hidden',
  },
  barFill: {
      height: '100%',
      borderRadius: 99,
  },
  forecastTemp: {
      width: 24,
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'right',
  },
  darkCard: {
      marginHorizontal: 24,
      padding: 24,
      borderRadius: 20,
      shadowRadius: 20,
      boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
      elevation: 5,
      marginBottom: 24,
  },
  darkCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  darkCardTitle: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
  },
  statusBadge: {
      backgroundColor: 'rgba(46, 204, 112, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
  },
  statusBadgeText: {
      color: '#2ecc70',
      fontSize: 9,
      fontWeight: 'bold',
      textTransform: 'uppercase',
  },
  impactGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
  },
  impactLabel: {
      fontSize: 9,
      color: 'rgba(255,255,255,0.6)', // slate-400
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
  },
  impactRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
  },
  impactValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
  },
  impactSubtext: {
      fontSize: 9,
      color: '#ef4444',
      fontWeight: '500',
      marginTop: 4,
  },
  simulatorButton: {
      marginHorizontal: 24,
      marginTop: 8,
      marginBottom: 24,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
       boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
      elevation: 2,
  },
  simIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
  },
  simTitle: {
      fontSize: 14,
      fontWeight: 'bold',
  },
  simSubtitle: {
      fontSize: 10,
      color: '#64748b',
      textTransform: 'uppercase',
      fontWeight: '500',
  },
  simulatorControls: {
      marginHorizontal: 24,
      padding: 20,
      borderRadius: 16,
      marginTop: -12,
      marginBottom: 24,
  },
  controlHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
  },
  controlLabel: {
      fontSize: 14, 
      fontWeight: 'bold',
  },
  controlValue: {
      fontSize: 14,
      fontWeight: 'bold',
  },
  stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
  },
  stepperBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
  },
  stepperDisplay: {
      flex: 1,
      alignItems: 'center',
  },
  stepperValue: {
      fontSize: 24,
      fontWeight: 'bold',
  },
  simInsight: {
      fontSize: 10,
      color: '#94a3b8',
      textAlign: 'center',
  },
  locatorButton: {
      backgroundColor: '#2ecc70',
      paddingVertical: 16,
      borderRadius: 16,
      marginHorizontal: 24,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
       boxShadow: '0 4px 10px rgba(46, 204, 112, 0.3)',
      elevation: 5,
  },
  locatorButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
  },
});
